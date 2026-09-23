import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function createMockDb() {
  const users = [];
  const transactions = [];
  return {
    users,
    transactions,
    prepare(sql) {
      const handler = (params = []) => ({
        async first() {
          if (sql.includes('FROM users WHERE pi_uid = ?1')) return users.find(u => u.pi_uid === params[0]) || null;
          if (sql.includes('FROM users WHERE id = ?1') || sql.includes('FROM users WHERE id=?1')) return users.find(u => u.id === params[0]) || null;
          if (sql.includes("SELECT SUM(amount) AS total FROM transactions WHERE user_id=?1 AND status='completed' AND type IN ('commission', 'reward', 'earning', 'user_credit', 'deposit_refund')")) {
            const total = transactions.filter(t => t.user_id === params[0] && t.status === 'completed' && ['commission', 'reward', 'earning', 'user_credit', 'deposit_refund'].includes(t.type)).reduce((sum, t) => sum + Number(t.amount || 0), 0);
            return { total };
          }
          if (sql.includes("SELECT SUM(amount) AS total FROM transactions WHERE user_id=?1 AND status='completed' AND type='user_payout'")) {
            const total = transactions.filter(t => t.user_id === params[0] && t.status === 'completed' && t.type === 'user_payout').reduce((sum, t) => sum + Number(t.amount || 0), 0);
            return { total };
          }
          return null;
        },
        async all() { return { results: [] }; },
        async run() { return { meta: { changes: 0 } }; },
        bind(...bindParams) { return handler(bindParams); }
      });
      return handler([]);
    }
  };
}

function createMockKv() {
  const store = new Map();
  return {
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, typeof value === 'string' ? value : JSON.stringify(value)); },
    async delete(key) { store.delete(key); }
  };
}

async function seedSession(kv, token, session) {
  await kv.put(`session:${await sha256(token)}`, JSON.stringify(session));
}

test('Legacy user wallet withdrawal route is disabled with 410', async () => {
  const db = createMockDb();
  const kv = createMockKv();
  const env = { RENTORA_DB: db, RENTORA_KV: kv, PI_API_KEY: 'test_pi_key', IS_TEST: true };
  db.users.push({ id: 'usr_alice', pi_uid: 'pi_uid_alice', username: 'alice_pioneer', role: 'user', status: 'active', metadata: JSON.stringify({}) });
  const token = 'token_alice_123';
  await seedSession(kv, token, { uid: 'pi_uid_alice', username: 'alice_pioneer', role: 'user' });

  const response = await worker.fetch(new Request('http://localhost/api/wallet/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ amount: 5 })
  }), env);

  assert.equal(response.status, 410);
  const data = await response.json();
  assert.match(data.error, /disabled|deprecated|payout/i);
});

test('Wallet balance remains available while the legacy withdrawal route is disabled', async () => {
  const db = createMockDb();
  const kv = createMockKv();
  const env = { RENTORA_DB: db, RENTORA_KV: kv, PI_API_KEY: 'test_pi_key', IS_TEST: true };
  db.users.push({ id: 'usr_alice', pi_uid: 'pi_uid_alice', username: 'alice_pioneer', role: 'user', status: 'active', metadata: JSON.stringify({}) });
  db.transactions.push({ id: 'tx_earn_1', user_id: 'usr_alice', amount: 15, type: 'commission', status: 'completed', pi_payment_id: 'p1', pi_txid: 't1' });
  const token = 'token_alice_456';
  await seedSession(kv, token, { uid: 'pi_uid_alice', username: 'alice_pioneer', role: 'user' });

  const response = await worker.fetch(new Request('http://localhost/api/wallet/balance', {
    headers: { Authorization: `Bearer ${token}` }
  }), env);

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.balance.withdrawable, 15);
});
