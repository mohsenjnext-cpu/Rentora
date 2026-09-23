import test from 'node:test';
import assert from 'node:assert/strict';
import gateway from '../worker-gateway2.js';

function createMockD1() {
  const users = [
    { id: 'usr_renter', pi_uid: 'pi_renter_123', username: 'renter_pioneer', display_name: 'Renter Pioneer', avatar_url: '', role: 'user', status: 'active', metadata: '{"kycStatus":"verified"}', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' },
    { id: 'usr_admin', pi_uid: 'avina60', username: 'avina60', display_name: 'Admin Pioneer', avatar_url: '', role: 'admin', status: 'active', metadata: '{"kycStatus":"verified"}', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' }
  ];
  const listings = [
    { id: 'item_101', owner_user_id: 'usr_admin', title: 'Power Drill', description: 'Cordless drill', category: 'tools', location: 'Tehran', price_per_day: 0.002, deposit_amount: 0.01, platform_fee_rate: 0.05, status: 'active', metadata: '{}', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' }
  ];
  const rentals = [
    { id: 'rent_201', listing_id: 'item_101', renter_user_id: 'usr_renter', start_date: '2026-09-20', end_date: '2026-09-22', rental_amount: 0.004, deposit_amount: 0.01, platform_fee: 0.0002, total_amount: 0.0002, status: 'pending_payment', payment_status: 'unpaid', metadata: '{}', created_at: '2026-09-16T00:00:00Z', updated_at: '2026-09-16T00:00:00Z' }
  ];
  const intents = [
    { id: 'pii_301', rental_id: 'rent_201', user_id: 'usr_renter', amount: 0.0002, memo: 'Rentora Fee #rent_201', pi_payment_id: null, pi_txid: null, status: 'created', created_at: '2026-09-16T00:00:00Z', expires_at: '2026-09-17T00:00:00Z', updated_at: '2026-09-16T00:00:00Z' }
  ];
  const transactions = [];

  return {
    users,
    listings,
    rentals,
    intents,
    transactions,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('SELECT * FROM users WHERE pi_uid=?1')) {
                return users.find(u => u.pi_uid === args[0]) || null;
              }
              if (sql.includes('SELECT * FROM payment_intents WHERE id=?1 AND user_id=?2')) {
                return intents.find(i => i.id === args[0] && i.user_id === args[1]) || null;
              }
              if (sql.includes('SELECT * FROM payment_intents WHERE rental_id=?1')) {
                return intents.find(i => i.rental_id === args[0]) || null;
              }
              if (sql.includes('SELECT r.*, l.title')) {
                const r = rentals.find(rent => rent.id === args[0] && rent.renter_user_id === args[1]);
                if (!r) return null;
                const l = listings.find(lst => lst.id === r.listing_id);
                return { ...r, title: l?.title, listing_id: l?.id, price_per_day: l?.price_per_day, deposit_amount: l?.deposit_amount };
              }
              return null;
            },
            async all() {
              if (sql.includes('SELECT * FROM users')) return { results: [...users] };
              return { results: [] };
            },
            async run() {
              if (sql.includes("UPDATE payment_intents SET pi_payment_id=?1,pi_txid=?2,status='completed'")) {
                const intent = intents.find(i => i.id === args[3]);
                if (intent) { intent.pi_payment_id = args[0]; intent.pi_txid = args[1]; intent.status = 'completed'; return { meta: { changes: 1 } }; }
              }
              if (sql.includes("UPDATE payment_intents SET pi_payment_id=?1,status='approved'")) {
                const intent = intents.find(i => i.id === args[2]);
                if (intent) { intent.pi_payment_id = args[0]; intent.status = 'approved'; return { meta: { changes: 1 } }; }
              }
              if (sql.includes("UPDATE rentals SET payment_status='completed'")) {
                const rental = rentals.find(r => r.id === args[1]);
                if (rental) { rental.payment_status = 'completed'; rental.status = 'confirmed'; }
              }
              if (sql.includes("UPDATE rentals SET status='payment_approved'")) {
                const rental = rentals.find(r => r.id === args[1]);
                if (rental) rental.status = 'payment_approved';
              }
              if (sql.includes('INSERT OR IGNORE INTO transactions')) {
                if (!transactions.some(t => t.pi_payment_id === args[2] || t.pi_txid === args[3])) transactions.push({ pi_payment_id: args[2], pi_txid: args[3] });
              }
              return { meta: { changes: 1 } };
            }
          };
        }
      };
    },
    async batch(statements) {
      for (const st of statements) {
        if (st && typeof st.run === 'function') await st.run();
      }
      return [];
    }
  };
}

function createMockEnv(d1) {
  const kvStore = new Map();
  // Session hashes
  // sha256 of "renter_token" is computed synchronously for test
  return {
    RENTORA_DB: d1,
    RENTORA_KV: {
      async get(key) { return kvStore.get(key) || null; },
      async put(key, val) { kvStore.set(key, val); },
      async delete(key) { kvStore.delete(key); },
      _store: kvStore
    },
    PI_API_KEY: 'test_pi_api_key_123',
    PI_API_URL: 'https://api.minepi.com/v2',
    ADMIN_PI_UIDS: 'avina60',
    CORS_ORIGIN: ''
  };
}

async function sha256(val) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(val));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

test('CORS: OPTIONS preflight rejects a cross-origin request when CORS_ORIGIN is empty', async () => {
  const d1 = createMockD1();
  const env = createMockEnv(d1);
  const req = new Request('https://rentora.workers.dev/api/payments/approve', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://sandbox.minepi.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type, Authorization'
    }
  });

  const res = await gateway.fetch(req, env, {});
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});


test('CORS: OPTIONS preflight permits an explicitly configured origin', async () => {
  const d1 = createMockD1();
  const env = createMockEnv(d1);
  env.CORS_ORIGIN = 'https://app.example';
  const req = new Request('https://rentora.workers.dev/api/payments/approve', {
    method: 'OPTIONS',
    headers: { Origin: 'https://app.example', 'Access-Control-Request-Method': 'POST' }
  });
  const res = await gateway.fetch(req, env, {});
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://app.example');
});

test('Incomplete payment: anonymous requests are rejected before Pi API access', async () => {
  const env = createMockEnv(createMockD1());
  const req = new Request('https://rentora.workers.dev/api/payments/incomplete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId: 'pay_1', paymentIntentId: 'pii_301' })
  });
  const res = await gateway.fetch(req, env, {});
  assert.equal(res.status, 401);
});

test('Incomplete payment: another user cannot recover a renter payment intent', async () => {
  const d1 = createMockD1();
  const env = createMockEnv(d1);
  const tokenHash = await sha256('admin_token');
  await env.RENTORA_KV.put(`session:${tokenHash}`, JSON.stringify({ uid: 'avina60' }));
  const req = new Request('https://rentora.workers.dev/api/payments/incomplete', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin_token' },
    body: JSON.stringify({ paymentId: 'pay_1', paymentIntentId: 'pii_301' })
  });
  const res = await gateway.fetch(req, env, {});
  assert.equal(res.status, 404);
});

test('Incomplete payment: mismatched Pi metadata is rejected for the authenticated intent', async () => {
  const d1 = createMockD1();
  const env = createMockEnv(d1);
  const tokenHash = await sha256('renter_incomplete_token');
  await env.RENTORA_KV.put(`session:${tokenHash}`, JSON.stringify({ uid: 'pi_renter_123' }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    identifier: 'pay_1', user: { uid: 'pi_renter_123' }, amount: 0.0002,
    metadata: { paymentIntentId: 'forged_intent', rentalId: 'rent_201' }, status: {}
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const req = new Request('https://rentora.workers.dev/api/payments/incomplete', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer renter_incomplete_token' },
      body: JSON.stringify({ paymentId: 'pay_1', paymentIntentId: 'pii_301' })
    });
    const res = await gateway.fetch(req, env, {});
    assert.equal(res.status, 409);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


function validPiPayment(overrides = {}) {
  return {
    identifier: 'pay_1',
    user: { uid: 'pi_renter_123' },
    amount: 0.0002,
    memo: 'Rentora Fee #rent_201',
    metadata: { paymentIntentId: 'pii_301', rentalId: 'rent_201' },
    status: {},
    ...overrides
  };
}

async function authenticatedIncompleteRequest(env, body = { paymentId: 'pay_1', paymentIntentId: 'pii_301' }) {
  const token = 'renter_recovery_token';
  await env.RENTORA_KV.put(`session:${await sha256(token)}`, JSON.stringify({ uid: 'pi_renter_123' }));
  return new Request('https://rentora.workers.dev/api/payments/incomplete', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body)
  });
}

async function withPiPayment(payment, callback) {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response(JSON.stringify(payment), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  try { return await callback(() => calls); } finally { globalThis.fetch = originalFetch; }
}

test('Incomplete payment: invalid or expired session is rejected', async () => {
  const env = createMockEnv(createMockD1());
  const req = new Request('https://rentora.workers.dev/api/payments/incomplete', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer expired' }, body: JSON.stringify({ paymentId: 'pay_1', paymentIntentId: 'pii_301' }) });
  assert.equal((await gateway.fetch(req, env, {})).status, 401);
});

for (const [name, payment, expectedStatus = 409] of [
  ['missing payer UID', validPiPayment({ user: undefined })],
  ['wrong payer UID', validPiPayment({ user: { uid: 'other_pioneer' } }), 403],
  ['missing rentalId', validPiPayment({ metadata: { paymentIntentId: 'pii_301' } })],
  ['wrong rentalId', validPiPayment({ metadata: { paymentIntentId: 'pii_301', rentalId: 'other_rental' } })],
  ['missing memo', validPiPayment({ memo: '' })],
  ['wrong memo', validPiPayment({ memo: 'forged memo' })],
  ['wrong amount', validPiPayment({ amount: 0.5 })],
  ['forged metadata', validPiPayment({ metadata: { paymentIntentId: 'forged', rentalId: 'rent_201' } })]
]) {
  test(`Incomplete payment: ${name} is rejected`, async () => {
    const env = createMockEnv(createMockD1());
    const req = await authenticatedIncompleteRequest(env);
    await withPiPayment(payment, async () => assert.equal((await gateway.fetch(req, env, {})).status, expectedStatus));
  });
}

test('Incomplete payment: completed intent returns without Pi access or duplicate lifecycle writes', async () => {
  const d1 = createMockD1();
  d1.intents[0].status = 'completed'; d1.intents[0].pi_payment_id = 'pay_1'; d1.intents[0].pi_txid = 'tx_1';
  d1.rentals[0].status = 'confirmed'; d1.rentals[0].payment_status = 'completed'; d1.transactions.push({ pi_payment_id: 'pay_1', pi_txid: 'tx_1' });
  const env = createMockEnv(d1);
  const req = await authenticatedIncompleteRequest(env);
  await withPiPayment(validPiPayment({ status: { developer_completed: true }, transaction: { txid: 'tx_1' } }), async (calls) => {
    const res = await gateway.fetch(req, env, {}); const data = await res.json();
    assert.equal(res.status, 200); assert.equal(data.idempotent, true); assert.equal(calls(), 0);
  });
  assert.equal(d1.transactions.length, 1); assert.equal(d1.rentals[0].status, 'confirmed');
});

test('Incomplete payment: repeated completed recovery is idempotent and does not duplicate transaction or rental lifecycle', async () => {
  const d1 = createMockD1(); const env = createMockEnv(d1);
  await withPiPayment(validPiPayment({ status: { developer_completed: true }, transaction: { txid: 'tx_1' } }), async (calls) => {
    const first = await gateway.fetch(await authenticatedIncompleteRequest(env), env, {});
    assert.equal(first.status, 200); assert.equal(calls(), 1);
    const second = await gateway.fetch(await authenticatedIncompleteRequest(env), env, {});
    const data = await second.json(); assert.equal(second.status, 200); assert.equal(data.idempotent, true); assert.equal(calls(), 1);
  });
  assert.equal(d1.transactions.length, 1); assert.equal(d1.intents[0].status, 'completed'); assert.equal(d1.rentals[0].status, 'confirmed');
});

test('CORS: actual unauthorized cross-origin request is rejected server-side', async () => {
  const env = createMockEnv(createMockD1()); env.CORS_ORIGIN = 'https://allowed.example';
  const req = new Request('https://rentora.workers.dev/api/health', { headers: { Origin: 'https://forbidden.example' } });
  assert.equal((await gateway.fetch(req, env, {})).status, 403);
});

test('CORS: same-origin actual request remains allowed', async () => {
  const env = createMockEnv(createMockD1());
  const req = new Request('https://rentora.workers.dev/api/health', { headers: { Origin: 'https://rentora.workers.dev' } });
  assert.equal((await gateway.fetch(req, env, {})).status, 200);
});

test('Auth: Normal authenticated user can access GET /api/auth/me without 403 Forbidden', async () => {
  const d1 = createMockD1();
  const env = createMockEnv(d1);
  const tokenHash = await sha256('renter_token_abc');
  await env.RENTORA_KV.put(`session:${tokenHash}`, JSON.stringify({ uid: 'pi_renter_123' }));

  const req = new Request('https://rentora.workers.dev/api/auth/me', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer renter_token_abc' }
  });

  const res = await gateway.fetch(req, env, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.authenticated, true);
  assert.equal(data.user.username, 'renter_pioneer');
  assert.equal(data.isAdmin, false);
});

test('Auth: Master Admin user receives isAdmin: true on GET /api/auth/me', async () => {
  const d1 = createMockD1();
  const env = createMockEnv(d1);
  const tokenHash = await sha256('admin_token_xyz');
  await env.RENTORA_KV.put(`session:${tokenHash}`, JSON.stringify({ uid: 'avina60' }));

  const req = new Request('https://rentora.workers.dev/api/auth/me', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer admin_token_xyz' }
  });

  const res = await gateway.fetch(req, env, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.authenticated, true);
  assert.equal(data.user.username, 'avina60');
  assert.equal(data.isAdmin, true);
});

test('Health: GET /api/health returns 200 and passes all readiness checks', async () => {
  const d1 = createMockD1();
  const env = createMockEnv(d1);
  const req = new Request('https://rentora.workers.dev/api/health', { method: 'GET' });

  const res = await gateway.fetch(req, env, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.checks.piApiKeyConfigured, true);
  assert.equal(data.checks.databaseBound, true);
  assert.equal(data.checks.sessionStoreBound, true);
});

test('Pi SDK Configuration: index.html configures sandbox: false for Pi Testnet', async () => {
  const fs = await import('node:fs/promises');
  const indexHtml = await fs.readFile('index.html', 'utf-8');
  assert.ok(!indexHtml.includes('sandbox: true'), 'index.html must not initialize Pi SDK with sandbox: true');
  assert.ok(indexHtml.includes('sandbox: false'), 'index.html must initialize Pi SDK with sandbox: false');
});

test('Pi SDK Payment Scopes: piService ensures payments scope before createPayment', async () => {
  const fs = await import('node:fs/promises');
  const serviceCode = await fs.readFile('src/services/piService.js', 'utf-8');
  assert.ok(serviceCode.includes("['payments', 'username'") || serviceCode.includes("'payments'") && serviceCode.includes("'username'"), "piService must request payments and username scopes");
  assert.ok(serviceCode.includes('ensureSdkAuthenticated'), 'piService must ensure SDK authentication before createPayment');
});
