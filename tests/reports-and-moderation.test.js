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
    conversations: initialData.conversations || [],
    messages: initialData.messages || [],
    listing_contacts: initialData.listing_contacts || []
  };

  const mockDb = {
    prepare(query) {
      return {
        bind(...params) {
          return {
            async first() {
              if (query.includes('FROM users WHERE pi_uid = ?1') || query.includes('FROM users WHERE pi_uid=?1')) {
                return dbData.users.find(u => u.pi_uid === params[0]) || null;
              }
              if (query.includes('FROM users WHERE id=?1') || query.includes('FROM users WHERE id = ?1')) {
                return dbData.users.find(u => u.id === params[0]) || null;
              }
              if (query.includes('FROM reports WHERE id=?1') || query.includes('FROM reports WHERE id = ?1')) {
                return dbData.reports.find(r => r.id === params[0]) || null;
              }
              return null;
            },
            async all() {
              if (query.includes('FROM reports')) {
                return { results: dbData.reports };
              }
              return { results: [] };
            },
            async run() {
              if (query.includes('INSERT INTO reports')) {
                dbData.reports.push({
                  id: params[0],
                  reporter_user_id: params[1],
                  target_type: params[2],
                  target_id: params[3],
                  reason: params[4],
                  status: 'open',
                  metadata: params[5],
                  created_at: params[6],
                  updated_at: params[7]
                });
                return { meta: { changes: 1 } };
              }
              if (query.includes('UPDATE reports SET status=?1')) {
                const rep = dbData.reports.find(r => r.id === params[2]);
                if (rep) {
                  rep.status = params[0];
                  rep.updated_at = params[1];
                  return { meta: { changes: 1 } };
                }
              }
              return { meta: { changes: 0 } };
            }
          };
        }
      };
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

  return {
    RENTORA_DB: mockDb,
    RENTORA_KV: mockKv,
    dbData,
    kvStore
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

test('Report 1: Anonymous request to POST /api/reports is rejected with 401', async () => {
  const env = createMockEnv();
  const req = new Request('https://rentora.app/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'listing', targetId: 'item_123', reason: 'fake_listing' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 401);
});

test('Report 2: Authenticated user successfully submits report with 201', async () => {
  const user = { id: 'usr_reporter', pi_uid: 'pi_reporter', username: 'reporter1', display_name: 'Reporter', role: 'user', status: 'active' };
  const env = createMockEnv({ users: [user] });
  const token = await setupSession(env, user);

  const req = new Request('https://rentora.app/api/reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      type: 'listing',
      targetId: 'item_123',
      targetTitle: 'Fake Generator',
      reason: 'fake_listing',
      details: 'This item seems counterfeit.'
    })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.report.reporterUserId, user.id);
  assert.equal(json.report.reason, 'fake_listing');
  assert.equal(json.report.status, 'open');
});

test('Report 3: Report missing target or reason returns 400', async () => {
  const user = { id: 'usr_reporter', pi_uid: 'pi_reporter', username: 'reporter1', display_name: 'Reporter', role: 'user', status: 'active' };
  const env = createMockEnv({ users: [user] });
  const token = await setupSession(env, user);

  const req = new Request('https://rentora.app/api/reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ details: 'No reason or target' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 400);
});

test('Report 4: Non-admin user cannot resolve report (403)', async () => {
  const user = { id: 'usr_user', pi_uid: 'pi_user', username: 'user1', display_name: 'User', role: 'user', status: 'active' };
  const report = { id: 'rep_1', reporter_user_id: user.id, target_type: 'listing', target_id: 'item_1', reason: 'fake', status: 'open' };
  const env = createMockEnv({ users: [user], reports: [report] });
  const token = await setupSession(env, user);

  const req = new Request(`https://rentora.app/api/reports/${report.id}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'resolved' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 403);
});

test('Report 5: Admin user successfully resolves report (200)', async () => {
  const admin = { id: 'usr_admin', pi_uid: 'avina60', username: 'avina60', display_name: 'Admin', role: 'admin', status: 'active' };
  const report = { id: 'rep_1', reporter_user_id: 'usr_other', target_type: 'listing', target_id: 'item_1', reason: 'fake', status: 'open' };
  const env = createMockEnv({ users: [admin], reports: [report] });
  const token = await setupSession(env, admin);

  const req = new Request(`https://rentora.app/api/reports/${report.id}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'resolved' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.status, 'resolved');
});
