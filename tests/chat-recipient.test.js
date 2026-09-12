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
        bind(...params) {
          return {
            async first() {
              if (query.includes('username')) {
                return dbData.users.find(u => u.username?.toLowerCase() === String(params[0]).toLowerCase()) || null;
              }
              if (query.includes('pi_uid')) {
                return dbData.users.find(u => u.pi_uid === params[0]) || null;
              }
              if (query.includes('FROM chats WHERE id')) {
                return dbData.chats.find(c => c.id === params[0]) || null;
              }
              return null;
            },
            async all() {
              return { results: [] };
            },
            async run() {
              if (query.includes('INSERT INTO chats')) {
                dbData.chats.push({ id: params[0], owner_user_id: params[1], renter_user_id: params[2], rental_id: params[3], metadata: params[4] });
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 1 } };
            }
          };
        }
      };
    }
  };

  return {
    env: {
      RENTORA_DB: mockDb,
      RENTORA_KV: {
        async get(key) { return kvStore.get(key) || null; },
        async put(key, val) { kvStore.set(key, val); }
      }
    },
    kvStore,
    dbData
  };
}

test('Chat recipient resolution: Owner sending message correctly routes to Renter', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'uid_owner', username: 'avina60', status: 'active', role: 'user' };
  const renter = { id: 'usr_renter', pi_uid: 'uid_renter', username: 'john_doe', status: 'active', role: 'user' };
  const { env, kvStore, dbData } = createMockEnv({ users: [owner, renter] });

  const token = 'token_owner';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: owner.pi_uid, username: owner.username, role: owner.role }));

  const chatPayload = {
    id: 'chat_123',
    ownerUsername: 'avina60',
    renterUsername: 'john_doe',
    messages: [{ id: 'msg_1', senderUsername: 'avina60', text: 'Hello John' }]
  };

  const res = await gateway.fetch(new Request('https://rentora.example/api/sync/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(chatPayload)
  }), env);

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(dbData.chats.length, 1);
  assert.equal(dbData.chats[0].owner_user_id, 'usr_owner');
  assert.equal(dbData.chats[0].renter_user_id, 'usr_renter');
});

test('Chat recipient resolution: Renter sending message correctly routes to Owner', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'uid_owner', username: 'avina60', status: 'active', role: 'user' };
  const renter = { id: 'usr_renter', pi_uid: 'uid_renter', username: 'john_doe', status: 'active', role: 'user' };
  const { env, kvStore, dbData } = createMockEnv({ users: [owner, renter] });

  const token = 'token_renter';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: renter.pi_uid, username: renter.username, role: renter.role }));

  const chatPayload = {
    id: 'chat_456',
    ownerUsername: 'avina60',
    renterUsername: 'john_doe',
    messages: [{ id: 'msg_2', senderUsername: 'john_doe', text: 'Hi, is this drill available?' }]
  };

  const res = await gateway.fetch(new Request('https://rentora.example/api/sync/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(chatPayload)
  }), env);

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(dbData.chats.length, 1);
});

test('Chat recipient resolution: Self-chat is rejected with 400', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'uid_owner', username: 'avina60', status: 'active', role: 'user' };
  const { env, kvStore } = createMockEnv({ users: [owner] });

  const token = 'token_owner';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: owner.pi_uid, username: owner.username, role: owner.role }));

  const selfChatPayload = {
    id: 'chat_self',
    ownerUsername: 'avina60',
    renterUsername: 'avina60',
    messages: [{ id: 'msg_self', senderUsername: 'avina60', text: 'Chatting with myself' }]
  };

  const res = await gateway.fetch(new Request('https://rentora.example/api/sync/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(selfChatPayload)
  }), env);

  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.error, 'Chat recipient cannot be self');
});
