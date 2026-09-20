import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function createA2UTestMockDb() {
  const users = [];
  const transactions = [];

  const db = {
    users,
    transactions,
    prepare(sql) {
      const makeHandler = (params = []) => ({
        sql,
        async first() {
          if (sql.includes('FROM users WHERE pi_uid = ?1')) {
            return users.find(u => u.pi_uid === params[0]) || null;
          }
          if (sql.includes('FROM users WHERE id = ?1') || sql.includes('FROM users WHERE id=?1')) {
            return users.find(u => u.id === params[0]) || null;
          }
          if (sql.includes("SELECT SUM(amount) AS total FROM transactions WHERE user_id=?1 AND status='completed' AND type IN ('commission', 'reward', 'earning', 'user_credit', 'deposit_refund')")) {
            const sum = transactions
              .filter(t => t.user_id === params[0] && t.status === 'completed' && ['commission', 'reward', 'earning', 'user_credit', 'deposit_refund'].includes(t.type))
              .reduce((acc, t) => acc + Number(t.amount || 0), 0);
            return { total: sum };
          }
          if (sql.includes("SELECT SUM(amount) AS total FROM transactions WHERE user_id=?1 AND status='completed' AND type='user_payout'")) {
            const sum = transactions
              .filter(t => t.user_id === params[0] && t.status === 'completed' && t.type === 'user_payout')
              .reduce((acc, t) => acc + Number(t.amount || 0), 0);
            return { total: sum };
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          if (sql.includes('INSERT INTO transactions')) {
            const isUserPayout = sql.includes("'user_payout'");
            const isConflict = transactions.find(t => t.pi_payment_id === params[2]);
            if (isConflict) {
              isConflict.pi_txid = params[3];
              isConflict.status = 'completed';
            } else {
              transactions.push({
                id: params[0],
                payment_intent_id: params[1],
                pi_payment_id: params[2],
                pi_txid: params[3],
                user_id: params[4],
                amount: params[5],
                type: isUserPayout ? 'user_payout' : (params[6] || 'platform_fee'),
                status: 'completed',
                created_at: (isUserPayout ? params[6] : params[7]) || new Date().toISOString()
              });
            }
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 1 } };
        },
        bind(...bindParams) {
          return makeHandler(bindParams);
        }
      });
      return makeHandler([]);
    }
  };

  return db;
}

function createA2UTestMockKv() {
  const store = new Map();
  return {
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, typeof value === 'string' ? value : JSON.stringify(value)); },
    async delete(key) { store.delete(key); },
    _store: store
  };
}

test('1. Balance check: User with sufficient earnings calculates correct withdrawable balance', async () => {
  const db = createA2UTestMockDb();
  const kv = createA2UTestMockKv();
  const env = { RENTORA_DB: db, RENTORA_KV: kv, PI_API_KEY: 'test_pi_key', IS_TEST: true };

  db.users.push({
    id: 'usr_alice',
    pi_uid: 'pi_uid_alice',
    username: 'alice_pioneer',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({})
  });

  // Alice earned 15 PI in commission and previously withdrew 5 PI
  db.transactions.push(
    { id: 'tx_1', user_id: 'usr_alice', amount: 15.0, type: 'commission', status: 'completed', pi_payment_id: 'p1', pi_txid: 't1' },
    { id: 'tx_2', user_id: 'usr_alice', amount: 5.0, type: 'user_payout', status: 'completed', pi_payment_id: 'p2', pi_txid: 't2' }
  );

  const token = 'token_alice_123';
  const tokenHash = await sha256(token);
  await kv.put(`session:${tokenHash}`, JSON.stringify({ uid: 'pi_uid_alice', username: 'alice_pioneer', role: 'user' }));

  const req = new Request('http://localhost/api/wallet/balance', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const res = await worker.fetch(req, env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.balance.totalEarned, 15.0);
  assert.equal(data.balance.totalPaidOut, 5.0);
  assert.equal(data.balance.withdrawable, 10.0);
});

test('2. Balance check: User with zero earnings returns 0 withdrawable balance', async () => {
  const db = createA2UTestMockDb();
  const kv = createA2UTestMockKv();
  const env = { RENTORA_DB: db, RENTORA_KV: kv, PI_API_KEY: 'test_pi_key', IS_TEST: true };

  db.users.push({
    id: 'usr_bob',
    pi_uid: 'pi_uid_bob',
    username: 'bob_pioneer',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({})
  });

  const token = 'token_bob_123';
  const tokenHash = await sha256(token);
  await kv.put(`session:${tokenHash}`, JSON.stringify({ uid: 'pi_uid_bob', username: 'bob_pioneer', role: 'user' }));

  const req = new Request('http://localhost/api/wallet/balance', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const res = await worker.fetch(req, env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.balance.withdrawable, 0);
});

test('3. Withdrawal rejected: Request exceeding available balance returns 400', async () => {
  const db = createA2UTestMockDb();
  const kv = createA2UTestMockKv();
  const env = { RENTORA_DB: db, RENTORA_KV: kv, PI_API_KEY: 'test_pi_key', IS_TEST: true };

  db.users.push({
    id: 'usr_alice',
    pi_uid: 'pi_uid_alice',
    username: 'alice_pioneer',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({})
  });

  db.transactions.push(
    { id: 'tx_1', user_id: 'usr_alice', amount: 5.0, type: 'commission', status: 'completed', pi_payment_id: 'p1', pi_txid: 't1' }
  );

  const token = 'token_alice_123';
  const tokenHash = await sha256(token);
  await kv.put(`session:${tokenHash}`, JSON.stringify({ uid: 'pi_uid_alice', username: 'alice_pioneer', role: 'user' }));

  const req = new Request('http://localhost/api/wallet/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ amount: 10.0 }) // Alice only has 5.0
  });

  const res = await worker.fetch(req, env);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /مبلغ درخواستی/);
});

test('4. Successful User A2U Payout: Complete cycle updates D1 ledger', async () => {
  const db = createA2UTestMockDb();
  const kv = createA2UTestMockKv();
  const env = { RENTORA_DB: db, RENTORA_KV: kv, PI_API_KEY: 'test_pi_key', IS_TEST: true };

  db.users.push({
    id: 'usr_alice',
    pi_uid: 'pi_uid_alice',
    username: 'alice_pioneer',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({})
  });

  db.transactions.push(
    { id: 'tx_earn_1', user_id: 'usr_alice', amount: 20.0, type: 'commission', status: 'completed', pi_payment_id: 'pe1', pi_txid: 'te1' }
  );

  const token = 'token_alice_123';
  const tokenHash = await sha256(token);
  await kv.put(`session:${tokenHash}`, JSON.stringify({ uid: 'pi_uid_alice', username: 'alice_pioneer', role: 'user' }));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const sUrl = String(url);
    if (sUrl.includes('/incomplete_server_payments')) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (sUrl.endsWith('/payments') && opts?.method === 'POST') {
      return new Response(JSON.stringify({ identifier: 'pay_a2u_user_001', status: { developer_approved: false } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (sUrl.includes('/payments/pay_a2u_user_001/approve')) {
      return new Response(JSON.stringify({ identifier: 'pay_a2u_user_001', status: { developer_approved: true }, transaction: { txid: 'horizon_tx_user_123' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (sUrl.includes('/payments/pay_a2u_user_001/complete')) {
      return new Response(JSON.stringify({ identifier: 'pay_a2u_user_001', status: { developer_completed: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const req = new Request('http://localhost/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ amount: 8.0, memo: 'My Payout' })
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.txid, 'horizon_tx_user_123');
    assert.equal(data.amount, 8.0);

    // Verify D1 record
    const payoutTx = db.transactions.find(t => t.type === 'user_payout');
    assert.ok(payoutTx);
    assert.equal(payoutTx.amount, 8.0);
    assert.equal(payoutTx.user_id, 'usr_alice');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('5. Failure handling: Pi create payment rejection returns 502 and preserves user balance', async () => {
  const db = createA2UTestMockDb();
  const kv = createA2UTestMockKv();
  const env = { RENTORA_DB: db, RENTORA_KV: kv, PI_API_KEY: 'test_pi_key', IS_TEST: true };

  db.users.push({
    id: 'usr_alice',
    pi_uid: 'pi_uid_alice',
    username: 'alice_pioneer',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({})
  });

  db.transactions.push(
    { id: 'tx_earn_1', user_id: 'usr_alice', amount: 10.0, type: 'commission', status: 'completed', pi_payment_id: 'pe1', pi_txid: 'te1' }
  );

  const token = 'token_alice_123';
  const tokenHash = await sha256(token);
  await kv.put(`session:${tokenHash}`, JSON.stringify({ uid: 'pi_uid_alice', username: 'alice_pioneer', role: 'user' }));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const sUrl = String(url);
    if (sUrl.includes('/incomplete_server_payments')) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (sUrl.endsWith('/payments') && opts?.method === 'POST') {
      return new Response(JSON.stringify({ error_message: 'Insufficient app wallet funds' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const req = new Request('http://localhost/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ amount: 5.0 })
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 502);

    // No user_payout should be recorded
    const payoutTx = db.transactions.find(t => t.type === 'user_payout');
    assert.equal(payoutTx, undefined);

    // Lock must be released
    const lock = await kv.get('user_payout_lock:usr_alice');
    assert.equal(lock, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('6. Concurrent withdrawals: Atomic KV lock prevents double-withdrawal race condition', async () => {
  const db = createA2UTestMockDb();
  const kv = createA2UTestMockKv();
  const env = { RENTORA_DB: db, RENTORA_KV: kv, PI_API_KEY: 'test_pi_key', IS_TEST: true };

  db.users.push({
    id: 'usr_alice',
    pi_uid: 'pi_uid_alice',
    username: 'alice_pioneer',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({})
  });

  db.transactions.push(
    { id: 'tx_earn_1', user_id: 'usr_alice', amount: 10.0, type: 'commission', status: 'completed', pi_payment_id: 'pe1', pi_txid: 'te1' }
  );

  const token = 'token_alice_123';
  const tokenHash = await sha256(token);
  await kv.put(`session:${tokenHash}`, JSON.stringify({ uid: 'pi_uid_alice', username: 'alice_pioneer', role: 'user' }));

  // Simulate an active lock from a request in-flight
  await kv.put('user_payout_lock:usr_alice', JSON.stringify({ amount: 10.0, requestedAt: new Date().toISOString() }));

  const req = new Request('http://localhost/api/wallet/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ amount: 10.0 })
  });

  const res = await worker.fetch(req, env);
  assert.equal(res.status, 429);
  const data = await res.json();
  assert.match(data.error, /در حال پردازش است/);
});

test('7. Security: User A cannot query or withdraw User B balance', async () => {
  const db = createA2UTestMockDb();
  const kv = createA2UTestMockKv();
  const env = { RENTORA_DB: db, RENTORA_KV: kv, PI_API_KEY: 'test_pi_key', IS_TEST: true };

  db.users.push(
    { id: 'usr_userA', pi_uid: 'pi_uid_A', username: 'user_a', role: 'user', status: 'active', metadata: JSON.stringify({}) },
    { id: 'usr_userB', pi_uid: 'pi_uid_B', username: 'user_b', role: 'user', status: 'active', metadata: JSON.stringify({}) }
  );

  // User B has 50 PI earned, User A has 0
  db.transactions.push(
    { id: 'tx_b1', user_id: 'usr_userB', amount: 50.0, type: 'commission', status: 'completed', pi_payment_id: 'pb1', pi_txid: 'tb1' }
  );

  const tokenA = 'token_user_a';
  const tokenAHash = await sha256(tokenA);
  await kv.put(`session:${tokenAHash}`, JSON.stringify({ uid: 'pi_uid_A', username: 'user_a', role: 'user' }));

  // User A checks balance
  const balanceReq = new Request('http://localhost/api/wallet/balance', {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const balanceRes = await worker.fetch(balanceReq, env);
  const balanceData = await balanceRes.json();
  assert.equal(balanceData.balance.withdrawable, 0); // User A has 0

  // User A tries to withdraw 50 PI (attempting to tap user B funds)
  const withdrawReq = new Request('http://localhost/api/wallet/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ amount: 50.0, userId: 'usr_userB' }) // Client userId tampering ignored
  });

  const withdrawRes = await worker.fetch(withdrawReq, env);
  assert.equal(withdrawRes.status, 400); // Rejected: user A has 0
});

test('8. Pi approve failure: Server returns 502, releases lock, and preserves user balance', async () => {
  const db = createA2UTestMockDb();
  const kv = createA2UTestMockKv();
  const env = { RENTORA_DB: db, RENTORA_KV: kv, PI_API_KEY: 'test_pi_key', IS_TEST: true };

  db.users.push({
    id: 'usr_alice',
    pi_uid: 'pi_uid_alice',
    username: 'alice_pioneer',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({})
  });

  db.transactions.push(
    { id: 'tx_earn_1', user_id: 'usr_alice', amount: 10.0, type: 'commission', status: 'completed', pi_payment_id: 'pe1', pi_txid: 'te1' }
  );

  const token = 'token_alice_123';
  const tokenHash = await sha256(token);
  await kv.put(`session:${tokenHash}`, JSON.stringify({ uid: 'pi_uid_alice', username: 'alice_pioneer', role: 'user' }));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const sUrl = String(url);
    if (sUrl.includes('/incomplete_server_payments')) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (sUrl.endsWith('/payments') && opts?.method === 'POST') {
      return new Response(JSON.stringify({ identifier: 'pay_a2u_user_002', status: { developer_approved: false } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (sUrl.includes('/payments/pay_a2u_user_002/approve')) {
      return new Response(JSON.stringify({ error_message: 'Server approval rejected by Pi Platform' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const req = new Request('http://localhost/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ amount: 5.0 })
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 502);

    // No user_payout should be recorded
    const payoutTx = db.transactions.find(t => t.type === 'user_payout');
    assert.equal(payoutTx, undefined);

    // Lock must be released
    const lock = await kv.get('user_payout_lock:usr_alice');
    assert.equal(lock, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('9. Blockchain txid timeout: Server returns HTTP 202 and records pending payout for auto-recovery', async () => {
  const db = createA2UTestMockDb();
  const kv = createA2UTestMockKv();
  const env = { RENTORA_DB: db, RENTORA_KV: kv, PI_API_KEY: 'test_pi_key', IS_TEST: true };

  db.users.push({
    id: 'usr_alice',
    pi_uid: 'pi_uid_alice',
    username: 'alice_pioneer',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({})
  });

  db.transactions.push(
    { id: 'tx_earn_1', user_id: 'usr_alice', amount: 10.0, type: 'commission', status: 'completed', pi_payment_id: 'pe1', pi_txid: 'te1' }
  );

  const token = 'token_alice_123';
  const tokenHash = await sha256(token);
  await kv.put(`session:${tokenHash}`, JSON.stringify({ uid: 'pi_uid_alice', username: 'alice_pioneer', role: 'user' }));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const sUrl = String(url);
    if (sUrl.includes('/incomplete_server_payments')) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (sUrl.endsWith('/payments') && opts?.method === 'POST') {
      return new Response(JSON.stringify({ identifier: 'pay_a2u_user_003', status: { developer_approved: false } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (sUrl.includes('/payments/pay_a2u_user_003/approve')) {
      return new Response(JSON.stringify({ identifier: 'pay_a2u_user_003', status: { developer_approved: true }, transaction: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (sUrl.endsWith('/payments/pay_a2u_user_003') && (!opts || !opts.method || opts.method === 'GET')) {
      // Horizon has not minted txid yet
      return new Response(JSON.stringify({ identifier: 'pay_a2u_user_003', status: { developer_approved: true }, transaction: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const req = new Request('http://localhost/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ amount: 5.0 })
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 202);
    const data = await res.json();
    assert.equal(data.pending, true);
    assert.equal(data.paymentId, 'pay_a2u_user_003');

    // Pending payment recorded in KV for recovery
    const pendingKv = await kv.get('pending_user_payout:pay_a2u_user_003');
    assert.ok(pendingKv);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('10. Security: No PI_API_KEY disclosure in any response', async () => {
  const db = createA2UTestMockDb();
  const kv = createA2UTestMockKv();
  const env = { RENTORA_DB: db, RENTORA_KV: kv, PI_API_KEY: 'SECRET_PI_API_KEY_NEVER_LEAK_9999', IS_TEST: true };

  db.users.push({
    id: 'usr_alice',
    pi_uid: 'pi_uid_alice',
    username: 'alice_pioneer',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({})
  });

  const token = 'token_alice_123';
  const tokenHash = await sha256(token);
  await kv.put(`session:${tokenHash}`, JSON.stringify({ uid: 'pi_uid_alice', username: 'alice_pioneer', role: 'user' }));

  const req = new Request('http://localhost/api/wallet/balance', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const res = await worker.fetch(req, env);
  const text = await res.text();
  assert.equal(text.includes('SECRET_PI_API_KEY_NEVER_LEAK_9999'), false);
});
