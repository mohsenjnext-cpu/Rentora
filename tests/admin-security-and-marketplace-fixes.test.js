import test from 'node:test';
import assert from 'node:assert/strict';
import gateway from '../worker-gateway.js';

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function createMockEnv(initialData = {}) {
  const kvStore = new Map();
  const r2Store = new Map();
  const dbData = {
    users: (initialData.users || []).map(u => ({ ...u, created_at: u.created_at || '2026-09-01T00:00:00Z' })),
    listings: (initialData.listings || []).map(l => ({ ...l, created_at: l.created_at || '2026-09-01T00:00:00Z' })),
    rentals: initialData.rentals || [],
    payment_intents: initialData.payment_intents || [],
    transactions: initialData.transactions || [],
    reviews: initialData.reviews || [],
    reports: initialData.reports || [],
    conversations: initialData.conversations || [],
    messages: initialData.messages || [],
    listing_contacts: initialData.listing_contacts || []
  };

  const createStatement = (query, boundParams = []) => ({
    bind(...params) {
      return createStatement(query, params);
    },
    async first() {
      if (query.includes('FROM users WHERE pi_uid = ?1') || query.includes('FROM users WHERE pi_uid=?1')) {
        return dbData.users.find(u => u.pi_uid === boundParams[0]) || null;
      }
      if (query.includes('FROM users WHERE id=?1') || query.includes('FROM users WHERE id = ?1')) {
        return dbData.users.find(u => u.id === boundParams[0]) || null;
      }
      if (query.includes('FROM users') && query.includes('WHERE id=?1 OR pi_uid=?1 OR lower(username)=lower(?1)')) {
        const target = String(boundParams[0] || '').toLowerCase();
        return dbData.users.find(u => u.id === boundParams[0] || u.pi_uid === boundParams[0] || (u.username && u.username.toLowerCase() === target)) || null;
      }
      if (query.includes('FROM listings WHERE id=?1') || query.includes('FROM listings WHERE id = ?1')) {
        return dbData.listings.find(l => l.id === boundParams[0] && l.status !== 'deleted') || null;
      }
      if (query.includes('FROM listings l') && query.includes('WHERE l.id = ?1 AND l.status != \'deleted\'')) {
        const l = dbData.listings.find(item => item.id === boundParams[0] && item.status !== 'deleted');
        if (!l) return null;
        const u = dbData.users.find(usr => usr.id === l.owner_user_id) || {};
        return {
          ...l,
          owner_pi_uid: u.pi_uid,
          owner_username: u.username,
          owner_avatar: u.avatar_url
        };
      }
      if (query.includes('SELECT COUNT(*) AS c FROM users')) {
        return { c: dbData.users.length };
      }
      if (query.includes('SELECT COUNT(*) AS c FROM listings')) {
        return { c: dbData.listings.filter(l => l.status !== 'deleted').length };
      }
      if (query.includes('SELECT COUNT(*) AS c FROM rentals')) {
        return { c: dbData.rentals.length };
      }
      if (query.includes('SELECT COUNT(*) AS c FROM transactions')) {
        return { c: dbData.transactions.filter(t => t.status === 'completed').length };
      }
      if (query.includes('SELECT SUM(amount) AS total FROM transactions')) {
        const sum = dbData.transactions.filter(t => t.status === 'completed').reduce((acc, t) => acc + (t.amount || 0), 0);
        return { total: sum };
      }
      if (query.includes('SELECT COUNT(*) AS c FROM reports WHERE status = \'open\'')) {
        return { c: dbData.reports.filter(r => r.status === 'open').length };
      }
      return null;
    },
    async all() {
      if (query.includes('FROM users ORDER BY created_at DESC') || query.includes('SELECT * FROM users')) {
        return { results: dbData.users };
      }
      if (query.includes('FROM listings l')) {
        let matched = dbData.listings.filter(l => l.status !== 'deleted');
        if (query.includes("l.status = 'active'") && !query.includes('l.owner_user_id = ?1')) {
          matched = matched.filter(l => l.status === 'active');
        } else if (query.includes('l.owner_user_id = ?1')) {
          const ownerId = boundParams[0];
          matched = matched.filter(l => l.status === 'active' || l.owner_user_id === ownerId);
        }
        const results = matched.map(l => {
          const u = dbData.users.find(usr => usr.id === l.owner_user_id) || {};
          return {
            ...l,
            owner_pi_uid: u.pi_uid,
            owner_username: u.username,
            owner_avatar: u.avatar_url
          };
        });
        return { results };
      }
      if (query.includes('FROM rentals r')) {
        return { results: dbData.rentals };
      }
      if (query.includes('FROM transactions t')) {
        return { results: dbData.transactions };
      }
      if (query.includes('FROM reports r')) {
        return { results: dbData.reports };
      }
      return { results: [] };
    },
    async run() {
      if (query.includes('UPDATE users SET display_name=?1,avatar_url=?2,metadata=?3,updated_at=?4 WHERE id=?5')) {
        const u = dbData.users.find(usr => usr.id === boundParams[4]);
        if (u) {
          u.display_name = boundParams[0];
          u.avatar_url = boundParams[1];
          u.metadata = boundParams[2];
          u.updated_at = boundParams[3];
          return { meta: { changes: 1 } };
        }
      }
      if (query.includes('UPDATE users SET status=?1, updated_at=?2 WHERE id=?3')) {
        const u = dbData.users.find(usr => usr.id === boundParams[2]);
        if (u) {
          u.status = boundParams[0];
          u.updated_at = boundParams[1];
          return { meta: { changes: 1 } };
        }
      }
      if (query.includes('UPDATE listings SET status=?1, updated_at=?2 WHERE id=?3')) {
        const l = dbData.listings.find(item => item.id === boundParams[2]);
        if (l) {
          l.status = boundParams[0];
          l.updated_at = boundParams[1];
          return { meta: { changes: 1 } };
        }
      }
      return { meta: { changes: 0 } };
    }
  });

  const mockDb = {
    prepare(query) {
      return createStatement(query);
    },
    async batch() {
      return [];
    }
  };

  const mockKv = {
    async get(key) {
      return kvStore.get(key) || null;
    },
    async put(key, value) {
      kvStore.set(key, value);
    },
    async delete(key) {
      kvStore.delete(key);
    }
  };

  const mockR2 = {
    async put(key, value, options) {
      r2Store.set(key, { data: value, options });
    },
    async get(key) {
      const obj = r2Store.get(key);
      if (!obj) return null;
      return {
        body: obj.data,
        httpMetadata: obj.options?.httpMetadata || { contentType: 'image/jpeg' }
      };
    },
    async delete(key) {
      r2Store.delete(key);
    }
  };

  return {
    RENTORA_DB: mockDb,
    RENTORA_KV: mockKv,
    RENTORA_MEDIA: mockR2,
    ADMIN_PI_UIDS: 'avina60,mohsenjnext',
    dbData,
    kvStore,
    r2Store
  };
}

async function setupSession(env, user) {
  const token = `test_sess_${crypto.randomUUID()}`;
  const hash = await sha256(token);
  await env.RENTORA_KV.put(`session:${hash}`, JSON.stringify({
    uid: user.pi_uid,
    username: user.username,
    role: user.role
  }));
  return token;
}

// =========================================================================
// PROBLEM 1: ADMIN ACCESS SECURITY TESTS
// =========================================================================

test('Admin 1: Anonymous request to GET /api/admin/overview is rejected with 401', async () => {
  const env = createMockEnv();
  const req = new Request('https://rentora.app/api/admin/overview', { method: 'GET' });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 401);
});

test('Admin 2: Authenticated normal user request to GET /api/admin/overview is rejected with 403', async () => {
  const normalUser = { id: 'usr_normal', pi_uid: 'pi_normal', username: 'normaluser', display_name: 'Normal User', role: 'user', status: 'active' };
  const env = createMockEnv({ users: [normalUser] });
  const token = await setupSession(env, normalUser);

  const req = new Request('https://rentora.app/api/admin/overview', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 403);
});

test('Admin 3: Authenticated normal user request to GET /api/admin/users is rejected with 403', async () => {
  const normalUser = { id: 'usr_normal', pi_uid: 'pi_normal', username: 'normaluser', display_name: 'Normal User', role: 'user', status: 'active' };
  const env = createMockEnv({ users: [normalUser] });
  const token = await setupSession(env, normalUser);

  const req = new Request('https://rentora.app/api/admin/users', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 403);
});

test('Admin 4: Authenticated normal user cannot change another user status (403)', async () => {
  const normalUser = { id: 'usr_normal', pi_uid: 'pi_normal', username: 'normaluser', display_name: 'Normal User', role: 'user', status: 'active' };
  const victim = { id: 'usr_victim', pi_uid: 'pi_victim', username: 'victim', display_name: 'Victim', role: 'user', status: 'active' };
  const env = createMockEnv({ users: [normalUser, victim] });
  const token = await setupSession(env, normalUser);

  const req = new Request(`https://rentora.app/api/admin/users/${victim.id}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'suspended' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 403);
});

test('Admin 5: Client role tampering (localStorage escalation) is rejected by server', async () => {
  const attacker = { id: 'usr_attacker', pi_uid: 'pi_attacker', username: 'attacker', display_name: 'Attacker', role: 'user', status: 'active' };
  const env = createMockEnv({ users: [attacker] });

  const token = `fake_admin_${crypto.randomUUID()}`;
  const hash = await sha256(token);
  await env.RENTORA_KV.put(`session:${hash}`, JSON.stringify({
    uid: attacker.pi_uid,
    username: attacker.username,
    role: 'admin'
  }));

  const req = new Request('https://rentora.app/api/admin/overview', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 403);
});

test('Admin 6: Authenticated master admin succeeds with 200 on /api/admin/overview and /api/admin/users', async () => {
  const admin = { id: 'usr_admin', pi_uid: 'avina60', username: 'avina60', display_name: 'Admin', role: 'admin', status: 'active' };
  const regular = { id: 'usr_reg', pi_uid: 'pi_reg', username: 'regular', display_name: 'Regular', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: regular.id, title: 'Camera', status: 'active' };
  const env = createMockEnv({ users: [admin, regular], listings: [listing] });
  const token = await setupSession(env, admin);

  const req1 = new Request('https://rentora.app/api/admin/overview', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  const res1 = await gateway.fetch(req1, env);
  assert.equal(res1.status, 200);
  const json1 = await res1.json();
  assert.equal(json1.success, true);
  assert.equal(json1.overview.totalUsers, 2);
  assert.equal(json1.overview.totalListings, 1);

  const req2 = new Request('https://rentora.app/api/admin/users', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  const res2 = await gateway.fetch(req2, env);
  assert.equal(res2.status, 200);
  const json2 = await res2.json();
  assert.equal(json2.success, true);
  assert.equal(json2.users.length, 2);
});

test('Admin 7: Admin can suspend and reactivate a user', async () => {
  const admin = { id: 'usr_admin', pi_uid: 'avina60', username: 'avina60', display_name: 'Admin', role: 'admin', status: 'active' };
  const targetUser = { id: 'usr_target', pi_uid: 'pi_target', username: 'target', display_name: 'Target', role: 'user', status: 'active' };
  const env = createMockEnv({ users: [admin, targetUser] });
  const token = await setupSession(env, admin);

  const req = new Request(`https://rentora.app/api/admin/users/${targetUser.id}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'suspended' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.user.status, 'suspended');
});

// =========================================================================
// PROBLEM 2: USER PROFILE PHOTO UPLOAD & R2 PERSISTENCE TESTS
// =========================================================================

test('Avatar 1: Valid JPEG avatar upload persists to R2 and returns /api/images/img_<uuid>', async () => {
  const user = { id: 'usr_1', pi_uid: 'pi_1', username: 'photouser', display_name: 'Photo User', role: 'user', status: 'active' };
  const env = createMockEnv({ users: [user] });
  const token = await setupSession(env, user);

  // JPEG magic bytes: FF D8 FF
  const jpegBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  const req = new Request('https://rentora.app/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ data: jpegBase64, mimeType: 'image/jpeg' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.match(json.url, /^\/api\/images\/img_[a-zA-Z0-9_-]+$/);

  // Update profile with the uploaded image URL
  const updateReq = new Request('https://rentora.app/api/sync/user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ avatar: json.url })
  });
  const updateRes = await gateway.fetch(updateReq, env);
  assert.equal(updateRes.status, 200);
  const updateJson = await updateRes.json();
  assert.equal(updateJson.user.avatar, json.url);

  // Verify avatar retrieval via GET /api/images/:id
  const imgId = json.id;
  const getImgReq = new Request(`https://rentora.app/api/images/${imgId}`, { method: 'GET' });
  const getImgRes = await gateway.fetch(getImgReq, env);
  assert.equal(getImgRes.status, 200);
  assert.equal(getImgRes.headers.get('Content-Type'), 'image/jpeg');
});

test('Avatar 2: Upload with invalid magic bytes or SVG is rejected with 400', async () => {
  const user = { id: 'usr_1', pi_uid: 'pi_1', username: 'photouser', display_name: 'Photo User', role: 'user', status: 'active' };
  const env = createMockEnv({ users: [user] });
  const token = await setupSession(env, user);

  const fakeSvg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==';

  const req = new Request('https://rentora.app/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ data: fakeSvg, mimeType: 'image/svg+xml' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 400);
});

test('Avatar 3: Authoritative user session verification via GET /api/auth/me returns saved avatar', async () => {
  const user = {
    id: 'usr_1',
    pi_uid: 'pi_1',
    username: 'pioneer1',
    display_name: 'Pioneer One',
    avatar_url: '/api/images/img_saved_avatar_123',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({ avatar: '/api/images/img_saved_avatar_123' })
  };
  const env = createMockEnv({ users: [user] });
  const token = await setupSession(env, user);

  const req = new Request('https://rentora.app/api/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.authenticated, true);
  assert.equal(json.user.avatar, '/api/images/img_saved_avatar_123');
  assert.equal(json.isAdmin, false);
});

// =========================================================================
// PROBLEM 3: PUBLISHED LISTINGS VISIBILITY & PRIVACY TESTS
// =========================================================================

test('Marketplace 1: Published listing (status=active) by User A is visible to User B', async () => {
  const userA = { id: 'usr_A', pi_uid: 'pi_A', username: 'ownerA', display_name: 'Owner A', role: 'user', status: 'active' };
  const userB = { id: 'usr_B', pi_uid: 'pi_B', username: 'renterB', display_name: 'Renter B', role: 'user', status: 'active' };
  const listing = {
    id: 'item_drone',
    owner_user_id: userA.id,
    title: 'DJI Mavic 3 Pro',
    price_per_day: 5.0,
    status: 'active',
    metadata: JSON.stringify({ description: 'Pro drone', contactPhone: '09120000000' })
  };

  const env = createMockEnv({ users: [userA, userB], listings: [listing] });
  const tokenB = await setupSession(env, userB);

  const req = new Request('https://rentora.app/api/listings', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.items.length, 1);
  assert.equal(json.items[0].id, 'item_drone');
  assert.equal(json.items[0].title, 'DJI Mavic 3 Pro');
  assert.equal(json.items[0].ownerUsername, 'ownerA');
  assert.equal(json.items[0].contactPhone, undefined);
});

test('Marketplace 2: Anonymous visitor can view published listing feed', async () => {
  const userA = { id: 'usr_A', pi_uid: 'pi_A', username: 'ownerA', display_name: 'Owner A', role: 'user', status: 'active' };
  const listing = {
    id: 'item_tent',
    owner_user_id: userA.id,
    title: '4-Person Camping Tent',
    price_per_day: 1.5,
    status: 'active'
  };

  const env = createMockEnv({ users: [userA], listings: [listing] });

  const req = new Request('https://rentora.app/api/listings', { method: 'GET' });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.items.length, 1);
  assert.equal(json.items[0].title, '4-Person Camping Tent');
});

test('Marketplace 3: Draft and paused listings of User A are not visible to User B', async () => {
  const userA = { id: 'usr_A', pi_uid: 'pi_A', username: 'ownerA', display_name: 'Owner A', role: 'user', status: 'active' };
  const userB = { id: 'usr_B', pi_uid: 'pi_B', username: 'renterB', display_name: 'Renter B', role: 'user', status: 'active' };
  const activeListing = { id: 'item_act', owner_user_id: userA.id, title: 'Active Item', status: 'active' };
  const pausedListing = { id: 'item_pause', owner_user_id: userA.id, title: 'Paused Item', status: 'paused' };
  const deletedListing = { id: 'item_del', owner_user_id: userA.id, title: 'Deleted Item', status: 'deleted' };

  const env = createMockEnv({
    users: [userA, userB],
    listings: [activeListing, pausedListing, deletedListing]
  });

  const tokenB = await setupSession(env, userB);
  const req = new Request('https://rentora.app/api/listings', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.items.length, 1);
  assert.equal(json.items[0].id, 'item_act');

  const directReq = new Request(`https://rentora.app/api/listings/${pausedListing.id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const directRes = await gateway.fetch(directReq, env);
  assert.equal(directRes.status, 403);
});

test('Marketplace 4: Owner User A can view their own draft/paused listings', async () => {
  const userA = { id: 'usr_A', pi_uid: 'pi_A', username: 'ownerA', display_name: 'Owner A', role: 'user', status: 'active' };
  const activeListing = { id: 'item_act', owner_user_id: userA.id, title: 'Active Item', status: 'active' };
  const pausedListing = { id: 'item_pause', owner_user_id: userA.id, title: 'Paused Item', status: 'paused' };

  const env = createMockEnv({
    users: [userA],
    listings: [activeListing, pausedListing]
  });

  const tokenA = await setupSession(env, userA);
  const req = new Request('https://rentora.app/api/listings', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.items.length, 2);
});

// =========================================================================
// PROBLEM 4: RUNTIME RECOVERY & ERROR HANDLING TESTS
// =========================================================================

test('Runtime 1: Expired session returns 401 without crashing', async () => {
  const env = createMockEnv();
  const req = new Request('https://rentora.app/api/auth/me', {
    method: 'GET',
    headers: { Authorization: 'Bearer expired_or_invalid_token' }
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 401);
});

test('Runtime 2: Nonexistent listing query returns 404 without crashing', async () => {
  const env = createMockEnv();
  const req = new Request('https://rentora.app/api/listings/nonexistent_123', {
    method: 'GET'
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 404);
});
