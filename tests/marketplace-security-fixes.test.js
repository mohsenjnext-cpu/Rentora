import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';
import gateway from '../worker-gateway.js';

function createMockDb(initialData = {}) {
  const tables = {
    users: [...(initialData.users || [])],
    listings: [...(initialData.listings || [])],
    listing_contacts: [...(initialData.listing_contacts || [])],
    rentals: [...(initialData.rentals || [])],
    transactions: [...(initialData.transactions || [])],
    reports: [...(initialData.reports || [])],
  };

  function matchWhere(row, sql, params) {
    if (sql.includes('users WHERE pi_uid = ?1') || sql.includes('users WHERE pi_uid=?1')) {
      return row.pi_uid === params[0];
    }
    if (sql.includes('users WHERE id = ?1') || sql.includes('users WHERE id=?1')) {
      return row.id === params[0];
    }
    if (sql.includes('listings WHERE id=?1') || sql.includes('listings WHERE id = ?1')) {
      return row.id === params[0];
    }
    if (sql.includes('reports WHERE id=?1') || sql.includes('reports WHERE id = ?1')) {
      return row.id === params[0];
    }
    return true;
  }

  return {
    prepare(sql) {
      let boundParams = [];
      return {
        bind(...params) {
          boundParams = params;
          return this;
        },
        async first() {
          const lower = sql.toLowerCase();
          for (const tableName of Object.keys(tables)) {
            if (lower.includes(`from ${tableName}`)) {
              const row = tables[tableName].find(r => matchWhere(r, sql, boundParams));
              return row ? { ...row } : null;
            }
          }
          return null;
        },
        async all() {
          const lower = sql.toLowerCase();
          for (const tableName of Object.keys(tables)) {
            if (lower.includes(`from ${tableName}`)) {
              let rows = tables[tableName];
              if (tableName === 'listings' && sql.includes("status != 'deleted'")) {
                rows = rows.filter(r => r.status !== 'deleted');
              }
              if (tableName === 'listings' && sql.includes("status = 'active'")) {
                rows = rows.filter(r => r.status === 'active');
              }
              return { results: rows.map(r => ({ ...r })) };
            }
          }
          return { results: [] };
        },
        async run() {
          const lower = sql.toLowerCase();
          if (lower.includes('update users set display_name=')) {
            const user = tables.users.find(u => u.id === boundParams[4]);
            if (user) {
              user.display_name = boundParams[0];
              user.avatar_url = boundParams[1];
              user.metadata = boundParams[2];
              user.updated_at = boundParams[3];
            }
            return { meta: { changes: user ? 1 : 0 } };
          }
          if (lower.includes('insert into reports')) {
            tables.reports.push({
              id: boundParams[0],
              reporter_user_id: boundParams[1],
              target_type: boundParams[2],
              target_id: boundParams[3],
              reason: boundParams[4],
              status: boundParams[5],
              details: boundParams[6],
              created_at: boundParams[7],
              updated_at: boundParams[7]
            });
            return { meta: { changes: 1 } };
          }
          if (lower.includes('update reports set status=')) {
            const rep = tables.reports.find(r => r.id === boundParams[2]);
            if (rep) {
              rep.status = boundParams[0];
              rep.updated_at = boundParams[1];
            }
            return { meta: { changes: rep ? 1 : 0 } };
          }
          return { meta: { changes: 1 } };
        }
      };
    },
    async batch(statements) {
      for (const stmt of statements) {
        await stmt.run();
      }
      return [];
    }
  };
}

function createMockKv() {
  const store = new Map();
  return {
    async get(key) {
      return store.get(key) || null;
    },
    async put(key, value) {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    async delete(key) {
      store.delete(key);
    },
    _store: store
  };
}

async function sha256(val) {
  const bytes = new TextEncoder().encode(val);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

test('Problem 1: Non-admin user cannot escalate role or access admin operations', async () => {
  const regularUser = {
    id: 'usr_reg',
    pi_uid: 'pi_regular_pioneer',
    username: 'regular_pioneer',
    display_name: 'Regular Pioneer',
    avatar_url: null,
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({ role: 'admin' }), // malicious attempt to self-promote in metadata
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };

  const db = createMockDb({ users: [regularUser] });
  const kv = createMockKv();
  const token = 'regular_token_123';
  const hashed = await sha256(token);
  await kv.put(`session:${hashed}`, JSON.stringify({ uid: regularUser.pi_uid, username: regularUser.username, role: 'user' }));

  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    ADMIN_PI_UIDS: 'avina60,mohsenjnext,admin_master'
  };

  // 1. Sync check: role is strictly user, not admin
  const syncReq = new Request('https://rentora.example/api/sync/all', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const syncRes = await gateway.fetch(syncReq, env);
  assert.equal(syncRes.status, 200);
  const syncData = await syncRes.json();
  assert.equal(syncData.users[0].role, 'user');
  assert.deepEqual(syncData.reports, []);

  // 2. Admin resolve violation report endpoint returns 403 for non-admin
  const resolveReq = new Request('https://rentora.example/api/reports/rep_123/resolve', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'resolved' })
  });
  const resolveRes = await worker.fetch(resolveReq, env);
  assert.equal(resolveRes.status, 403);
});

test('Problem 2: User profile photo upload and persistence with R2 storage', async () => {
  const alice = {
    id: 'usr_alice',
    pi_uid: 'pi_alice_avatar',
    username: 'alice_avatar',
    display_name: 'Alice',
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=alice',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({}),
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };

  const db = createMockDb({ users: [alice] });
  const kv = createMockKv();
  const token = 'alice_token_abc';
  const hashed = await sha256(token);
  await kv.put(`session:${hashed}`, JSON.stringify({ uid: alice.pi_uid, username: alice.username, role: 'user' }));

  const mediaR2 = {
    _objects: new Map(),
    async put(key, bytes, meta) {
      this._objects.set(key, { bytes, meta });
    },
    async get(key) {
      const obj = this._objects.get(key);
      if (!obj) return null;
      return {
        body: obj.bytes,
        httpMetadata: obj.meta.httpMetadata
      };
    },
    async delete(key) {
      this._objects.delete(key);
    }
  };

  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    RENTORA_MEDIA: mediaR2,
    ADMIN_PI_UIDS: 'avina60'
  };

  // 1. Upload JPEG avatar
  const jpegHeaderBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const uploadReq = new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: `data:image/jpeg;base64,${jpegHeaderBase64}`,
      mimeType: 'image/jpeg'
    })
  });

  const uploadRes = await worker.fetch(uploadReq, env);
  assert.equal(uploadRes.status, 201);
  const uploadData = await uploadRes.json();
  assert.equal(uploadData.success, true);
  assert.match(uploadData.url, /^\/api\/images\/img_/);

  // 2. Save avatar to profile via /api/sync/user
  const syncUserReq = new Request('https://rentora.example/api/sync/user', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      displayName: 'Alice New Name',
      avatar: uploadData.url,
      bio: 'Lover of outdoor gear'
    })
  });

  const syncUserRes = await worker.fetch(syncUserReq, env);
  assert.equal(syncUserRes.status, 200);
  const syncUserData = await syncUserRes.json();
  assert.equal(syncUserData.success, true);
  assert.equal(syncUserData.user.avatar, uploadData.url);
  assert.equal(syncUserData.user.displayName, 'Alice New Name');

  // 3. GET /api/images/:id returns the image from R2 with immutable cache
  const imgReq = new Request(`https://rentora.example${uploadData.url}`);
  const imgRes = await worker.fetch(imgReq, env);
  assert.equal(imgRes.status, 200);
  assert.equal(imgRes.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(imgRes.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
});

test('Problem 3: Published listings are visible to public and private contact info is stripped', async () => {
  const owner = {
    id: 'usr_owner_1',
    pi_uid: 'pi_owner_1',
    username: 'listing_owner',
    display_name: 'Listing Owner',
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=owner',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({}),
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };

  const activeListing = {
    id: 'lst_camera_123',
    owner_user_id: owner.id,
    owner_pi_uid: owner.pi_uid,
    owner_username: owner.username,
    owner_avatar: owner.avatar_url,
    title: 'Sony Alpha A7 IV Camera',
    description: 'Professional 4K camera for creators',
    category: 'photography',
    location: 'Tehran',
    price_per_day: 0.5,
    deposit_amount: 2.0,
    status: 'active',
    metadata: JSON.stringify({
      images: ['/api/images/img_cam1'],
      contactPhone: '09123456789', // Private contact info
      phoneContact: '09123456789',
      whatsapp: '09123456789',
      coordinationNotes: 'Call before 8pm'
    }),
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };

  const db = createMockDb({
    users: [owner],
    listings: [activeListing]
  });
  const kv = createMockKv();
  const env = {
    RENTORA_DB: db,
    RENTORA_KV: kv,
    ADMIN_PI_UIDS: 'avina60'
  };

  // Anonymous public request to /api/sync/all
  const publicReq = new Request('https://rentora.example/api/sync/all', {
    headers: {}
  });
  const publicRes = await gateway.fetch(publicReq, env);
  assert.equal(publicRes.status, 200);
  const publicData = await publicRes.json();

  assert.equal(publicData.items.length, 1);
  const item = publicData.items[0];
  assert.equal(item.id, 'lst_camera_123');
  assert.equal(item.title, 'Sony Alpha A7 IV Camera');
  assert.equal(item.pricePerDay, 0.5);
  assert.equal(item.ownerUsername, 'listing_owner');

  // Verify private fields are stripped from public response
  assert.equal(item.contactPhone, undefined);
  assert.equal(item.phoneContact, undefined);
  assert.equal(item.whatsapp, undefined);
  assert.equal(item.coordinationNotes, undefined);
});
