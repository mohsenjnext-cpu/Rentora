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
              if (query.includes('FROM users WHERE id=?1')) {
                return dbData.users.find(u => u.id === params[0]) || null;
              }
              if (query.includes('FROM listings WHERE id=?1')) {
                return dbData.listings.find(l => l.id === params[0] && l.status !== 'deleted') || null;
              }
              if (query.includes('FROM rentals') && query.includes('WHERE r.id = ?1') || query.includes('WHERE r.id=?1')) {
                const r = dbData.rentals.find(item => item.id === params[0]);
                if (!r) return null;
                const l = dbData.listings.find(item => item.id === r.listing_id) || {};
                const ru = dbData.users.find(u => u.id === r.renter_user_id) || {};
                const ou = dbData.users.find(u => u.id === l.owner_user_id) || {};
                return {
                  ...r,
                  listing_id: l.id,
                  owner_user_id: l.owner_user_id,
                  listing_title: l.title,
                  price_per_day: l.price_per_day,
                  renter_username: ru.username,
                  renter_pi_uid: ru.pi_uid,
                  owner_username: ou.username,
                  owner_pi_uid: ou.pi_uid
                };
              }
              if (query.includes('FROM conversations') && query.includes('WHERE listing_id = ?1 AND renter_user_id = ?2 AND type = ?3')) {
                return dbData.conversations.find(c => c.listing_id === params[0] && c.renter_user_id === params[1] && c.type === params[2]) || null;
              }
              if (query.includes('FROM conversations') && query.includes('WHERE c.id = ?1') || query.includes('WHERE id=?1')) {
                const c = dbData.conversations.find(item => item.id === params[0]);
                if (!c) return null;
                const r = c.rental_id ? dbData.rentals.find(item => item.id === c.rental_id) : null;
                return {
                  ...c,
                  rental_status: r?.status || null,
                  rental_payment_status: r?.payment_status || null
                };
              }
              return null;
            },
            async all() {
              if (query.includes('FROM conversations c')) {
                const userId = params[0];
                const matched = dbData.conversations.filter(c => (c.owner_user_id === userId || c.renter_user_id === userId) && c.status !== 'archived');
                return {
                  results: matched.map(c => {
                    const l = dbData.listings.find(item => item.id === c.listing_id) || {};
                    const ou = dbData.users.find(u => u.id === c.owner_user_id) || {};
                    const ru = dbData.users.find(u => u.id === c.renter_user_id) || {};
                    const r = c.rental_id ? dbData.rentals.find(item => item.id === c.rental_id) : null;
                    return {
                      ...c,
                      listing_title: l.title,
                      price_per_day: l.price_per_day,
                      listing_location: l.location,
                      owner_pi_uid: ou.pi_uid,
                      owner_username: ou.username,
                      owner_display_name: ou.display_name,
                      owner_avatar: ou.avatar_url,
                      renter_pi_uid: ru.pi_uid,
                      renter_username: ru.username,
                      renter_display_name: ru.display_name,
                      renter_avatar: ru.avatar_url,
                      rental_status: r?.status || null,
                      rental_payment_status: r?.payment_status || null,
                      rental_amount: r?.rental_amount || null,
                      platform_fee: r?.platform_fee || null,
                      start_date: r?.start_date || null,
                      end_date: r?.end_date || null
                    };
                  })
                };
              }
              if (query.includes('FROM messages m')) {
                const convId = params[0];
                const matched = dbData.messages.filter(m => m.conversation_id === convId);
                return {
                  results: matched.map(m => {
                    const u = dbData.users.find(user => user.id === m.sender_user_id) || {};
                    return {
                      ...m,
                      sender_pi_uid: u.pi_uid,
                      sender_username: u.username,
                      sender_display_name: u.display_name,
                      sender_avatar: u.avatar_url
                    };
                  })
                };
              }
              if (query.includes('FROM listings l')) {
                return {
                  results: dbData.listings.filter(l => l.status !== 'deleted').map(l => {
                    const u = dbData.users.find(user => user.id === l.owner_user_id) || {};
                    return { ...l, owner_pi_uid: u.pi_uid, owner_username: u.username, owner_avatar: u.avatar_url };
                  })
                };
              }
              if (query.includes('FROM reviews r')) {
                return { results: [] };
              }
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
              if (query.includes('INSERT INTO messages')) {
                dbData.messages.push({
                  id: params[0],
                  conversation_id: params[1],
                  sender_user_id: params[2],
                  message_text: params[3],
                  message_type: params[4],
                  moderation_status: 'approved',
                  created_at: params[5]
                });
                return { meta: { changes: 1 } };
              }
              if (query.includes('UPDATE conversations SET status="archived"')) {
                const conv = dbData.conversations.find(c => c.id === params[1]);
                if (conv) conv.status = 'archived';
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 1 } };
            }
          };
        }
      };
    },
    async batch(queries) {
      return queries;
    }
  };

  return {
    env: {
      RENTORA_DB: mockDb,
      RENTORA_KV: {
        async get(key) { return kvStore.get(key) || null; },
        async put(key, val) { kvStore.set(key, val); },
        async delete(key) { kvStore.delete(key); }
      },
      ADMIN_PI_UIDS: 'uid_admin,avina60'
    },
    kvStore,
    dbData
  };
}

// -----------------------------------------------------------------------------
// 1. Anonymous Authentication Checks
// -----------------------------------------------------------------------------
test('Secure Chat 1: Anonymous request to GET /api/conversations is rejected with 401', async () => {
  const { env } = createMockEnv();
  const res = await gateway.fetch(new Request('https://rentora.example/api/conversations', { method: 'GET' }), env);
  assert.equal(res.status, 401);
});

test('Secure Chat 2: Anonymous request to POST /api/conversations is rejected with 401', async () => {
  const { env } = createMockEnv();
  const res = await gateway.fetch(new Request('https://rentora.example/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId: 'item_1' })
  }), env);
  assert.equal(res.status, 401);
});

test('Secure Chat 3: Anonymous request to GET /api/conversations/:id/messages is rejected with 401', async () => {
  const { env } = createMockEnv();
  const res = await gateway.fetch(new Request('https://rentora.example/api/conversations/conv_1/messages', { method: 'GET' }), env);
  assert.equal(res.status, 401);
});

test('Secure Chat 4: Anonymous request to POST /api/conversations/:id/messages is rejected with 401', async () => {
  const { env } = createMockEnv();
  const res = await gateway.fetch(new Request('https://rentora.example/api/conversations/conv_1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Hello' })
  }), env);
  assert.equal(res.status, 401);
});

// -----------------------------------------------------------------------------
// 2. Pre-Booking Anti-Bypass Filtering
// -----------------------------------------------------------------------------
test('Secure Chat 5: Anti-Bypass blocks Iranian phone number in pre-booking message', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'uid_owner', username: 'owner_user', status: 'active', role: 'user' };
  const renter = { id: 'usr_renter', pi_uid: 'uid_renter', username: 'renter_user', status: 'active', role: 'user' };
  const listing = { id: 'item_drill', owner_user_id: 'usr_owner', title: 'Bosch Hammer Drill', price_per_day: 5, status: 'active' };
  const conv = { id: 'conv_test_1', listing_id: 'item_drill', owner_user_id: 'usr_owner', renter_user_id: 'usr_renter', type: 'pre_booking', status: 'active' };

  const { env, kvStore } = createMockEnv({ users: [owner, renter], listings: [listing], conversations: [conv] });
  const token = 'renter_tok';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: renter.pi_uid, username: renter.username, role: renter.role }));

  const bypassAttempts = [
    'سلام، شماره من 09123456789 هست تماس بگیرید',
    '۰۹۱۲۳۴۵۶۷۸۹ شمارمه زنگ بزن',
    'با شماره 0912-345-6789 تماس بگیر هماهنگ کنیم',
    'شمارم: 0 9 1 2 3 4 5 6 7 8 9',
    '+989123456789 whatsapp me',
    'تماس بگیرید ۰۹۱۲ ۳۴۵ ۶۷۸۹'
  ];

  for (const text of bypassAttempts) {
    const res = await gateway.fetch(new Request('https://rentora.example/api/conversations/conv_test_1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text })
    }), env);

    assert.equal(res.status, 400, `Expected 400 for text: "${text}"`);
    const json = await res.json();
    assert.equal(json.code, 'CONTACT_INFO_BLOCKED');
  }
});

test('Secure Chat 6: Anti-Bypass blocks WhatsApp, Telegram, Email, and URLs in pre-booking', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'uid_owner', username: 'owner_user', status: 'active', role: 'user' };
  const renter = { id: 'usr_renter', pi_uid: 'uid_renter', username: 'renter_user', status: 'active', role: 'user' };
  const listing = { id: 'item_drill', owner_user_id: 'usr_owner', title: 'Bosch Hammer Drill', price_per_day: 5, status: 'active' };
  const conv = { id: 'conv_test_2', listing_id: 'item_drill', owner_user_id: 'usr_owner', renter_user_id: 'usr_renter', type: 'pre_booking', status: 'active' };

  const { env, kvStore } = createMockEnv({ users: [owner, renter], listings: [listing], conversations: [conv] });
  const token = 'renter_tok';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: renter.pi_uid, username: renter.username, role: renter.role }));

  const bypassAttempts = [
    'پیام بده به تلگرامم: @pioneer_iran',
    'آیدی تلگرام: t.me/pioneer_iran',
    'توی واتساپ پیام بده wa.me/989123456789',
    'به ایمیلم پیام بده test.user@gmail.com',
    'بیا توی سایت من https://rent-direct.com',
    'خارج از برنامه کارت به کارت کنیم بدون کارمزد'
  ];

  for (const text of bypassAttempts) {
    const res = await gateway.fetch(new Request('https://rentora.example/api/conversations/conv_test_2/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text })
    }), env);

    assert.equal(res.status, 400, `Expected 400 for text: "${text}"`);
    const json = await res.json();
    assert.equal(json.code, 'CONTACT_INFO_BLOCKED');
  }
});

// -----------------------------------------------------------------------------
// 3. Legitimate Pre-Booking Inquiries Are Allowed
// -----------------------------------------------------------------------------
test('Secure Chat 7: Legitimate item inquiries are allowed in pre-booking mode', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'uid_owner', username: 'owner_user', status: 'active', role: 'user' };
  const renter = { id: 'usr_renter', pi_uid: 'uid_renter', username: 'renter_user', status: 'active', role: 'user' };
  const listing = { id: 'item_drill', owner_user_id: 'usr_owner', title: 'Bosch Hammer Drill', price_per_day: 5, status: 'active' };
  const conv = { id: 'conv_test_3', listing_id: 'item_drill', owner_user_id: 'usr_owner', renter_user_id: 'usr_renter', type: 'pre_booking', status: 'active' };

  const { env, kvStore, dbData } = createMockEnv({ users: [owner, renter], listings: [listing], conversations: [conv] });
  const token = 'renter_tok';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: renter.pi_uid, username: renter.username, role: renter.role }));

  const validInquiries = [
    'سلام، آیا دریل همراه با مته و جعبه اصلی ارائه می‌شود؟',
    'دستگاه کاملا سالم و تست شده است؟',
    'امکان تحویل گرفتن کالا در شیفت بعدازظهر وجود دارد؟'
  ];

  for (const text of validInquiries) {
    const res = await gateway.fetch(new Request('https://rentora.example/api/conversations/conv_test_3/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text })
    }), env);

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.message.text, text);
    assert.equal(json.message.senderUsername, 'renter_user');
  }
});

// -----------------------------------------------------------------------------
// 4. Post-Booking Unlocked Coordination
// -----------------------------------------------------------------------------
test('Secure Chat 8: Post-booking coordination allows pickup address & phone coordination after verified payment', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'uid_owner', username: 'owner_user', status: 'active', role: 'user' };
  const renter = { id: 'usr_renter', pi_uid: 'uid_renter', username: 'renter_user', status: 'active', role: 'user' };
  const listing = { id: 'item_drill', owner_user_id: 'usr_owner', title: 'Bosch Hammer Drill', price_per_day: 5, status: 'active' };
  const rental = { id: 'rental_confirmed_1', listing_id: 'item_drill', renter_user_id: 'usr_renter', status: 'confirmed', payment_status: 'completed' };
  const conv = { id: 'conv_post_booking_1', listing_id: 'item_drill', rental_id: 'rental_confirmed_1', owner_user_id: 'usr_owner', renter_user_id: 'usr_renter', type: 'post_booking', status: 'active' };

  const { env, kvStore } = createMockEnv({ users: [owner, renter], listings: [listing], rentals: [rental], conversations: [conv] });
  const token = 'renter_tok';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: renter.pi_uid, username: renter.username, role: renter.role }));

  const coordinationMsg = 'سلام، من پرداخت را انجام دادم. شماره من 09123456789 است. آدرس دقیق تحویل: تهران، خیابان آزادی...';
  const res = await gateway.fetch(new Request('https://rentora.example/api/conversations/conv_post_booking_1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text: coordinationMsg })
  }), env);

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.message.text, coordinationMsg);
});

// -----------------------------------------------------------------------------
// 5. Ownership & Access Control Guards
// -----------------------------------------------------------------------------
test('Secure Chat 9: User cannot start conversation with themselves for their own listing', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'uid_owner', username: 'owner_user', status: 'active', role: 'user' };
  const listing = { id: 'item_mine', owner_user_id: 'usr_owner', title: 'My Camera', price_per_day: 10, status: 'active' };

  const { env, kvStore } = createMockEnv({ users: [owner], listings: [listing] });
  const token = 'owner_tok';
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

test('Secure Chat 10: Third-party user cannot view or send messages in another users conversation', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'uid_owner', username: 'owner_user', status: 'active', role: 'user' };
  const renter = { id: 'usr_renter', pi_uid: 'uid_renter', username: 'renter_user', status: 'active', role: 'user' };
  const eavesdropper = { id: 'usr_stranger', pi_uid: 'uid_stranger', username: 'stranger', status: 'active', role: 'user' };
  const listing = { id: 'item_drill', owner_user_id: 'usr_owner', title: 'Bosch Hammer Drill', price_per_day: 5, status: 'active' };
  const conv = { id: 'conv_private', listing_id: 'item_drill', owner_user_id: 'usr_owner', renter_user_id: 'usr_renter', type: 'pre_booking', status: 'active' };

  const { env, kvStore } = createMockEnv({ users: [owner, renter, eavesdropper], listings: [listing], conversations: [conv] });
  const token = 'stranger_tok';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: eavesdropper.pi_uid, username: eavesdropper.username, role: eavesdropper.role }));

  // Stranger tries to read messages
  const getRes = await gateway.fetch(new Request('https://rentora.example/api/conversations/conv_private/messages', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  }), env);
  assert.equal(getRes.status, 403);

  // Stranger tries to post message
  const postRes = await gateway.fetch(new Request('https://rentora.example/api/conversations/conv_private/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text: 'Infiltrating conversation' })
  }), env);
  assert.equal(postRes.status, 403);
});

// -----------------------------------------------------------------------------
// 6. Deprecation of Legacy Chat Endpoints & Isolation
// -----------------------------------------------------------------------------
test('Secure Chat 11: Legacy chat sync endpoints return 410 Gone', async () => {
  const user = { id: 'usr_test', pi_uid: 'uid_test', username: 'test_user', status: 'active', role: 'user' };
  const { env, kvStore } = createMockEnv({ users: [user] });
  const token = 'test_tok';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const chatPost = await gateway.fetch(new Request('https://rentora.example/api/sync/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id: 'chat_old' })
  }), env);
  assert.equal(chatPost.status, 410);

  const chatDelete = await gateway.fetch(new Request('https://rentora.example/api/sync/chat/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id: 'chat_old' })
  }), env);
  assert.equal(chatDelete.status, 410);
});

// -----------------------------------------------------------------------------
// 7. Cache-Control & Privacy Headers
// -----------------------------------------------------------------------------
test('Secure Chat 12: Conversation and message responses contain private no-store headers', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'uid_owner', username: 'owner_user', status: 'active', role: 'user' };
  const renter = { id: 'usr_renter', pi_uid: 'uid_renter', username: 'renter_user', status: 'active', role: 'user' };
  const listing = { id: 'item_drill', owner_user_id: 'usr_owner', title: 'Bosch Hammer Drill', price_per_day: 5, status: 'active' };
  const conv = { id: 'conv_headers_check', listing_id: 'item_drill', owner_user_id: 'usr_owner', renter_user_id: 'usr_renter', type: 'pre_booking', status: 'active' };

  const { env, kvStore } = createMockEnv({ users: [owner, renter], listings: [listing], conversations: [conv] });
  const token = 'renter_tok';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: renter.pi_uid, username: renter.username, role: renter.role }));

  const convListRes = await gateway.fetch(new Request('https://rentora.example/api/conversations', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  }), env);
  assert.equal(convListRes.status, 200);
  assert.ok(convListRes.headers.get('Cache-Control')?.includes('no-store'));

  const msgListRes = await gateway.fetch(new Request('https://rentora.example/api/conversations/conv_headers_check/messages', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  }), env);
  assert.equal(msgListRes.status, 200);
  assert.ok(msgListRes.headers.get('Cache-Control')?.includes('no-store'));
});
