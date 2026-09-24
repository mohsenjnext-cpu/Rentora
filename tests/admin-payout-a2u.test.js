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
