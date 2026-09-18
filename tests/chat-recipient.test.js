import test from 'node:test';
import assert from 'node:assert/strict';
import gateway from '../worker-gateway2.js';

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
              if (query.includes('FROM users WHERE id=?1')) {
                return dbData.users.find(u => u.id === params[0]) || null;
              }
              if (query.includes('FROM listings WHERE id=?1')) {
                return dbData.listings.find(l => l.id === params[0] && l.status !== 'deleted') || null;
              }
              if (query.includes('FROM conversations') && query.includes('WHERE listing_id = ?1 AND renter_user_id = ?2 AND type = ?3')) {
                return dbData.conversations.find(c => c.listing_id === params[0] && c.renter_user_id === params[1] && c.type === params[2]) || null;
              }
              if (query.includes('FROM conversations WHERE id=?1')) {
                return dbData.conversations.find(c => c.id === params[0]) || null;
              }
              return null;
            },
            async all() {
              return { results: [] };
            },
            async run() {
              if (query.includes('INSERT INTO conversations')) {
                dbData.conversations.push({
                  id: params[0],
                  listing_id: params[1],
                  rental_id: params[2],
                  owner_user_id: params[3],
                  renter_user_id: params[4],
                  type: params[5],
                  status: 'active',
                  created_at: params[6],
                  updated_at: params[6]
                });
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

test('Conversation creation: Renter starting conversation for listing correctly routes to Owner', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'uid_owner', username: 'avina60', status: 'active', role: 'user' };
  const renter = { id: 'usr_renter', pi_uid: 'uid_renter', username: 'john_doe', status: 'active', role: 'user' };
  const listing = { id: 'item_123', owner_user_id: 'usr_owner', title: 'Drill', status: 'active', price_per_day: 5 };
  const { env, kvStore, dbData } = createMockEnv({ users: [owner, renter], listings: [listing] });

  const token = 'token_renter';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: renter.pi_uid, username: renter.username, role: renter.role }));

  const res = await gateway.fetch(new Request('https://rentora.example/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ listingId: 'item_123' })
  }), env);

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(dbData.conversations.length, 1);
  assert.equal(dbData.conversations[0].owner_user_id, 'usr_owner');
  assert.equal(dbData.conversations[0].renter_user_id, 'usr_renter');
  assert.equal(dbData.conversations[0].type, 'pre_booking');
});

test('Conversation creation: Self-conversation is rejected with 400', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'uid_owner', username: 'avina60', status: 'active', role: 'user' };
  const listing = { id: 'item_mine', owner_user_id: 'usr_owner', title: 'Drill', status: 'active', price_per_day: 5 };
  const { env, kvStore } = createMockEnv({ users: [owner], listings: [listing] });

  const token = 'token_owner';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: owner.pi_uid, username: owner.username, role: owner.role }));

  const res = await gateway.fetch(new Request('https://rentora.example/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ listingId: 'item_mine' })
  }), env);

  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.error, 'Self-conversation is not allowed');
});
