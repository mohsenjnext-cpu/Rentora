import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function createMockDb() {
  const users = [
    { id: 'user_admin', pi_uid: 'uid_admin_123', username: 'admin_pioneer', role: 'admin', is_admin: 1, status: 'active', created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'user_regular', pi_uid: 'uid_regular_456', username: 'regular_pioneer', role: 'user', is_admin: 0, status: 'active', created_at: '2026-01-01T00:00:00.000Z' }
  ];
  const transactions = [
    { id: 'tx_1', pi_payment_id: 'pay_1', pi_txid: 'txid_1', user_id: 'user_regular', amount: 10, type: 'platform_fee', status: 'completed', created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'tx_2', pi_payment_id: 'pay_2', pi_txid: 'txid_2', user_id: 'user_regular', amount: 5.5, type: 'platform_fee', status: 'completed', created_at: '2026-01-01T00:00:00.000Z' }
  ];
  const payoutOperations = [];

  function sumTransactions(type) {
    return transactions.filter(t => t.status === 'completed' && (type ? t.type === type : (t.type === 'platform_fee' || !t.type))).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }

  return {
    users, transactions, payoutOperations,
    prepare(sql) {
      const query = {
        async first() {
          if (sql.includes("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND (type='platform_fee' OR type IS NULL)")) return { total: sumTransactions() };
          if (sql.includes("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND type='admin_payout'")) return { total: sumTransactions('admin_payout') };
          if (sql.includes('SELECT COUNT(*) AS c FROM users')) return { c: users.length };
          if (sql.includes('SELECT COUNT(*) AS c FROM listings')) return { c: 0 };
          if (sql.includes('SELECT COUNT(*) AS c FROM rentals')) return { c: 0 };
          if (sql.includes('SELECT COUNT(*) AS c FROM reports')) return { c: 0 };
          return null;
        },
        bind(...params) {
          return {
            async first() {
              if (sql.includes('FROM users WHERE id = ?1')) return users.find(u => u.id === params[0]) || null;
              if (sql.includes('FROM users WHERE pi_uid = ?1')) return users.find(u => u.pi_uid === params[0]) || null;
              if (sql.includes('FROM payout_operations WHERE operation_key = ?1')) return payoutOperations.find(p => p.operation_key === params[0]) || null;
              if (sql.includes("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND (type='platform_fee' OR type IS NULL)")) return { total: sumTransactions() };
              if (sql.includes("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND type='admin_payout'")) return { total: sumTransactions('admin_payout') };
              if (sql.includes('SELECT COUNT(*) AS c FROM users')) return { c: users.length };
              if (sql.includes('SELECT COUNT(*) AS c FROM listings')) return { c: 0 };
              if (sql.includes('SELECT COUNT(*) AS c FROM rentals')) return { c: 0 };
              if (sql.includes('SELECT COUNT(*) AS c FROM reports')) return { c: 0 };
              return null;
            },
            async all() { return { results: [] }; },
            async run() {
              if (sql.includes('INSERT INTO payout_operations')) {
                payoutOperations.push({ id: params[0], operation_key: params[1], status: 'reserved', amount: params[2], user_id: params[3], recipient: params[4], created_at: params[5], updated_at: params[5], reservation_expires_at: params[6] });
              } else if (sql.includes('UPDATE payout_operations SET')) {
                const key = params[params.length - 1];
                const op = payoutOperations.find(p => p.operation_key === key);
                if (op) {
                  op.status = params[0];
                  op.updated_at = params[1];
                  if (params[2] !== undefined) op.pi_payment_id = params[2];
                  if (params[3] !== undefined) op.txid = params[3];
                }
              } else if (sql.includes('INSERT INTO transactions')) {
                transactions.push({ id: params[0], payment_intent_id: params[1], pi_payment_id: params[2], pi_txid: params[3], user_id: params[4], amount: params[5], type: params[6], status: 'completed', created_at: params[7] });
              }
              return { success: true };
            }
          };
        }
      };
      return query;
    }
  };
}

function createMockKv() {
  const store = new Map();
  return {
    async get(key, type) {
      const value = store.get(key);
      if (value == null) return null;
      return type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value) { store.set(key, typeof value === 'string' ? value : JSON.stringify(value)); },
    async delete(key) { store.delete(key); }
  };
}

async function setupSession(kv, user) {
  const token = 'sess_' + crypto.randomUUID();
  await kv.put('session:' + await sha256(token), JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));
  return token;
}

function envFor(db, kv) {
  return { RENTORA_DB: db, RENTORA_KV: kv, PI_API_KEY: 'test_api_key_valid_64_characters_long_1234567890abcdef1234567890abcdef', ADMIN_PI_UIDS: 'uid_admin_123', IS_TEST: true };
}

test('Admin A2U rejects non-admin callers', async () => {
  const db = createMockDb(), kv = createMockKv(), token = await setupSession(kv, db.users[1]);
  const res = await worker.fetch(new Request('http://localhost/api/admin/payout', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': 'non_admin' }, body: JSON.stringify({ amount: 5 }) }), envFor(db, kv));
  assert.equal(res.status, 403);
});

test('Admin A2U requires Idempotency-Key', async () => {
  const db = createMockDb(), kv = createMockKv(), token = await setupSession(kv, db.users[0]);
  const res = await worker.fetch(new Request('http://localhost/api/admin/payout', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 5 }) }), envFor(db, kv));
  assert.equal(res.status, 400);
});

test('Admin A2U enforces available treasury balance', async () => {
  const db = createMockDb(), kv = createMockKv(), token = await setupSession(kv, db.users[0]);
  const res = await worker.fetch(new Request('http://localhost/api/admin/payout', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': 'over_balance' }, body: JSON.stringify({ amount: 100 }) }), envFor(db, kv));
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /موجودی واقعی/);
});

test('Admin A2U uses the D1 operation_key state and is idempotent', async () => {
  const db = createMockDb(), kv = createMockKv(), token = await setupSession(kv, db.users[0]), env = envFor(db, kv);
  let createCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('/payments/incomplete_server_payments')) return new Response(JSON.stringify({ incomplete_server_payments: [] }), { status: 200 });
    if (u.endsWith('/payments') && opts?.method === 'POST') {
      createCalls++;
      return new Response(JSON.stringify({ identifier: 'pay_test_1', amount: 5, status: { developer_approved: false, developer_completed: false } }), { status: 200 });
    }
    if (u.includes('/payments/pay_test_1/approve')) return new Response(JSON.stringify({ identifier: 'pay_test_1', amount: 5, status: { developer_approved: true, transaction_verified: true }, transaction: { txid: 'tx_test_1' } }), { status: 200 });
    if (u.includes('/payments/pay_test_1/complete')) return new Response(JSON.stringify({ identifier: 'pay_test_1', amount: 5, status: { developer_completed: true } }), { status: 200 });
    return originalFetch(url, opts);
  };

  try {
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': 'stable_key_1' };
    const first = await worker.fetch(new Request('http://localhost/api/admin/payout', { method: 'POST', headers, body: JSON.stringify({ amount: 5 }) }), env);
    assert.equal(first.status, 200);
    const firstData = await first.json();
    assert.equal(firstData.paymentId, 'pay_test_1');
    assert.equal(createCalls, 1);
    assert.equal(db.payoutOperations[0].operation_key, 'stable_key_1');
    assert.equal(db.payoutOperations[0].status, 'completed');

    const second = await worker.fetch(new Request('http://localhost/api/admin/payout', { method: 'POST', headers, body: JSON.stringify({ amount: 5 }) }), env);
    assert.equal(second.status, 200);
    const secondData = await second.json();
    assert.equal(secondData.idempotent, true);
    assert.equal(secondData.paymentId, 'pay_test_1');
    assert.equal(createCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// CI schema-alignment follow-up.


test('Admin A2U does not over-reserve treasury across sequential requests', async () => {
  const db = createMockDb(), kv = createMockKv(), token = await setupSession(kv, db.users[0]), env = envFor(db, kv);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('/payments/incomplete_server_payments')) return new Response(JSON.stringify({ incomplete_server_payments: [] }), { status: 200 });
    if (u.endsWith('/payments') && opts?.method === 'POST') {
      const payload = JSON.parse(opts.body);
      const id = payload.payment.metadata.idempotencyKey === 'reserve_one' ? 'reserve_pay_1' : 'reserve_pay_2';
      return new Response(JSON.stringify({ identifier: id, amount: 10, status: { developer_approved: false, developer_completed: false } }), { status: 200 });
    }
    if (u.includes('/payments/reserve_pay_1/approve') || u.includes('/payments/reserve_pay_2/approve')) {
      const id = u.includes('reserve_pay_1') ? 'reserve_pay_1' : 'reserve_pay_2';
      return new Response(JSON.stringify({ identifier: id, amount: 10, status: { developer_approved: true }, transaction: {} }), { status: 200 });
    }
    if (u.endsWith('/payments/reserve_pay_1') || u.endsWith('/payments/reserve_pay_2')) {
      const id = u.includes('reserve_pay_1') ? 'reserve_pay_1' : 'reserve_pay_2';
      return new Response(JSON.stringify({ identifier: id, amount: 10, status: { developer_approved: true, developer_completed: false }, transaction: {} }), { status: 200 });
    }
    return originalFetch(url, opts);
  };
  try {
    const first = await worker.fetch(new Request('http://localhost/api/admin/payout', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': 'reserve_one' },
      body: JSON.stringify({ amount: 10 })
    }), env);
    assert.equal(first.status, 202);

    const second = await worker.fetch(new Request('http://localhost/api/admin/payout', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': 'reserve_two' },
      body: JSON.stringify({ amount: 10 })
    }), env);
    assert.equal(second.status, 409);
    assert.equal(db.payoutOperations.find(p => p.operation_key === 'reserve_two')?.status, 'cancelled');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Admin A2U preserves failure without creating a settlement transaction', async () => {
  const db = createMockDb(), kv = createMockKv(), token = await setupSession(kv, db.users[0]), env = envFor(db, kv);
  const initialTxCount = db.transactions.length;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('/payments/incomplete_server_payments')) return new Response(JSON.stringify({ incomplete_server_payments: [] }), { status: 200 });
    if (u.endsWith('/payments') && opts?.method === 'POST') {
      return new Response(JSON.stringify({ error_message: 'Pi Network A2U service temporarily unavailable' }), { status: 500 });
    }
    return originalFetch(url, opts);
  };
  try {
    const res = await worker.fetch(new Request('http://localhost/api/admin/payout', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': 'failure_no_settlement' },
      body: JSON.stringify({ amount: 5 })
    }), env);
    assert.equal(res.status, 502);
    assert.equal(db.transactions.length, initialTxCount);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Admin A2U sends the destination wallet in Pi metadata', async () => {
  const db = createMockDb(), kv = createMockKv(), token = await setupSession(kv, db.users[0]), env = envFor(db, kv);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('/payments/incomplete_server_payments')) return new Response(JSON.stringify({ incomplete_server_payments: [] }), { status: 200 });
    if (u.endsWith('/payments') && opts?.method === 'POST') {
      const payload = JSON.parse(opts.body);
      assert.equal(payload.payment.metadata.targetWallet, 'GD5XYZ9876543210ABCDEF');
      return new Response(JSON.stringify({ identifier: 'wallet_pay_1', amount: 5, status: { developer_approved: false, developer_completed: false } }), { status: 200 });
    }
    if (u.includes('/payments/wallet_pay_1/approve')) return new Response(JSON.stringify({ identifier: 'wallet_pay_1', amount: 5, status: { developer_approved: true, transaction_verified: true }, transaction: { txid: 'wallet_tx_1' } }), { status: 200 });
    if (u.includes('/payments/wallet_pay_1/complete')) return new Response(JSON.stringify({ identifier: 'wallet_pay_1', amount: 5, status: { developer_completed: true } }), { status: 200 });
    return originalFetch(url, opts);
  };
  try {
    const res = await worker.fetch(new Request('http://localhost/api/admin/payout', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': 'wallet_metadata_1' },
      body: JSON.stringify({ amount: 5, walletAddress: 'GD5XYZ9876543210ABCDEF' })
    }), env);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.txid, 'wallet_tx_1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Admin A2U recovers when Pi reports the payment already approved', async () => {
  const db = createMockDb(), kv = createMockKv(), token = await setupSession(kv, db.users[0]), env = envFor(db, kv);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('/payments/incomplete_server_payments')) return new Response(JSON.stringify({ incomplete_server_payments: [] }), { status: 200 });
    if (u.endsWith('/payments') && opts?.method === 'POST') return new Response(JSON.stringify({ identifier: 'already_approved_1', amount: 5, status: { developer_approved: false, developer_completed: false } }), { status: 200 });
    if (u.includes('/payments/already_approved_1/approve')) return new Response(JSON.stringify({ error_message: 'Current payment is already approved' }), { status: 400 });
    if (u.endsWith('/payments/already_approved_1')) return new Response(JSON.stringify({ identifier: 'already_approved_1', amount: 5, status: { developer_approved: true, transaction_verified: true }, transaction: { txid: 'recovered_tx_1' } }), { status: 200 });
    if (u.includes('/payments/already_approved_1/complete')) return new Response(JSON.stringify({ identifier: 'already_approved_1', amount: 5, status: { developer_completed: true } }), { status: 200 });
    return originalFetch(url, opts);
  };
  try {
    const res = await worker.fetch(new Request('http://localhost/api/admin/payout', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': 'already_approved_1' },
      body: JSON.stringify({ amount: 5 })
    }), env);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.txid, 'recovered_tx_1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
