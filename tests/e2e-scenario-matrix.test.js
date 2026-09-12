import test from 'node:test';
import assert from 'node:assert/strict';
import gateway from '../worker-gateway.js';

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function createMockEnv(initialData = {}) {
  const kvStore = new Map();
  const dbData = {
    users: initialData.users || [],
    listings: initialData.listings || [],
    rentals: initialData.rentals || [],
    payment_intents: initialData.payment_intents || [],
    transactions: initialData.transactions || [],
    reviews: initialData.reviews || [],
    reports: initialData.reports || [],
    chats: initialData.chats || [],
  };

  const mockDb = {
    prepare(query) {
      return {
        _query: query,
        _params: [],
        bind(...params) {
          this._params = params;
          return this;
        },
        async first() {
          const q = this._query.trim();
          if (q.includes('FROM users WHERE pi_uid = ?1') || q.includes('FROM users WHERE pi_uid=?1')) {
            const uid = this._params[0];
            return dbData.users.find((u) => u.pi_uid === uid) || null;
          }
          if (q.includes('FROM users WHERE id=?1')) {
            const id = this._params[0];
            return dbData.users.find((u) => u.id === id) || null;
          }
          if (q.includes('FROM users WHERE username=?1')) {
            const username = this._params[0];
            return dbData.users.find((u) => u.username === username) || null;
          }
          if (q.includes('FROM listings') && (q.includes('l.id=?1') || q.includes('id=?1')) && q.includes("status='active'")) {
            const id = this._params[0];
            const listing = dbData.listings.find((l) => l.id === id && l.status === 'active');
            if (!listing) return null;
            const owner = dbData.users.find((u) => u.id === listing.owner_user_id) || {};
            return { ...listing, owner_pi_uid: owner.pi_uid, owner_username: owner.username };
          }
          if (q.includes('FROM listings WHERE id=?1')) {
            const id = this._params[0];
            return dbData.listings.find((l) => l.id === id) || null;
          }
          if (q.includes('FROM rentals') && q.includes('WHERE r.id=?1 AND r.renter_user_id=?2')) {
            const [id, renterId] = this._params;
            const rental = dbData.rentals.find((r) => r.id === id && r.renter_user_id === renterId);
            if (!rental) return null;
            const listing = dbData.listings.find((l) => l.id === rental.listing_id) || {};
            return { ...rental, title: listing.title, price_per_day: listing.price_per_day, deposit_amount: listing.deposit_amount };
          }
          if (q.includes('FROM rentals') && q.includes('WHERE r.id=?1')) {
            const id = this._params[0];
            const rental = dbData.rentals.find((r) => r.id === id);
            if (!rental) return null;
            const listing = dbData.listings.find((l) => l.id === rental.listing_id) || {};
            const renter = dbData.users.find((u) => u.id === rental.renter_user_id) || {};
            const owner = dbData.users.find((u) => u.id === listing.owner_user_id) || {};
            return { ...rental, owner_user_id: listing.owner_user_id, price_per_day: listing.price_per_day, renter_pi_uid: renter.pi_uid, renter_username: renter.username, owner_pi_uid: owner.pi_uid, owner_username: owner.username };
          }
          if (q.includes('FROM payment_intents WHERE id=?1 AND user_id=?2')) {
            const [id, userId] = this._params;
            return dbData.payment_intents.find((p) => p.id === id && p.user_id === userId) || null;
          }
          if (q.includes('FROM payment_intents WHERE rental_id=?1')) {
            const rentalId = this._params[0];
            return dbData.payment_intents.find((p) => p.rental_id === rentalId) || null;
          }
          if (q.includes('FROM payment_intents WHERE id=?1')) {
            const id = this._params[0];
            return dbData.payment_intents.find((p) => p.id === id) || null;
          }
          return null;
        },
        async all() {
          const q = this._query.trim();
          if (q.includes('FROM listings')) {
            return { results: dbData.listings.filter((l) => l.status !== 'deleted') };
          }
          if (q.includes('FROM rentals')) {
            const userId = this._params[0];
            return { results: dbData.rentals.filter((r) => !userId || r.renter_user_id === userId) };
          }
          if (q.includes('FROM transactions')) {
            const userId = this._params[0];
            return { results: dbData.transactions.filter((t) => !userId || t.user_id === userId) };
          }
          if (q.includes('FROM users')) {
            return { results: dbData.users };
          }
          if (q.includes('FROM reviews')) {
            return { results: dbData.reviews };
          }
          if (q.includes('FROM reports')) {
            return { results: dbData.reports };
          }
          if (q.includes('FROM chats')) {
            const userId = this._params[0];
            return { results: dbData.chats.filter((c) => !userId || c.owner_user_id === userId || c.renter_user_id === userId) };
          }
          return { results: [] };
        },
        async run() {
          const q = this._query.trim();
          if (q.includes('INSERT INTO listings')) {
            const [id, owner_user_id, title, description, category, location, price_per_day, deposit_amount, platform_fee_rate, status, metadata] = this._params;
            dbData.listings.push({ id, owner_user_id, title, description, category, location, price_per_day, deposit_amount, platform_fee_rate, status, metadata });
            return { meta: { changes: 1 } };
          }
          if (q.includes('UPDATE listings SET')) {
            const [title, description, category, location, status, metadata, updatedAt, id] = this._params;
            const item = dbData.listings.find((l) => l.id === id);
            if (item) {
              item.title = title;
              item.description = description;
              item.category = category;
              item.location = location;
              item.status = status;
              item.metadata = metadata;
              item.updated_at = updatedAt;
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }
          if (q.includes('INSERT INTO payment_intents')) {
            const [id, rental_id, user_id, amount, memo, status, createdAt, expiresAt] = this._params;
            dbData.payment_intents.push({ id, rental_id, user_id, amount, memo, status, created_at: createdAt, expires_at: expiresAt, updated_at: createdAt });
            return { meta: { changes: 1 } };
          }
          if (q.includes('UPDATE payment_intents SET pi_payment_id=?1,status=\'approved\'')) {
            const [paymentId, updatedAt, id] = this._params;
            const intent = dbData.payment_intents.find((p) => p.id === id);
            if (intent && intent.status === 'created' && !intent.pi_payment_id) {
              intent.pi_payment_id = paymentId;
              intent.status = 'approved';
              intent.updated_at = updatedAt;
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }
          return { meta: { changes: 1 } };
        },
      };
    },
    async batch(statements) {
      const results = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    },
  };

  const mockKv = {
    async get(key) {
      return kvStore.get(key) || null;
    },
    async put(key, value) {
      kvStore.set(key, String(value));
    },
    async delete(key) {
      kvStore.delete(key);
    },
  };

  return {
    env: {
      RENTORA_DB: mockDb,
      RENTORA_KV: mockKv,
      PI_API_KEY: 'test_server_pi_api_key',
      PI_API_URL: 'https://api.minepi.com/v2',
      ADMIN_PI_UIDS: 'admin_pioneer_uid',
      PLATFORM_FEE_RATE: '0.05',
      CORS_ORIGIN: '',
    },
    dbData,
    kvStore,
  };
}

// Global fetch mocker for Pi Server API calls
let mockPiResponses = new Map();
const originalFetch = globalThis.fetch;

test.beforeEach(() => {
  mockPiResponses.clear();
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (url.includes('api.minepi.com')) {
      for (const [pattern, handler] of mockPiResponses.entries()) {
        if (url.includes(pattern)) {
          return handler(url, init);
        }
      }
      return new Response(JSON.stringify({ error: 'Pi Mock Not Found' }), { status: 404 });
    }
    return originalFetch(input, init);
  };
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

// Scenario 1: Unauthenticated request on protected mutation
test('Scenario: unauthenticated request is rejected with 401 on protected mutation', async () => {
  const { env } = createMockEnv();
  const res = await gateway.fetch(new Request('https://rentora.example/api/sync/item', { method: 'POST', body: JSON.stringify({ id: 'item_1', title: 'Test' }) }), env);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error, 'Authentication required');
});

// Scenario 1b: Anonymous public marketplace browsing
test('Scenario: anonymous public browsing returns active listings with 200', async () => {
  const { env } = createMockEnv({ listings: [{ id: 'item_pub', owner_user_id: 'usr_1', title: 'Public Item', status: 'active', price_per_day: 5, deposit_amount: 10 }] });
  const res = await gateway.fetch(new Request('https://rentora.example/api/sync/all', { method: 'GET' }), env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(Array.isArray(data.items), true);
  assert.equal(data.rentals.length, 0);
  assert.equal(data.chats.length, 0);
});

// Scenario 2: Authenticated user
test('Scenario: authenticated user successfully accesses safeSync', async () => {
  const user = { id: 'usr_1', pi_uid: 'pi_uid_1', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const { env, kvStore } = createMockEnv({ users: [user] });
  const token = 'test_token_alice';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const res = await gateway.fetch(
    new Request('https://rentora.example/api/sync/all', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }),
    env
  );
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.users.length, 1);
  assert.equal(data.users[0].uid, 'pi_uid_1');
});

// Scenario 3: Unauthorized / suspended user
test('Scenario: suspended user is denied access with 403', async () => {
  const user = { id: 'usr_suspended', pi_uid: 'pi_uid_bad', username: 'baduser', display_name: 'Bad', role: 'user', status: 'suspended', created_at: '2026-01-01T00:00:00Z' };
  const { env, kvStore } = createMockEnv({ users: [user] });
  const token = 'token_bad';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const res = await gateway.fetch(
    new Request('https://rentora.example/api/sync/all', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }),
    env
  );
  assert.equal(res.status, 403);
});

// Scenario 4: Listing ownership
test('Scenario: non-owner cannot update listing of another user', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const bob = { id: 'usr_bob', pi_uid: 'pi_bob', username: 'bob', display_name: 'Bob', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const listing = { id: 'item_1', owner_user_id: 'usr_alice', title: 'Drill', price_per_day: 5, deposit_amount: 10, status: 'active' };
  const { env, kvStore } = createMockEnv({ users: [alice, bob], listings: [listing] });

  const bobToken = 'token_bob';
  kvStore.set(`session:${await sha256(bobToken)}`, JSON.stringify({ uid: bob.pi_uid, username: bob.username, role: bob.role }));

  const res = await gateway.fetch(
    new Request('https://rentora.example/api/sync/item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify({ id: 'item_1', title: 'Hacked Drill' }),
    }),
    env
  );
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error, 'Listing ownership denied');
});

// Scenario 5: Rental ownership & self-rent prevention
test('Scenario: owner cannot rent their own listing', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const listing = { id: 'item_1', owner_user_id: 'usr_alice', title: 'Drill', price_per_day: 5, deposit_amount: 10, platform_fee_rate: 0.05, status: 'active' };
  const { env, kvStore } = createMockEnv({ users: [alice], listings: [listing] });

  const aliceToken = 'token_alice';
  kvStore.set(`session:${await sha256(aliceToken)}`, JSON.stringify({ uid: alice.pi_uid, username: alice.username, role: alice.role }));

  const res = await gateway.fetch(
    new Request('https://rentora.example/api/sync/rental', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ id: 'rnt_1', itemId: 'item_1', startDate: '2026-09-15', endDate: '2026-09-17' }),
    }),
    env
  );
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.error, 'Owner cannot rent own listing');
});

// Scenario 6: Payment amount tampering
test('Scenario: payment amount tampering is detected and rejected', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const intent = { id: 'pii_1', rental_id: 'rnt_1', user_id: 'usr_alice', amount: 0.5, memo: 'Rentora Fee #123', status: 'created', expires_at: '2026-12-31T00:00:00Z' };
  const { env, kvStore } = createMockEnv({ users: [alice], payment_intents: [intent] });

  const token = 'token_alice';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: alice.pi_uid, username: alice.username, role: alice.role }));

  mockPiResponses.set('/payments/pi_pay_1', () => {
    return new Response(
      JSON.stringify({
        identifier: 'pi_pay_1',
        user_uid: 'pi_alice',
        amount: 0.001, // Tampered amount
        memo: 'Rentora Fee #123',
        network: 'Pi Testnet',
        metadata: { paymentIntentId: 'pii_1' },
        status: { developer_approved: false, developer_completed: false },
      }),
      { status: 200 }
    );
  });

  const res = await gateway.fetch(
    new Request('https://rentora.example/api/payments/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ paymentId: 'pi_pay_1', paymentIntentId: 'pii_1' }),
    }),
    env
  );
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.error, 'Pi payment amount mismatch');
});

// Scenario 7: Payment user UID mismatch
test('Scenario: payment with different user UID is rejected', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const intent = { id: 'pii_1', rental_id: 'rnt_1', user_id: 'usr_alice', amount: 0.5, memo: 'Rentora Fee #123', status: 'created', expires_at: '2026-12-31T00:00:00Z' };
  const { env, kvStore } = createMockEnv({ users: [alice], payment_intents: [intent] });

  const token = 'token_alice';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: alice.pi_uid, username: alice.username, role: alice.role }));

  mockPiResponses.set('/payments/pi_pay_1', () => {
    return new Response(
      JSON.stringify({
        identifier: 'pi_pay_1',
        user_uid: 'pi_other_user', // Wrong payer
        amount: 0.5,
        memo: 'Rentora Fee #123',
        network: 'Pi Testnet',
        metadata: { paymentIntentId: 'pii_1' },
        status: { developer_approved: false, developer_completed: false },
      }),
      { status: 200 }
    );
  });

  const res = await gateway.fetch(
    new Request('https://rentora.example/api/payments/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ paymentId: 'pi_pay_1', paymentIntentId: 'pii_1' }),
    }),
    env
  );
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error, 'Pi payer mismatch');
});

// Scenario 8: Payment metadata mismatch
test('Scenario: payment with invalid metadata is rejected', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const intent = { id: 'pii_1', rental_id: 'rnt_1', user_id: 'usr_alice', amount: 0.5, memo: 'Rentora Fee #123', status: 'created', expires_at: '2026-12-31T00:00:00Z' };
  const { env, kvStore } = createMockEnv({ users: [alice], payment_intents: [intent] });

  const token = 'token_alice';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: alice.pi_uid, username: alice.username, role: alice.role }));

  mockPiResponses.set('/payments/pi_pay_1', () => {
    return new Response(
      JSON.stringify({
        identifier: 'pi_pay_1',
        user_uid: 'pi_alice',
        amount: 0.5,
        memo: 'Rentora Fee #123',
        network: 'Pi Testnet',
        metadata: { paymentIntentId: 'pii_different_intent' }, // Wrong intent ID
        status: { developer_approved: false, developer_completed: false },
      }),
      { status: 200 }
    );
  });

  const res = await gateway.fetch(
    new Request('https://rentora.example/api/payments/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ paymentId: 'pi_pay_1', paymentIntentId: 'pii_1' }),
    }),
    env
  );
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.error, 'Pi payment metadata binding is missing or invalid');
});

// Scenario 9: Wrong network
test('Scenario: payment on Mainnet or wrong network is rejected', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const intent = { id: 'pii_1', rental_id: 'rnt_1', user_id: 'usr_alice', amount: 0.5, memo: 'Rentora Fee #123', status: 'created', expires_at: '2026-12-31T00:00:00Z' };
  const { env, kvStore } = createMockEnv({ users: [alice], payment_intents: [intent] });

  const token = 'token_alice';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: alice.pi_uid, username: alice.username, role: alice.role }));

  mockPiResponses.set('/payments/pi_pay_1', () => {
    return new Response(
      JSON.stringify({
        identifier: 'pi_pay_1',
        user_uid: 'pi_alice',
        amount: 0.5,
        memo: 'Rentora Fee #123',
        network: 'Pi Network', // Mainnet instead of Pi Testnet
        metadata: { paymentIntentId: 'pii_1' },
        status: { developer_approved: false, developer_completed: false },
      }),
      { status: 200 }
    );
  });

  const res = await gateway.fetch(
    new Request('https://rentora.example/api/payments/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ paymentId: 'pi_pay_1', paymentIntentId: 'pii_1' }),
    }),
    env
  );
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.error, 'Pi payment network mismatch');
});

// Scenario 10: Cancelled payment
test('Scenario: cancelled payment cannot be approved or completed', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const intent = { id: 'pii_1', rental_id: 'rnt_1', user_id: 'usr_alice', amount: 0.5, memo: 'Rentora Fee #123', status: 'created', expires_at: '2026-12-31T00:00:00Z' };
  const { env, kvStore } = createMockEnv({ users: [alice], payment_intents: [intent] });

  const token = 'token_alice';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: alice.pi_uid, username: alice.username, role: alice.role }));

  mockPiResponses.set('/payments/pi_pay_1', () => {
    return new Response(
      JSON.stringify({
        identifier: 'pi_pay_1',
        user_uid: 'pi_alice',
        amount: 0.5,
        memo: 'Rentora Fee #123',
        network: 'Pi Testnet',
        metadata: { paymentIntentId: 'pii_1' },
        status: { cancelled: true },
      }),
      { status: 200 }
    );
  });

  const res = await gateway.fetch(
    new Request('https://rentora.example/api/payments/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ paymentId: 'pi_pay_1', paymentIntentId: 'pii_1' }),
    }),
    env
  );
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.error, 'Pi payment is not approvable in its current state');
});

// Scenario 11: Duplicate completion is idempotent
test('Scenario: duplicate payment completion call returns idempotent 200', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const intent = { id: 'pii_1', rental_id: 'rnt_1', user_id: 'usr_alice', amount: 0.5, memo: 'Rentora Fee #123', status: 'completed', pi_payment_id: 'pi_pay_1', pi_txid: 'tx_pi_123', expires_at: '2026-12-31T00:00:00Z' };
  const { env, kvStore } = createMockEnv({ users: [alice], payment_intents: [intent] });

  const token = 'token_alice';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: alice.pi_uid, username: alice.username, role: alice.role }));

  const res = await gateway.fetch(
    new Request('https://rentora.example/api/payments/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ paymentId: 'pi_pay_1', txid: 'tx_pi_123', paymentIntentId: 'pii_1' }),
    }),
    env
  );
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.completed, true);
  assert.equal(data.idempotent, true);
});

// Scenario 12: Session revoke
test('Scenario: session logout revokes KV session and subsequent calls return 401', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const { env, kvStore } = createMockEnv({ users: [alice] });

  const token = 'token_to_revoke';
  const sessionKey = `session:${await sha256(token)}`;
  kvStore.set(sessionKey, JSON.stringify({ uid: alice.pi_uid, username: alice.username, role: alice.role }));

  // Call logout endpoint
  const logoutRes = await gateway.fetch(
    new Request('https://rentora.example/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
    env
  );
  assert.equal(logoutRes.status, 200);
  assert.equal(kvStore.has(sessionKey), false);

  // Subsequent call fails
  const res = await gateway.fetch(
    new Request('https://rentora.example/api/sync/all', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }),
    env
  );
  assert.equal(res.status, 401);
});
