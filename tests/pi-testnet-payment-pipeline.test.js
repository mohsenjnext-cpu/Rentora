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
              if (sql.includes('UPDATE payment_intents SET pi_payment_id=?1')) {
                const intent = intents.find(i => i.id === args[2]);
                if (intent) {
                  intent.pi_payment_id = args[0];
                  intent.status = 'approved';
                  intent.updated_at = args[1];
                  return { meta: { changes: 1 } };
                }
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

test('CORS: OPTIONS preflight permits cross-origin requests when CORS_ORIGIN is empty', async () => {
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
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://sandbox.minepi.com');
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
