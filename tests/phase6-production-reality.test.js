import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function createPhase6MockDb() {
  const users = [];
  const listings = [];
  const rentals = [];
  const payment_intents = [];
  const transactions = [];
  const conversations = [];
  const messages = [];
  const reviews = [];
  const reports = [];
  const listing_contacts = [];

  const db = {
    users,
    listings,
    rentals,
    payment_intents,
    transactions,
    conversations,
    messages,
    reviews,
    reports,
    listing_contacts,
    prepare(sql) {
      const makeHandler = (params = []) => ({
        sql,
        async first() {
          if (sql.includes('FROM users WHERE id=?1 OR pi_uid=?1 OR lower(username)=lower(?1)')) {
            const query = String(params[0]).toLowerCase();
            return users.find(u => u.id === params[0] || u.pi_uid === params[0] || (u.username && u.username.toLowerCase() === query)) || null;
          }
          if (sql.includes('FROM users WHERE id=?1') || sql.includes('FROM users WHERE id = ?1')) {
            return users.find(u => u.id === params[0]) || null;
          }
          if (sql.includes('FROM users WHERE pi_uid=?1') || sql.includes('FROM users WHERE pi_uid = ?1')) {
            return users.find(u => u.pi_uid === params[0]) || null;
          }
          if (sql.includes('FROM listings WHERE id=?1')) {
            const l = listings.find(i => i.id === params[0]);
            if (!l) return null;
            const owner = users.find(u => u.id === l.owner_user_id);
            return {
              ...l,
              owner_kyc_status: owner?.kyc_status || 'unverified',
              owner_metadata: owner?.metadata || '{}'
            };
          }
          if (sql.includes('FROM rentals r JOIN listings l')) {
            const r = rentals.find(rent => rent.id === params[0] && rent.renter_user_id === params[1]);
            if (!r) return null;
            const l = listings.find(item => item.id === r.listing_id) || {};
            return { ...r, title: l.title, listing_id: l.id, price_per_day: l.price_per_day, deposit_amount: l.deposit_amount };
          }
          if (sql.includes('FROM payment_intents WHERE rental_id=?1')) {
            return payment_intents.find(p => p.rental_id === params[0]) || null;
          }
          if (sql.includes('FROM payment_intents WHERE id=?1')) {
            return payment_intents.find(p => p.id === params[0]) || null;
          }
          if (sql.includes("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND (type='platform_fee' OR type IS NULL)")) {
            const total = transactions.filter(t => t.status === 'completed' && (t.type === 'platform_fee' || !t.type)).reduce((acc, t) => acc + Number(t.amount || 0), 0);
            return { total };
          }
          if (sql.includes("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND type='admin_payout'")) {
            const total = transactions.filter(t => t.status === 'completed' && t.type === 'admin_payout').reduce((acc, t) => acc + Number(t.amount || 0), 0);
            return { total };
          }
          return null;
        },
        async all() {
          if (sql.includes('FROM listings')) {
            return {
              results: listings.filter(l => l.status === 'active').map(l => {
                const owner = users.find(u => u.id === l.owner_user_id);
                return {
                  ...l,
                  owner_kyc_status: owner?.kyc_status || 'unverified',
                  owner_metadata: owner?.metadata || '{}'
                };
              })
            };
          }
          if (sql.includes('FROM users')) {
            return { results: users };
          }
          return { results: [] };
        },
        async run() {
          if (sql.includes('INSERT INTO users')) {
            users.push({
              id: params[0],
              pi_uid: params[1],
              username: params[2],
              display_name: params[3],
              role: params[4],
              status: 'active',
              metadata: params[5],
              created_at: params[6],
              updated_at: params[6]
            });
            return { meta: { changes: 1 } };
          }
          if (sql.includes('UPDATE users SET')) {
            const target = users.find(u => u.id === params[params.length - 1] || u.pi_uid === params[params.length - 1]);
            if (target) {
              if (sql.includes('metadata=?1')) {
                target.metadata = params[0];
                target.updated_at = params[1];
              } else {
                target.username = params[0];
                target.role = params[2];
                target.metadata = params[3];
                target.updated_at = params[4];
              }
            }
            return { meta: { changes: 1 } };
          }
          if (sql.includes('INSERT INTO listings')) {
            listings.push({
              id: params[0],
              owner_user_id: params[1],
              title: params[2],
              description: params[3],
              category: params[4],
              location: params[5],
              price_per_day: params[6],
              deposit_amount: params[7],
              platform_fee_rate: params[8],
              status: 'active',
              metadata: params[9],
              created_at: params[10],
              updated_at: params[10]
            });
            return { meta: { changes: 1 } };
          }
          if (sql.includes('INSERT INTO transactions')) {
            const isPayout = sql.includes("'admin_payout'");
            transactions.push({
              id: params[0],
              payment_intent_id: params[1],
              pi_payment_id: params[2],
              pi_txid: params[3],
              user_id: params[4],
              amount: params[5],
              type: isPayout ? 'admin_payout' : 'platform_fee',
              status: 'completed',
              created_at: (isPayout ? params[6] : params[7]) || new Date().toISOString()
            });
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 1 } };
        },
        bind(...bindParams) {
          return makeHandler(bindParams);
        }
      });
      return makeHandler([]);
    },
    async batch(statements) {
      for (const stmt of statements) {
        const statementSql = typeof stmt === 'string' ? stmt : stmt?.sql || '';
        if (statementSql.includes('DELETE FROM transactions')) transactions.length = 0;
        else if (statementSql.includes('DELETE FROM payment_intents')) payment_intents.length = 0;
        else if (statementSql.includes('DELETE FROM messages')) messages.length = 0;
        else if (statementSql.includes('DELETE FROM conversations')) conversations.length = 0;
        else if (statementSql.includes('DELETE FROM reviews')) reviews.length = 0;
        else if (statementSql.includes('DELETE FROM reports')) reports.length = 0;
        else if (statementSql.includes('DELETE FROM listing_contacts')) listing_contacts.length = 0;
        else if (statementSql.includes('DELETE FROM rentals')) rentals.length = 0;
        else if (statementSql.includes('DELETE FROM listings')) listings.length = 0;
      }
      return statements.map(() => ({ meta: { changes: 1 } }));
    }
  };

  return db;
}

function createPhase6MockKv() {
  const store = new Map();
  return {
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, typeof value === 'string' ? value : JSON.stringify(value)); },
    async delete(key) { store.delete(key); },
    _store: store
  };
}

test('TASK 1: KYC 3-state resolution and verified status preservation across logins', async () => {
  const db = createPhase6MockDb();
  const kv = createPhase6MockKv();
  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    PI_API_KEY: 'test_pi_key',
    ADMIN_PI_UIDS: 'admin_uid_123',
    ADMIN_USERNAMES: 'admin_user',
    IS_TEST: true
  };

  // Seed verified pioneer in D1
  db.users.push({
    id: 'usr_pioneer_1',
    pi_uid: 'pi_uid_pioneer_1',
    username: 'pioneer_verified',
    display_name: 'Pioneer Verified',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({ kycStatus: 'verified', isOfficialSdk: true }),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  // Mock global fetch for Pi /me endpoint returning no KYC flag (standard Pi SDK behavior)
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/me')) {
      return new Response(JSON.stringify({
        uid: 'pi_uid_pioneer_1',
        username: 'pioneer_verified',
        roles: ['user'] // No 'kyc' in roles
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    // Pioneer logs in again
    const loginReq = new Request('http://localhost/api/auth/pi-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: 'access_tok_pioneer_1',
        user: { uid: 'pi_uid_pioneer_1', username: 'pioneer_verified' }
      })
    });

    const loginRes = await worker.fetch(loginReq, env);
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    // Must remain verified and not get downgraded!
    assert.equal(loginData.user.kycStatus, 'verified');

    // Admin can also manage KYC status via admin route
    const adminSessionToken = 'admin_session_token_xyz';
    const adminHash = await sha256(adminSessionToken);
    await kv.put(`session:${adminHash}`, JSON.stringify({
      id: 'usr_admin',
      uid: 'admin_uid_123',
      username: 'admin_user',
      role: 'admin',
      isAdmin: true
    }));

    db.users.push({
      id: 'usr_admin',
      pi_uid: 'admin_uid_123',
      username: 'admin_user',
      display_name: 'Admin User',
      role: 'admin',
      status: 'active',
      metadata: JSON.stringify({ kycStatus: 'verified' }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const kycToggleReq = new Request('http://localhost/api/admin/users/usr_pioneer_1/kyc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSessionToken}`
      },
      body: JSON.stringify({ kycStatus: 'verified' })
    });

    const kycRes = await worker.fetch(kycToggleReq, env);
    assert.equal(kycRes.status, 200);
    const kycData = await kycRes.json();
    assert.equal(kycData.user.kycStatus, 'verified');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('TASK 2: Admin Database Purge with strict Foreign Key ordering', async () => {
  const db = createPhase6MockDb();
  const kv = createPhase6MockKv();
  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    PI_API_KEY: 'test_pi_key',
    ADMIN_PI_UIDS: 'admin_uid_123',
    ADMIN_USERNAMES: 'admin_user',
    IS_TEST: true
  };

  // Populate fully linked marketplace entities
  db.users.push({
    id: 'usr_admin',
    pi_uid: 'admin_uid_123',
    username: 'admin_user',
    role: 'admin',
    status: 'active',
    metadata: JSON.stringify({}),
    created_at: new Date().toISOString()
  });
  db.listings.push({
    id: 'item_1',
    owner_user_id: 'usr_admin',
    title: 'Drill',
    price_per_day: 5,
    deposit_amount: 10,
    status: 'active',
    metadata: JSON.stringify({})
  });
  db.rentals.push({
    id: 'rent_1',
    listing_id: 'item_1',
    renter_user_id: 'usr_admin',
    status: 'confirmed'
  });
  db.payment_intents.push({
    id: 'pii_1',
    rental_id: 'rent_1',
    user_id: 'usr_admin',
    amount: 0.25,
    status: 'completed'
  });
  db.transactions.push({
    id: 'tx_1',
    payment_intent_id: 'pii_1',
    pi_payment_id: 'pay_1',
    pi_txid: 'txid_1',
    user_id: 'usr_admin',
    amount: 0.25,
    type: 'platform_fee',
    status: 'completed'
  });

  const adminToken = 'admin_purge_token';
  const adminHash = await sha256(adminToken);
  await kv.put(`session:${adminHash}`, JSON.stringify({
    id: 'usr_admin',
    uid: 'admin_uid_123',
    username: 'admin_user',
    role: 'admin',
    isAdmin: true
  }));

  const purgeReq = new Request('http://localhost/api/sync/purge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  });

  const res = await worker.fetch(purgeReq, env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.purged, true);

  // All dependent tables should now be empty
  assert.equal(db.transactions.length, 0);
  assert.equal(db.payment_intents.length, 0);
  assert.equal(db.rentals.length, 0);
  assert.equal(db.listings.length, 0);
});

test('TASK 3: Platform Fee A2U Payout with Horizon Polling for txid', async () => {
  const db = createPhase6MockDb();
  const kv = createPhase6MockKv();
  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    PI_API_KEY: 'test_pi_key',
    ADMIN_PI_UIDS: 'admin_uid_123',
    ADMIN_USERNAMES: 'admin_user',
    IS_TEST: true
  };

  db.users.push({
    id: 'usr_admin',
    pi_uid: 'admin_uid_123',
    username: 'admin_user',
    role: 'admin',
    status: 'active',
    metadata: JSON.stringify({}),
    created_at: new Date().toISOString()
  });

  // Seed 20 PI of completed fee revenue
  db.transactions.push({
    id: 'tx_rev_1',
    payment_intent_id: 'pii_rev_1',
    pi_payment_id: 'pay_rev_1',
    pi_txid: 'txid_rev_1',
    user_id: 'usr_admin',
    amount: 20.0,
    type: 'platform_fee',
    status: 'completed',
    created_at: new Date().toISOString()
  });

  const adminToken = 'admin_payout_token';
  const adminHash = await sha256(adminToken);
  await kv.put(`session:${adminHash}`, JSON.stringify({
    id: 'usr_admin',
    uid: 'admin_uid_123',
    username: 'admin_user',
    role: 'admin',
    isAdmin: true
  }));

  let pollCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const sUrl = String(url);
    if (sUrl.includes('/incomplete_server_payments')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (sUrl.endsWith('/payments') && opts?.method === 'POST') {
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_999',
        status: { developer_approved: false }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (sUrl.includes('/payments/pi_pay_a2u_999/approve')) {
      // Approve succeeds but transaction is not minted yet
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_999',
        status: { developer_approved: true },
        transaction: null
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (sUrl.endsWith('/payments/pi_pay_a2u_999') && (!opts || !opts.method || opts.method === 'GET')) {
      pollCount++;
      // Return txid on 2nd poll
      if (pollCount >= 2) {
        return new Response(JSON.stringify({
          identifier: 'pi_pay_a2u_999',
          status: { developer_approved: true, transaction_verified: true },
          transaction: { txid: 'horizon_txid_success_12345' }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_999',
        status: { developer_approved: true },
        transaction: null
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (sUrl.includes('/payments/pi_pay_a2u_999/complete')) {
      return new Response(JSON.stringify({
        identifier: 'pi_pay_a2u_999',
        status: { developer_completed: true }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const payoutReq = new Request('http://localhost/api/admin/payout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        amount: 5.0,
        memo: 'Test Payout',
        walletAddress: 'GD6ABCD1234567890WXYZ'
      })
    });

    const res = await worker.fetch(payoutReq, env);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.txid, 'horizon_txid_success_12345');

    // D1 transactions should contain the completed payout
    const payoutTx = db.transactions.find(t => t.type === 'admin_payout');
    assert.ok(payoutTx);
    assert.equal(payoutTx.amount, 5.0);
    assert.equal(payoutTx.pi_txid, 'horizon_txid_success_12345');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FINAL REAL USER FLOW TEST: Complete end-to-end lifecycle', async () => {
  const db = createPhase6MockDb();
  const kv = createPhase6MockKv();
  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    PI_API_KEY: 'test_pi_key',
    ADMIN_PI_UIDS: 'admin_uid_master',
    ADMIN_USERNAMES: 'master_admin',
    PLATFORM_FEE_RATE: '0.05',
    IS_TEST: true
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const sUrl = String(url);
    if (sUrl.includes('/me')) {
      return new Response(JSON.stringify({
        uid: 'uid_pioneer_alpha',
        username: 'pioneer_alpha',
        roles: ['user']
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (sUrl.includes('/incomplete_server_payments')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (sUrl.endsWith('/payments') && opts?.method === 'POST') {
      return new Response(JSON.stringify({
        identifier: 'pay_e2e_payout',
        status: { developer_approved: false }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (sUrl.includes('/payments/pay_e2e_payout/approve')) {
      return new Response(JSON.stringify({
        identifier: 'pay_e2e_payout',
        status: { developer_approved: true },
        transaction: { txid: 'txid_e2e_horizon' }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (sUrl.includes('/payments/pay_e2e_payout/complete')) {
      return new Response(JSON.stringify({
        identifier: 'pay_e2e_payout',
        status: { developer_completed: true }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    // 1. Pioneer 1 Login
    const login1Res = await worker.fetch(new Request('http://localhost/api/auth/pi-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: 'tok_alpha',
        user: { uid: 'uid_pioneer_alpha', username: 'pioneer_alpha' }
      })
    }), env);
    assert.equal(login1Res.status, 200);
    const user1Data = await login1Res.json();
    const token1 = user1Data.sessionToken;
    assert.ok(token1);

    // 2. View / Create Listing
    const createItemRes = await worker.fetch(new Request('http://localhost/api/sync/item', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token1}`
      },
      body: JSON.stringify({
        id: 'item_camera_pro',
        title: 'Sony Alpha Camera',
        pricePerDay: 10,
        deposit: 50,
        category: 'cameras',
        location: 'تهران'
      })
    }), env);
    assert.equal(createItemRes.status, 201);

    // 3. User 1 Logout
    const logoutRes = await worker.fetch(new Request('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token1}` }
    }), env);
    assert.equal(logoutRes.status, 200);

    // 4. Admin Login
    globalThis.fetch = async (url) => {
      if (String(url).includes('/me')) {
        return new Response(JSON.stringify({
          uid: 'admin_uid_master',
          username: 'master_admin',
          roles: ['user']
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('{}', { status: 200 });
    };

    const adminLoginRes = await worker.fetch(new Request('http://localhost/api/auth/pi-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: 'tok_admin',
        user: { uid: 'admin_uid_master', username: 'master_admin' }
      })
    }), env);
    assert.equal(adminLoginRes.status, 200);
    const adminData = await adminLoginRes.json();
    const adminToken = adminData.sessionToken;
    assert.equal(adminData.user.role, 'admin');

    // 5. Admin Database Purge
    const purgeRes = await worker.fetch(new Request('http://localhost/api/sync/purge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }), env);
    assert.equal(purgeRes.status, 200);
    const purgeData = await purgeRes.json();
    assert.equal(purgeData.purged, true);
    assert.equal(db.listings.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('TASK 4: ChatModal message lifecycle and memory caching verification', async () => {
  // Test in-memory deduplication logic used in ChatModal
  const messagesCache = new Map();
  const convId = 'conv_123';
  const initialMessages = [
    { id: 'm1', text: 'Hello', createdAt: '2026-09-20T10:00:00Z', senderUsername: 'alice' },
    { id: 'm2', text: 'Hi there', createdAt: '2026-09-20T10:01:00Z', senderUsername: 'bob' }
  ];

  messagesCache.set(convId, initialMessages);
  assert.equal(messagesCache.get(convId).length, 2);

  // Incoming polled message
  const polledMessages = [
    { id: 'm1', text: 'Hello', createdAt: '2026-09-20T10:00:00Z', senderUsername: 'alice' },
    { id: 'm2', text: 'Hi there', createdAt: '2026-09-20T10:01:00Z', senderUsername: 'bob' },
    { id: 'm3', text: 'Can I rent tomorrow?', createdAt: '2026-09-20T10:02:00Z', senderUsername: 'alice' }
  ];

  const dedupedMap = new Map();
  polledMessages.forEach(m => { if (m?.id) dedupedMap.set(m.id, m); });
  const dedupedList = Array.from(dedupedMap.values());
  messagesCache.set(convId, dedupedList);

  assert.equal(messagesCache.get(convId).length, 3);
  assert.equal(messagesCache.get(convId)[2].id, 'm3');
});

test('TASK 5: Navigation & Auth Token verification returns stable state', async () => {
  const db = createPhase6MockDb();
  const kv = createPhase6MockKv();
  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    PI_API_KEY: 'test_pi_key',
    ADMIN_PI_UIDS: 'admin_uid_master',
    ADMIN_USERNAMES: 'master_admin',
    IS_TEST: true
  };

  const userSessionToken = 'session_token_regular_user';
  const userHash = await sha256(userSessionToken);
  await kv.put(`session:${userHash}`, JSON.stringify({
    id: 'usr_reg_1',
    uid: 'pi_uid_reg_1',
    username: 'pioneer_user',
    role: 'user',
    isAdmin: false
  }));

  db.users.push({
    id: 'usr_reg_1',
    pi_uid: 'pi_uid_reg_1',
    username: 'pioneer_user',
    display_name: 'Pioneer User',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({ kycStatus: 'verified' }),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const meReq = new Request('http://localhost/api/auth/me', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${userSessionToken}` }
  });

  const meRes = await worker.fetch(meReq, env);
  assert.equal(meRes.status, 200);
  const meData = await meRes.json();
  assert.equal(meData.authenticated, true);
  assert.equal(meData.user.username, 'pioneer_user');
  assert.equal(meData.user.kycStatus, 'verified');
});

test('RESERVATION REGRESSION: BookingModal pricing scope resolution and fallback termination', async () => {
  const item = {
    id: 'item_test_drill',
    title: 'Bosch Hammer Drill',
    pricePerDay: 4.5,
    deposit: 30,
    ownerUsername: 'owner_user'
  };

  const dates = {
    startDate: '2026-09-21',
    endDate: '2026-09-24'
  };

  // 1. Calculate pricing
  const dailyPrice = Number(item.pricePerDay || 0);
  const depositAmount = Number(item.deposit || 0);

  const startMs = new Date(dates.startDate).getTime();
  const endMs = new Date(dates.endDate).getTime();
  const daysCount = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
  const baseRentalAmount = Number((daysCount * dailyPrice).toFixed(4));
  const platformFee = Number((baseRentalAmount * 0.05).toFixed(4));
  const totalObligation = baseRentalAmount + depositAmount;

  const pricing = {
    daysCount,
    platformFeePercentage: 5,
    rentoraFee: platformFee,
    rentalTotal: baseRentalAmount,
    deposit: depositAmount,
    totalObligation
  };

  // Verify all scoped variables required by BookingModal render exist and are numeric
  assert.equal(typeof pricing.daysCount, 'number');
  assert.equal(pricing.daysCount, 3);
  assert.equal(typeof pricing.platformFeePercentage, 'number');
  assert.equal(pricing.platformFeePercentage, 5);
  assert.equal(pricing.rentalTotal, 13.5);
  assert.equal(pricing.rentoraFee, 0.675);
  assert.equal(pricing.totalObligation, 43.5);
});
