import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function createMockDb() {
  const users = [
    { id: 'user_admin', pi_uid: 'uid_admin_123', username: 'admin_pioneer', role: 'admin', is_admin: 1, status: 'active', created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'user_regular', pi_uid: 'uid_regular_456', username: 'regular_pioneer', role: 'user', is_admin: 0, status: 'active', created_at: '2026-01-01T00:00:00.000Z' }
  ];
  const transactions = [
    { id: 'tx_1', payment_intent_id: 'pi_1', pi_payment_id: 'pay_1', pi_txid: 'txid_1', user_id: 'user_regular', amount: 10.0, type: 'platform_fee', status: 'completed', created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'tx_2', payment_intent_id: 'pi_2', pi_payment_id: 'pay_2', pi_txid: 'txid_2', user_id: 'user_regular', amount: 5.5, type: 'platform_fee', status: 'completed', created_at: '2026-01-01T00:00:00.000Z' }
  ];
  const payout_operations = [];

  return {
    users,
    transactions,
    payout_operations,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.includes('FROM users WHERE id = ?1')) {
                return users.find(u => u.id === params[0]) || null;
              }
              if (sql.includes('FROM users WHERE pi_uid = ?1')) {
                return users.find(u => u.pi_uid === params[0]) || null;
              }
              if (sql.includes('FROM payout_operations WHERE idempotency_key = ?1')) {
                return payout_operations.find(p => p.idempotency_key === params[0]) || null;
              }
              if (sql.includes("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND (type='platform_fee' OR type IS NULL)")) {
                const sum = transactions.filter(t => t.status === 'completed' && (t.type === 'platform_fee' || !t.type)).reduce((acc, t) => acc + t.amount, 0);
                return { total: sum };
              }
              if (sql.includes("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND type='admin_payout'")) {
                const sum = transactions.filter(t => t.status === 'completed' && t.type === 'admin_payout').reduce((acc, t) => acc + t.amount, 0);
                return { total: sum };
              }
              return null;
            },
            async all() {
              return { results: [] };
            },
            async run() {
              if (sql.includes('INSERT INTO transactions')) {
                transactions.push({
                  id: params[0],
                  payment_intent_id: params[1],
                  pi_payment_id: params[2],
                  pi_txid: params[3],
                  user_id: params[4],
                  amount: params[5],
                  type: 'admin_payout',
                  status: 'completed',
                  created_at: params[6]
                });
                return { success: true };
              }
              if (sql.includes('INSERT INTO payout_operations')) {
                payout_operations.push({
                  id: params[0],
                  idempotency_key: params[1],
                  user_id: params[2],
                  amount: params[3],
                  type: params[4],
                  status: 'pending',
                  metadata: params[5],
                  created_at: params[6],
                  updated_at: params[6]
                });
                return { success: true };
              }
              if (sql.includes('UPDATE payout_operations SET status=')) {
                const op = payout_operations.find(p => p.idempotency_key === params[3]);
                if (op) {
                  op.status = 'completed';
                  op.pi_payment_id = params[0];
                  op.pi_txid = params[1];
                  op.updated_at = params[2];
                }
                return { success: true };
              }
              return { success: true };
            }
          };
        },
        async first() {
          if (sql.includes("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND (type='platform_fee' OR type IS NULL)")) {
            const sum = transactions.filter(t => t.status === 'completed' && (t.type === 'platform_fee' || !t.type)).reduce((acc, t) => acc + t.amount, 0);
            return { total: sum };
          }
          if (sql.includes("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND type='admin_payout'")) {
            const sum = transactions.filter(t => t.status === 'completed' && t.type === 'admin_payout').reduce((acc, t) => acc + t.amount, 0);
            return { total: sum };
          }
          if (sql.includes('SELECT COUNT(*) AS c FROM users')) return { c: users.length };
          if (sql.includes('SELECT COUNT(*) AS c FROM listings')) return { c: 0 };
          if (sql.includes('SELECT COUNT(*) AS c FROM rentals')) return { c: 0 };
          if (sql.includes('SELECT COUNT(*) AS c FROM reports')) return { c: 0 };
          return null;
        },
        async all() {
          return { results: [] };
        }
      };
    }
  };
}

function createMockKv() {
  const store = new Map();
  return {
    async get(key, type) {
      const val = store.get(key);
      if (!val) return null;
      if (type === 'json') return JSON.parse(val);
      return val;
    },
    async put(key, value) {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    async delete(key) {
      store.delete(key);
    }
  };
}

async function setupSession(kv, user) {
  const token = `sess_${crypto.randomUUID()}`;
  const hash = await sha256(token);
  await kv.put(`session:${hash}`, JSON.stringify({
    uid: user.pi_uid,
    username: user.username,
    role: user.role
  }));
  return token;
}

test('Admin A2U Payout: non-admin request is rejected with 403', async () => {
  const db = createMockDb();
  const kv = createMockKv();
  const token = await setupSession(kv, db.users[1]);

  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    PI_API_KEY: 'test_api_key_valid_64_characters_long_1234567890abcdef1234567890abcdef',
    ADMIN_PI_UIDS: 'uid_admin_123'
  };

  const req = new Request('http://localhost/api/admin/payout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'key_non_admin'
    },
    body: JSON.stringify({ amount: 5 })
  });

  const res = await worker.fetch(req, env);
  assert.equal(res.status, 403);
});

test('Admin A2U Payout: Missing Idempotency-Key is rejected with 400', async () => {
  const db = createMockDb();
  const kv = createMockKv();
  const token = await setupSession(kv, db.users[0]);

  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    PI_API_KEY: 'test_api_key_valid_64_characters_long_1234567890abcdef1234567890abcdef',
    ADMIN_PI_UIDS: 'uid_admin_123'
  };

  const req = new Request('http://localhost/api/admin/payout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ amount: 5 })
  });

  const res = await worker.fetch(req, env);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, 'Idempotency-Key برای پرداخت الزامی است');
});

test('Admin A2U Payout: amount exceeding available treasury balance is rejected with 400', async () => {
  const db = createMockDb();
  const kv = createMockKv();
  const token = await setupSession(kv, db.users[0]);

  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    PI_API_KEY: 'test_api_key_valid_64_characters_long_1234567890abcdef1234567890abcdef',
    ADMIN_PI_UIDS: 'uid_admin_123'
  };

  const req = new Request('http://localhost/api/admin/payout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'key_exceed_balance'
    },
    body: JSON.stringify({ amount: 100 }) // Total available is 15.5
  });

  const res = await worker.fetch(req, env);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /موجودی واقعی/);
});

test('Admin A2U Payout: successful official Pi A2U flow completes and saves to D1', async () => {
  const db = createMockDb();
  const kv = createMockKv();
  const token = await setupSession(kv, db.users[0]);

  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    PI_API_KEY: 'test_api_key_valid_64_characters_long_1234567890abcdef1234567890abcdef',
    ADMIN_PI_UIDS: 'uid_admin_123'
  };

  // Mock global fetch for Pi API calls
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes('/payments/incomplete_server_payments')) {
      return new Response(JSON.stringify({ incomplete_server_payments: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.endsWith('/payments') && opts.method === 'POST') {
      const payload = JSON.parse(opts.body);
      assert.equal(payload.payment.uid, 'uid_admin_123');
      assert.equal(payload.payment.amount, 10);
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_789',
        amount: 10,
        status: { developer_approved: false, developer_completed: false }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('/payments/pi_pay_a2u_789/approve')) {
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_789',
        amount: 10,
        status: { developer_approved: true, transaction_verified: true },
        transaction: { txid: 'blockchain_txid_real_999' }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('/payments/pi_pay_a2u_789/complete')) {
      const payload = JSON.parse(opts.body);
      assert.equal(payload.txid, 'blockchain_txid_real_999');
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_789',
        amount: 10,
        status: { developer_completed: true }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, opts);
  };

  try {
    const req = new Request('http://localhost/api/admin/payout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'key_success_payout_789'
      },
      body: JSON.stringify({ amount: 10, memo: 'Test treasury payout' })
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.paymentId, 'pi_pay_a2u_789');
    assert.equal(data.txid, 'blockchain_txid_real_999');
    assert.equal(data.amount, 10);
    assert.equal(data.recipient, 'admin_pioneer');

    // Verify persisted in mock D1
    const payoutTx = db.transactions.find(t => t.type === 'admin_payout');
    assert.ok(payoutTx);
    assert.equal(payoutTx.pi_payment_id, 'pi_pay_a2u_789');
    assert.equal(payoutTx.pi_txid, 'blockchain_txid_real_999');
    assert.equal(payoutTx.amount, 10);
    assert.equal(payoutTx.status, 'completed');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Admin A2U Payout: Pi API failure returns 502 and does NOT insert settlement or reduce balance', async () => {
  const db = createMockDb();
  const kv = createMockKv();
  const token = await setupSession(kv, db.users[0]);

  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    PI_API_KEY: 'test_api_key_valid_64_characters_long_1234567890abcdef1234567890abcdef',
    ADMIN_PI_UIDS: 'uid_admin_123'
  };

  const initialTxCount = db.transactions.length;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes('/payments/incomplete_server_payments')) {
      return new Response(JSON.stringify({ incomplete_server_payments: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.endsWith('/payments') && opts.method === 'POST') {
      return new Response(JSON.stringify({
        error_message: 'Pi Network A2U service temporarily unavailable',
        error_code: 'service_unavailable'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, opts);
  };

  try {
    const req = new Request('http://localhost/api/admin/payout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'key_fail_payout_502'
      },
      body: JSON.stringify({ amount: 5, memo: 'Failing payout attempt' })
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 502);
    const data = await res.json();
    assert.match(data.error, /Pi Network|شبکه پای/);

    // Verify NO transaction was inserted in D1
    assert.equal(db.transactions.length, initialTxCount);
    const payoutTx = db.transactions.find(t => t.type === 'admin_payout');
    assert.equal(payoutTx, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Admin A2U Payout: payout with destination wallet address records metadata and returns real txid', async () => {
  const db = createMockDb();
  const kv = createMockKv();
  const token = await setupSession(kv, db.users[0]);

  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    PI_API_KEY: 'test_api_key_valid_64_characters_long_1234567890abcdef1234567890abcdef',
    ADMIN_PI_UIDS: 'uid_admin_123'
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes('/payments/incomplete_server_payments')) {
      return new Response(JSON.stringify({ incomplete_server_payments: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.endsWith('/payments') && opts.method === 'POST') {
      const payload = JSON.parse(opts.body);
      assert.equal(payload.payment.metadata.targetWallet, 'GD5XYZ9876543210ABCDEF');
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_wallet_101',
        amount: 8,
        status: { developer_approved: false, developer_completed: false }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('/payments/pi_pay_a2u_wallet_101/approve')) {
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_wallet_101',
        amount: 8,
        status: { developer_approved: true, transaction_verified: true },
        transaction: { txid: 'real_chain_txid_wallet_202' }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('/payments/pi_pay_a2u_wallet_101/complete')) {
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_wallet_101',
        amount: 8,
        status: { developer_completed: true }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, opts);
  };

  try {
    const req = new Request('http://localhost/api/admin/payout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'key_wallet_101'
      },
      body: JSON.stringify({ amount: 8, walletAddress: 'GD5XYZ9876543210ABCDEF', memo: 'Direct settlement' })
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.txid, 'real_chain_txid_wallet_202');
    assert.equal(data.amount, 8);

    const payoutTx = db.transactions.find(t => t.pi_payment_id === 'pi_pay_a2u_wallet_101');
    assert.ok(payoutTx);
    assert.equal(payoutTx.pi_txid, 'real_chain_txid_wallet_202');
    assert.equal(payoutTx.amount, 8);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Admin A2U Payout: Idempotent Approve recovery when Pi API returns "Current payment is already approved"', async () => {
  const db = createMockDb();
  const kv = createMockKv();
  const token = await setupSession(kv, db.users[0]);

  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    PI_API_KEY: 'test_api_key_valid_64_characters_long_1234567890abcdef1234567890abcdef',
    ADMIN_PI_UIDS: 'uid_admin_123',
    IS_TEST: true
  };

  let approveAttempted = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes('/payments/incomplete_server_payments')) {
      return new Response(JSON.stringify({ incomplete_server_payments: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.endsWith('/payments') && opts.method === 'POST') {
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_already_app_test',
        amount: 5,
        status: { developer_approved: false, developer_completed: false }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('/payments/pi_pay_a2u_already_app_test/approve')) {
      approveAttempted++;
      // Simulating Pi Platform returning 400 "Current payment is already approved"
      return new Response(JSON.stringify({
        error_message: 'Current payment is already approved'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.endsWith('/payments/pi_pay_a2u_already_app_test') && (!opts || !opts.method || opts.method === 'GET')) {
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_already_app_test',
        amount: 5,
        status: { developer_approved: true, transaction_verified: true },
        transaction: { txid: 'blockchain_txid_recovered_app' }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('/payments/pi_pay_a2u_already_app_test/complete')) {
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_already_app_test',
        amount: 5,
        status: { developer_completed: true }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, opts);
  };

  try {
    const req = new Request('http://localhost/api/admin/payout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'key_approve_recovery_test'
      },
      body: JSON.stringify({ amount: 5, memo: 'Test approve idempotency' })
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.txid, 'blockchain_txid_recovered_app');
    assert.equal(approveAttempted, 1);

    const payoutTx = db.transactions.find(t => t.pi_payment_id === 'pi_pay_a2u_already_app_test');
    assert.ok(payoutTx);
    assert.equal(payoutTx.pi_txid, 'blockchain_txid_recovered_app');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Admin A2U Payout: Idempotent Complete recovery when Pi API returns "Current payment is already completed"', async () => {
  const db = createMockDb();
  const kv = createMockKv();
  const token = await setupSession(kv, db.users[0]);

  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    PI_API_KEY: 'test_api_key_valid_64_characters_long_1234567890abcdef1234567890abcdef',
    ADMIN_PI_UIDS: 'uid_admin_123',
    IS_TEST: true
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes('/payments/incomplete_server_payments')) {
      return new Response(JSON.stringify({ incomplete_server_payments: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.endsWith('/payments') && opts.method === 'POST') {
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_already_comp_test',
        amount: 5,
        status: { developer_approved: true, transaction_verified: true },
        transaction: { txid: 'blockchain_txid_comp_test' }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.endsWith('/payments/pi_pay_a2u_already_comp_test') && (!opts || !opts.method || opts.method === 'GET')) {
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_already_comp_test',
        amount: 5,
        status: { developer_approved: true, transaction_verified: true, developer_completed: true },
        transaction: { txid: 'blockchain_txid_comp_test' }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('/payments/pi_pay_a2u_already_comp_test/complete')) {
      return new Response(JSON.stringify({
        error_message: 'Current payment is already completed'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, opts);
  };

  try {
    const req = new Request('http://localhost/api/admin/payout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'key_complete_recovery_test'
      },
      body: JSON.stringify({ amount: 5, memo: 'Test complete idempotency' })
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.txid, 'blockchain_txid_comp_test');

    const payoutTx = db.transactions.find(t => t.pi_payment_id === 'pi_pay_a2u_already_comp_test');
    assert.ok(payoutTx);
    assert.equal(payoutTx.status, 'completed');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Admin A2U Payout: Idempotency-Key retry reuses cached operation and avoids duplicate execution', async () => {
  const db = createMockDb();
  const kv = createMockKv();
  const token = await setupSession(kv, db.users[0]);

  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    PI_API_KEY: 'test_api_key_valid_64_characters_long_1234567890abcdef1234567890abcdef',
    ADMIN_PI_UIDS: 'uid_admin_123',
    IS_TEST: true
  };

  let piCreateCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes('/payments/incomplete_server_payments')) {
      return new Response(JSON.stringify({ incomplete_server_payments: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.endsWith('/payments') && opts.method === 'POST') {
      piCreateCalls++;
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_idemp_key_1',
        amount: 3,
        status: { developer_approved: false, developer_completed: false }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('/payments/pi_pay_a2u_idemp_key_1/approve')) {
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_idemp_key_1',
        amount: 3,
        status: { developer_approved: true, transaction_verified: true },
        transaction: { txid: 'chain_txid_idemp_1' }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('/payments/pi_pay_a2u_idemp_key_1/complete')) {
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_idemp_key_1',
        amount: 3,
        status: { developer_completed: true }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, opts);
  };

  try {
    const stableIdempotencyKey = 'unique_op_uuid_12345';

    // First attempt: executes normally
    const req1 = new Request('http://localhost/api/admin/payout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': stableIdempotencyKey
      },
      body: JSON.stringify({ amount: 3, memo: 'First attempt' })
    });
    const res1 = await worker.fetch(req1, env);
    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    assert.equal(data1.success, true);
    assert.equal(data1.txid, 'chain_txid_idemp_1');
    assert.equal(piCreateCalls, 1);

    // Second attempt (retry with the exact same Idempotency-Key): should return idempotent 200 without creating new payment
    const req2 = new Request('http://localhost/api/admin/payout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': stableIdempotencyKey
      },
      body: JSON.stringify({ amount: 3, memo: 'Retry attempt' })
    });
    const res2 = await worker.fetch(req2, env);
    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    assert.equal(data2.success, true);
    assert.equal(data2.txid, 'chain_txid_idemp_1');
    assert.equal(piCreateCalls, 1); // No new Pi payment created on replay!
  } finally {
    globalThis.fetch = originalFetch;
  }
});

