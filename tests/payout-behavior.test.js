import test from 'node:test';
import assert from 'node:assert/strict';
import { __payoutTestHooks as hooks } from '../worker-gateway2.js';

class FakeD1 {
  constructor({ available = 10, operations = [], transactions = [], incomplete = [] } = {}) {
    this.available = available;
    this.operations = structuredClone(operations);
    this.transactions = structuredClone(transactions);
    this.queue = [];
    this.incomplete = incomplete;
  }

  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() { return db.first(sql, this.values); },
      async all() { return db.all(sql, this.values); },
      async run() { return db.run(sql, this.values); }
    };
  }

  async first(sql, values) {
    if (sql.includes('FROM users WHERE id')) return { pi_uid: values[0] === 'u' ? 'uid-u' : values[0] };
    if (sql.includes('FROM payout_operations') && sql.includes('operation_key')) return this.operations.find((op) => op.operation_key === values[0]) || null;
    if (sql.includes('FROM payout_operations') && sql.includes('pi_payment_id')) return this.operations.find((op) => op.pi_payment_id === values[0]) || null;
    if (sql.includes('FROM transactions')) return this.transactions.find((tx) => tx.pi_payment_id === values[0] || tx.pi_txid === values[1]) || null;
    return null;
  }

  async all(sql) {
    if (sql.includes('FROM payout_operations')) return { results: this.operations.filter((op) => !['completed', 'cancelled'].includes(op.status)) };
    return { results: [] };
  }

  async run(sql, values) {
    if (sql.includes('INSERT INTO payout_reconciliation_queue')) {
      const [id, paymentId, operationKey, payload, createdAt] = values;
      const existing = this.queue.find((row) => row.pi_payment_id === paymentId);
      if (existing) Object.assign(existing, { operation_key: operationKey, status: 'reconciliation_required', payload, updated_at: createdAt });
      else this.queue.push({ id, pi_payment_id: paymentId, operation_key: operationKey, status: 'reconciliation_required', payload, created_at: createdAt, updated_at: createdAt });
      return { meta: { changes: 1 } };
    }
    if (sql.includes('INSERT INTO payout_operations')) {
      const [id, key, amount, userId, recipient, createdAt, reservationExpires, leaseOwner, leaseExpires] = values;
      const active = this.operations.filter((op) => ['reserved', 'creating', 'pi_created', 'approving', 'approved', 'completing', 'reconciliation_required'].includes(op.status)).reduce((sum, op) => sum + Number(op.amount), 0);
      if (this.operations.some((op) => op.operation_key === key) || Number(amount) <= 0 || Number(amount) > this.available - active) return { meta: { changes: 0 } };
      this.operations.push({ id, operation_key: key, status: 'reserved', amount, user_id: userId, recipient, created_at: createdAt, updated_at: createdAt, reservation_expires_at: reservationExpires, lease_owner: leaseOwner, lease_expires_at: leaseExpires, pi_payment_id: null, txid: null, error: null });
      return { meta: { changes: 1 } };
    }
    if (sql.includes("status='reserved'") && sql.includes('lease_expires_at')) {
      const [owner, expires, updated, key] = values;
      const op = this.operations.find((row) => row.operation_key === key);
      if (op && op.status === 'reserved' && (!op.lease_expires_at || op.lease_expires_at < updated)) {
        Object.assign(op, { lease_owner: owner, lease_expires_at: expires, updated_at: updated });
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }
    if (sql.includes("UPDATE payout_operations SET status='completed'")) {
      const [paymentId, txid, updated, key] = values;
      const op = this.operations.find((row) => row.operation_key === key);
      if (op && ['approving', 'approved', 'completing', 'reconciliation_required'].includes(op.status)) Object.assign(op, { status: 'completed', pi_payment_id: paymentId, txid, updated_at: updated, error: null });
      return { meta: { changes: op ? 1 : 0 } };
    }
    if (sql.includes('INSERT OR IGNORE INTO transactions')) {
      const [id, paymentId, txid, userId, amount, createdAt] = values;
      if (!this.transactions.some((tx) => tx.pi_payment_id === paymentId || tx.pi_txid === txid)) this.transactions.push({ id, pi_payment_id: paymentId, pi_txid: txid, user_id: userId, amount, created_at: createdAt });
      return { meta: { changes: 1 } };
    }
    if (sql.includes('UPDATE payout_operations SET')) {
      const keyMatch = sql.match(/operation_key=\?(\d+)/);
      const key = keyMatch ? values[Number(keyMatch[1]) - 1] : undefined;
      const op = this.operations.find((row) => row.operation_key === key);
      if (!op) return { meta: { changes: 0 } };
      const keyIndex = Number(keyMatch?.[1] || 0) - 1;
      const allowedLiterals = [...sql.matchAll(/status IN \(([^)]+)\)/g)].at(-1)?.[1]?.match(/'([^']+)'/g)?.map((s) => s.slice(1, -1)) || [];
      const allowed = allowedLiterals.length ? allowedLiterals : values.slice(keyIndex + 1, sql.includes('lease_owner=?') ? -1 : undefined);
      if (!allowed.includes(op.status)) return { meta: { changes: 0 } };
      if (sql.includes('lease_owner=?')) {
        const owner = values.at(-1);
        if (op.lease_owner !== owner) return { meta: { changes: 0 } };
      }
      op.status = values[0];
      op.updated_at = values[1];
      const piIndex = sql.match(/pi_payment_id=\?(\d+)/); if (piIndex) op.pi_payment_id = values[Number(piIndex[1]) - 1];
      const txIndex = sql.match(/txid=\?(\d+)/); if (txIndex) op.txid = values[Number(txIndex[1]) - 1];
      const errorIndex = sql.match(/error=\?(\d+)/); if (errorIndex) op.error = values[Number(errorIndex[1]) - 1];
      if (sql.includes('lease_owner=NULL')) op.lease_owner = null;
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 0 } };
  }

  async batch(statements) {
    for (const statement of statements) await statement.run();
  }
}

function response(body, ok = true, status = ok ? 200 : 500) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function piHarness({ get = {}, approve, complete, create, incomplete = [] } = {}) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    const method = options.method || 'GET';
    calls.push({ path, method });
    if (path.endsWith('/incomplete_server_payments')) return response({ incomplete_server_payments: incomplete });
    if (path.endsWith('/payments') && method === 'POST') return typeof create === 'function' ? create(calls) : response({ identifier: 'pi-created' });
    if (path.endsWith('/approve')) return typeof approve === 'function' ? approve(calls) : response({ status: { developer_approved: true } });
    if (path.endsWith('/complete')) return typeof complete === 'function' ? complete(calls) : response({ status: { developer_completed: true }, transaction: { txid: 'tx-complete' } });
    const id = path.split('/').at(-1);
    const current = typeof get === 'function' ? get(id, calls) : get[id] || get.default || {};
    return response(current);
  };
  return calls;
}

function env(db) { return { RENTORA_DB: db, PI_API_URL: 'https://api.test/v2', PI_API_KEY: 'test-key' }; }


test('behavior: concurrent treasury reservation allows exactly one owner', async () => {
  const db = new FakeD1({ available: 10 });
  const [a, b] = await Promise.all([
    hooks.claimPayoutOperation(env(db), 'op-a', { amount: 7, userId: 'u1', recipient: 'r1' }),
    hooks.claimPayoutOperation(env(db), 'op-b', { amount: 7, userId: 'u2', recipient: 'r2' })
  ]);
  assert.equal([a.created, b.created].filter(Boolean).length, 1);
  assert.equal(db.operations.length, 1);
});

test('behavior: reserved retry takes over only after lease expiry', async () => {
  const db = new FakeD1({ available: 10 });
  const first = await hooks.claimPayoutOperation(env(db), 'op', { amount: 5, userId: 'u', recipient: 'r' });
  const blocked = await hooks.claimPayoutOperation(env(db), 'op', { amount: 5, userId: 'u', recipient: 'r' });
  assert.equal(first.created, true);
  assert.equal(blocked.created, false);
  db.operations[0].lease_expires_at = new Date(Date.now() - 1000).toISOString();
  const retry = await hooks.claimPayoutOperation(env(db), 'op', { amount: 5, userId: 'u', recipient: 'r' });
  assert.equal(retry.created, true);
  assert.equal(db.operations.length, 1);
  const calls = piHarness();
  const created = await hooks.createPayoutPayment(env(db), retry.operation, retry.leaseOwner, { amount: 5, metadata: { operationKey: 'op' } });
  assert.equal(created.pi_payment_id, 'pi-created');
  assert.equal(calls.filter((call) => call.path.endsWith('/payments') && call.method === 'POST').length, 1);
});

test('behavior: correlated incomplete payment recovers create/persist crash without a second create', async () => {
  const db = new FakeD1({ available: 10 });
  const claim = await hooks.claimPayoutOperation(env(db), 'op', { amount: 5, userId: 'u', recipient: 'r' });
  db.operations[0].status = 'creating';
  const incomplete = { identifier: 'pi-1', metadata: { type: 'admin_treasury_payout', operationKey: 'op' } };
  const calls = piHarness({ incomplete: [incomplete], get: { 'pi-1': { identifier: 'pi-1', user_uid: 'uid-u', amount: 5, direction: 'app_to_user', network: 'Pi Testnet', metadata: { type: 'admin_treasury_payout', operationKey: 'op' }, status: { developer_approved: true }, transaction: { txid: 'tx-1' } } } });
  await hooks.autoResolveIncompleteServerPayments(env(db), { pi_uid: 'u' });
  assert.equal(db.operations[0].pi_payment_id, 'pi-1');
  assert.equal(db.operations[0].status, 'approved');
  assert.equal(calls.filter((call) => call.path.endsWith('/payments') && call.method === 'POST').length, 0);
  assert.ok(claim.operation);
});

test('behavior: duplicate operation key creates one operation', async () => {
  const db = new FakeD1({ available: 20 });
  await hooks.claimPayoutOperation(env(db), 'same', { amount: 5, userId: 'u', recipient: 'r' });
  await hooks.claimPayoutOperation(env(db), 'same', { amount: 5, userId: 'u', recipient: 'r' });
  assert.equal(db.operations.filter((op) => op.operation_key === 'same').length, 1);
});

test('behavior: already approved skips approve and completes without creating payment', async () => {
  const db = new FakeD1({ operations: [{ operation_key: 'op', status: 'pi_created', amount: 2, user_id: 'u', recipient: 'r', pi_payment_id: 'pi-1', txid: null }] });
  const calls = piHarness({ get: { 'pi-1': { identifier: 'pi-1', user_uid: 'uid-u', amount: 2, direction: 'app_to_user', network: 'Pi Testnet', metadata: { type: 'admin_treasury_payout', operationKey: 'op' }, status: { developer_approved: true }, transaction: { txid: 'tx-1' } } } });
  await hooks.resumePayoutOperation(env(db), db.operations[0]);
  assert.equal(calls.filter((call) => call.path.endsWith('/approve')).length, 0);
  assert.equal(calls.filter((call) => call.path.endsWith('/payments') && call.method === 'POST').length, 0);
});

test('behavior: Current payment is already approved reconciles safely', async () => {
  const db = new FakeD1({ operations: [{ operation_key: 'op', status: 'pi_created', amount: 2, user_id: 'u', recipient: 'r', pi_payment_id: 'pi-1', txid: null }] });
  let reads = 0;
  const calls = piHarness({ get: () => (++reads === 1 ? { identifier: 'pi-1', user_uid: 'uid-u', amount: 2, direction: 'app_to_user', network: 'Pi Testnet', metadata: { type: 'admin_treasury_payout', operationKey: 'op' }, status: {}, transaction: { txid: 'tx-1' } } : { identifier: 'pi-1', user_uid: 'uid-u', amount: 2, direction: 'app_to_user', network: 'Pi Testnet', metadata: { type: 'admin_treasury_payout', operationKey: 'op' }, status: { developer_approved: true }, transaction: { txid: 'tx-1' } }), approve: () => response({ error: 'Current payment is already approved' }, false, 409) });
  await hooks.resumePayoutOperation(env(db), db.operations[0]);
  assert.equal(calls.filter((call) => call.path.endsWith('/approve')).length, 1);
  assert.equal(calls.filter((call) => call.path.endsWith('/payments') && call.method === 'POST').length, 0);
});

test('behavior: approve timeout moves operation to reconciliation_required without new payment', async () => {
  const db = new FakeD1({ operations: [{ operation_key: 'op', status: 'pi_created', amount: 2, user_id: 'u', recipient: 'r', pi_payment_id: 'pi-1', txid: null }] });
  const calls = piHarness({ get: { 'pi-1': { status: {} } }, approve: () => { throw new Error('approve timeout'); } });
  await hooks.resumePayoutOperation(env(db), db.operations[0]);
  assert.equal(db.operations[0].status, 'reconciliation_required');
  assert.equal(calls.filter((call) => call.path.endsWith('/payments') && call.method === 'POST').length, 0);
});

test('behavior: cancelled Pi payment moves operation to cancelled', async () => {
  const db = new FakeD1({ operations: [{ operation_key: 'op', status: 'pi_created', amount: 2, user_id: 'u', recipient: 'r', pi_payment_id: 'pi-1', txid: null }] });
  piHarness({ get: { 'pi-1': { status: { cancelled: true } } } });
  await hooks.resumePayoutOperation(env(db), db.operations[0]);
  assert.equal(db.operations[0].status, 'cancelled');
});

test('behavior: already completed skips approve and complete and records one transaction', async () => {
  const db = new FakeD1({ operations: [{ operation_key: 'op', status: 'pi_created', amount: 2, user_id: 'u', recipient: 'r', pi_payment_id: 'pi-1', txid: null }] });
  const calls = piHarness({ get: { 'pi-1': { identifier: 'pi-1', user_uid: 'uid-u', amount: 2, direction: 'app_to_user', network: 'Pi Testnet', metadata: { type: 'admin_treasury_payout', operationKey: 'op' }, status: { developer_completed: true }, transaction: { txid: 'tx-1' } } } });
  await hooks.resumePayoutOperation(env(db), db.operations[0]);
  assert.equal(calls.filter((call) => call.path.endsWith('/approve')).length, 0);
  assert.equal(calls.filter((call) => call.path.endsWith('/complete')).length, 0);
  assert.equal(db.transactions.length, 1);
  assert.equal(db.operations[0].status, 'completed');
});

test('behavior: complete timeout moves operation to reconciliation_required', async () => {
  const db = new FakeD1({ operations: [{ operation_key: 'op', status: 'approved', amount: 2, user_id: 'u', recipient: 'r', pi_payment_id: 'pi-1', txid: 'tx-1' }] });
  const calls = piHarness({ get: { 'pi-1': { status: {}, transaction: { txid: 'tx-1' } } }, complete: () => { throw new Error('timeout'); } });
  await hooks.resumePayoutOperation(env(db), db.operations[0]);
  assert.equal(db.operations[0].status, 'reconciliation_required');
  assert.equal(calls.filter((call) => call.path.endsWith('/payments') && call.method === 'POST').length, 0);
});

test('behavior: stale operation without payment is durably reconciled', async () => {
  const db = new FakeD1({ operations: [{ operation_key: 'stale', status: 'creating', amount: 2, user_id: 'u', recipient: 'r', pi_payment_id: null }] });
  await hooks.reconcileStalePayoutOperations(env(db));
  assert.equal(db.operations[0].status, 'reconciliation_required');
});

test('behavior: all stale payout states follow guarded reconciliation paths', async () => {
  for (const status of ['reserved', 'creating', 'approving', 'completing', 'reconciliation_required']) {
    const db = new FakeD1({ operations: [{ operation_key: `stale-${status}`, status, amount: 1, user_id: 'u', recipient: 'r', pi_payment_id: null }] });
    await hooks.reconcileStalePayoutOperations(env(db));
    assert.equal(db.operations[0].status, 'reconciliation_required', status);
  }
});

test('behavior: orphan payout incomplete payment is queued, never silently skipped', async () => {
  const db = new FakeD1();
  piHarness({ incomplete: [{ identifier: 'orphan', metadata: { type: 'admin_treasury_payout', operationKey: 'missing' } }] });
  await hooks.autoResolveIncompleteServerPayments(env(db), { pi_uid: 'u' });
  assert.equal(db.queue.length, 1);
  assert.equal(db.queue[0].status, 'reconciliation_required');
});

test('behavior: duplicate completion creates one transaction and remains completed', async () => {
  const db = new FakeD1({ operations: [{ operation_key: 'op', status: 'approved', amount: 2, user_id: 'u', recipient: 'r', pi_payment_id: 'pi-1', txid: 'tx-1' }] });
  const operation = db.operations[0];
  const payment = { identifier: 'pi-1', user_uid: 'uid-u', amount: 2, direction: 'app_to_user', network: 'Pi Testnet', metadata: { type: 'admin_treasury_payout', operationKey: 'op' }, status: { developer_completed: true }, transaction: { txid: 'tx-1' } };
  await hooks.persistCompletedPayout(env(db), operation, 'pi-1', 'tx-1', payment);
  await hooks.persistCompletedPayout(env(db), db.operations[0], 'pi-1', 'tx-1', payment);
  assert.equal(db.transactions.length, 1);
  assert.equal(db.operations[0].status, 'completed');
});

test('behavior: transition matrix rejects SQL-inconsistent transition requests before D1', async () => {
  const db = new FakeD1();
  await assert.rejects(() => hooks.transitionPayoutOperation(env(db), 'missing', ['reserved'], 'approved'), /Invalid payout transition/);
  assert.equal(hooks.PAYOUT_TRANSITIONS.reserved.includes('approved'), false);
});
