import test from 'node:test';
import assert from 'node:assert/strict';
import gateway from '../worker-gateway2.js';

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function createMockEnv(users) {
  const kvStore = new Map();
  const createStatement = (query, boundParams = []) => ({
    bind(...params) { return createStatement(query, params); },
    async first() {
      if (query.includes('FROM users WHERE pi_uid = ?1') || query.includes('FROM users WHERE pi_uid=?1')) {
        return users.find((u) => u.pi_uid === boundParams[0]) || null;
      }
      if (query.includes('WHERE id=?1 OR pi_uid=?1 OR lower(username)=lower(?1)')) {
        const key = String(boundParams[0] || '').toLowerCase();
        return users.find((u) => u.id === boundParams[0] || u.pi_uid === boundParams[0] || u.username?.toLowerCase() === key) || null;
      }
      if (query.includes('FROM users WHERE id=?1')) {
        return users.find((u) => u.id === boundParams[0]) || null;
      }
      return null;
    },
    async all() { return { results: [] }; },
    async run() {
      if (query.includes('UPDATE users SET metadata=?1, updated_at=?2 WHERE id=?3')) {
        const target = users.find((u) => u.id === boundParams[2]);
        if (target) {
          target.metadata = boundParams[0];
          return { meta: { changes: 1 } };
        }
      }
      return { meta: { changes: 0 } };
    }
  });

  return {
    RENTORA_DB: { prepare(query) { return createStatement(query); }, async batch() { return []; } },
    RENTORA_KV: {
      async get(key) { return kvStore.get(key) || null; },
      async put(key, value) { kvStore.set(key, value); },
      async delete(key) { kvStore.delete(key); }
    },
    ADMIN_PI_UIDS: 'pi_admin',
    users
  };
}

async function setupSession(env, user) {
  const token = `test_sess_${crypto.randomUUID()}`;
  await env.RENTORA_KV.put(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));
  return token;
}

function kycRequest(userId, token, status) {
  return new Request(`https://rentora.app/api/admin/users/${userId}/kyc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status })
  });
}

const admin = () => ({ id: 'usr_admin', pi_uid: 'pi_admin', username: 'owner', display_name: 'Owner', role: 'admin', status: 'active' });
const member = () => ({ id: 'usr_member', pi_uid: 'pi_member', username: 'member', display_name: 'Member', role: 'user', status: 'active', metadata: '{}' });

test('admin can mark a pioneer as KYC verified', async () => {
  const users = [admin(), member()];
  const env = createMockEnv(users);
  const token = await setupSession(env, users[0]);

  const res = await gateway.fetch(kycRequest('usr_member', token, 'verified'), env);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.user.kycStatus, 'verified');
  assert.equal(JSON.parse(users[1].metadata).kycStatus, 'verified');
});

test('non-admin cannot change KYC status', async () => {
  const users = [admin(), member()];
  const env = createMockEnv(users);
  const token = await setupSession(env, users[1]);

  const res = await gateway.fetch(kycRequest('usr_member', token, 'verified'), env);

  assert.equal(res.status, 403);
  assert.equal(JSON.parse(users[1].metadata).kycStatus, undefined);
});

test('KYC status values are validated', async () => {
  const users = [admin(), member()];
  const env = createMockEnv(users);
  const token = await setupSession(env, users[0]);

  const res = await gateway.fetch(kycRequest('usr_member', token, 'pending'), env);

  assert.equal(res.status, 400);
});
