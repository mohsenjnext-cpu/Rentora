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
              if (query.includes('FROM users') && query.includes('WHERE id = ?1 OR pi_uid = ?1 OR lower(username) = lower(?1)')) {
                const param = String(params[0] || '').toLowerCase();
                return dbData.users.find(u =>
                  u.id === params[0] ||
                  u.pi_uid === params[0] ||
                  (u.username && u.username.toLowerCase() === param)
                ) || null;
              }
              if (query.includes('FROM listings WHERE id=?1') || query.includes('FROM listings WHERE id = ?1')) {
                return dbData.listings.find(l => l.id === params[0] && l.status !== 'deleted') || null;
              }
              if (query.includes('FROM rentals') && (query.includes('WHERE r.id = ?1') || query.includes('WHERE r.id=?1'))) {
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
                  renter_username: ru.username,
                  renter_display_name: ru.display_name,
                  renter_avatar: ru.avatar_url,
                  owner_username: ou.username,
                  owner_display_name: ou.display_name,
                  owner_avatar: ou.avatar_url
                };
              }
              if (query.includes('FROM reviews') && query.includes('WHERE rental_id = ?1 AND reviewer_user_id = ?2 AND reviewee_user_id = ?3')) {
                return dbData.reviews.find(rev =>
                  rev.rental_id === params[0] &&
                  rev.reviewer_user_id === params[1] &&
                  rev.reviewee_user_id === params[2]
                ) || null;
              }
              return null;
            },
            async all() {
              if (query.includes('FROM reviews r') && query.includes('WHERE r.rental_id = ?1')) {
                const matched = dbData.reviews.filter(rev => rev.rental_id === params[0]);
                const results = matched.map(rev => {
                  const u = dbData.users.find(usr => usr.id === rev.reviewer_user_id) || {};
                  return {
                    ...rev,
                    reviewer_username: u.username,
                    reviewer_display_name: u.display_name,
                    reviewer_avatar: u.avatar_url
                  };
                });
                return { results };
              }
              if (query.includes('FROM reviews r') && query.includes('WHERE r.reviewee_user_id = ?1')) {
                const matched = dbData.reviews.filter(rev => rev.reviewee_user_id === params[0] && rev.status === 'approved');
                const results = matched.map(rev => {
                  const u = dbData.users.find(usr => usr.id === rev.reviewer_user_id) || {};
                  const l = dbData.listings.find(item => item.id === rev.listing_id) || {};
                  return {
                    ...rev,
                    reviewer_username: u.username,
                    reviewer_display_name: u.display_name,
                    reviewer_avatar: u.avatar_url,
                    listing_title: l.title || ''
                  };
                });
                return { results };
              }
              if (query.includes('FROM reviews r') && query.includes('WHERE r.listing_id = ?1')) {
                const matched = dbData.reviews.filter(rev =>
                  rev.listing_id === params[0] &&
                  rev.reviewee_user_id === params[1] &&
                  rev.status === 'approved'
                );
                const results = matched.map(rev => {
                  const u = dbData.users.find(usr => usr.id === rev.reviewer_user_id) || {};
                  return {
                    ...rev,
                    reviewer_username: u.username,
                    reviewer_display_name: u.display_name,
                    reviewer_avatar: u.avatar_url
                  };
                });
                return { results };
              }
              return { results: [] };
            },
            async run() {
              if (query.includes('INSERT INTO reviews')) {
                dbData.reviews.push({
                  id: params[0],
                  rental_id: params[1],
                  listing_id: params[2],
                  reviewer_user_id: params[3],
                  reviewee_user_id: params[4],
                  rating: params[5],
                  review_text: params[6],
                  status: 'approved',
                  created_at: params[7],
                  updated_at: params[8]
                });
                return { meta: { changes: 1 } };
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

test('1. Review Status: Anonymous request to GET /api/rentals/:id/review-status is rejected with 401', async () => {
  const env = createMockEnv();
  const req = new Request('https://rentora.app/api/rentals/rent_100/review-status', {
    method: 'GET'
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 401);
});

test('2. Review Status: Non-participant user is rejected with 403', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'pi_owner', username: 'owner1', display_name: 'Owner', role: 'user', status: 'active' };
  const renter = { id: 'usr_renter', pi_uid: 'pi_renter', username: 'renter1', display_name: 'Renter', role: 'user', status: 'active' };
  const stranger = { id: 'usr_stranger', pi_uid: 'pi_stranger', username: 'stranger1', display_name: 'Stranger', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: owner.id, title: 'Sony A7IV', status: 'active' };
  const rental = { id: 'rent_1', listing_id: listing.id, renter_user_id: renter.id, status: 'completed', payment_status: 'completed' };

  const env = createMockEnv({
    users: [owner, renter, stranger],
    listings: [listing],
    rentals: [rental]
  });

  const strangerToken = await setupSession(env, stranger);
  const req = new Request(`https://rentora.app/api/rentals/${rental.id}/review-status`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${strangerToken}` }
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 403);
});

test('3. Review Status: Nonexistent rental returns 404', async () => {
  const renter = { id: 'usr_renter', pi_uid: 'pi_renter', username: 'renter1', display_name: 'Renter', role: 'user', status: 'active' };
  const env = createMockEnv({ users: [renter] });
  const token = await setupSession(env, renter);

  const req = new Request('https://rentora.app/api/rentals/rent_nonexistent/review-status', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 404);
});

test('4. Review Status: Unpaid rental (pending_payment / unpaid) returns isEligible: false', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'pi_owner', username: 'owner1', display_name: 'Owner', role: 'user', status: 'active' };
  const renter = { id: 'usr_renter', pi_uid: 'pi_renter', username: 'renter1', display_name: 'Renter', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: owner.id, title: 'Sony A7IV', status: 'active' };
  const rental = { id: 'rent_1', listing_id: listing.id, renter_user_id: renter.id, status: 'pending_payment', payment_status: 'unpaid' };

  const env = createMockEnv({
    users: [owner, renter],
    listings: [listing],
    rentals: [rental]
  });

  const renterToken = await setupSession(env, renter);
  const req = new Request(`https://rentora.app/api/rentals/${rental.id}/review-status`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${renterToken}` }
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.isEligible, false);
  assert.equal(json.hasUserReviewed, false);
});

test('5. Review Status: Active rental in-progress (active / completed payment) returns isEligible: false', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'pi_owner', username: 'owner1', display_name: 'Owner', role: 'user', status: 'active' };
  const renter = { id: 'usr_renter', pi_uid: 'pi_renter', username: 'renter1', display_name: 'Renter', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: owner.id, title: 'Sony A7IV', status: 'active' };
  const rental = { id: 'rent_1', listing_id: listing.id, renter_user_id: renter.id, status: 'active', payment_status: 'completed' };

  const env = createMockEnv({
    users: [owner, renter],
    listings: [listing],
    rentals: [rental]
  });

  const renterToken = await setupSession(env, renter);
  const req = new Request(`https://rentora.app/api/rentals/${rental.id}/review-status`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${renterToken}` }
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.isEligible, false);
});

test('6. Review Status: Completed & paid rental returns isEligible: true with party details', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'pi_owner', username: 'owner1', display_name: 'Owner', role: 'user', status: 'active' };
  const renter = { id: 'usr_renter', pi_uid: 'pi_renter', username: 'renter1', display_name: 'Renter', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: owner.id, title: 'Sony A7IV', status: 'active' };
  const rental = { id: 'rent_1', listing_id: listing.id, renter_user_id: renter.id, status: 'completed', payment_status: 'completed' };

  const env = createMockEnv({
    users: [owner, renter],
    listings: [listing],
    rentals: [rental]
  });

  const renterToken = await setupSession(env, renter);
  const req = new Request(`https://rentora.app/api/rentals/${rental.id}/review-status`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${renterToken}` }
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.isEligible, true);
  assert.equal(json.userRole, 'renter');
  assert.equal(json.otherParty.id, owner.id);
  assert.equal(json.otherParty.username, owner.username);
  assert.equal(json.hasUserReviewed, false);
});

test('7. Review Submission: Anonymous request to POST /api/rentals/:id/reviews is rejected with 401', async () => {
  const env = createMockEnv();
  const req = new Request('https://rentora.app/api/rentals/rent_100/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating: 5, reviewText: 'Great!' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 401);
});

test('8. Review Submission: Non-participant user is rejected with 403', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'pi_owner', username: 'owner1', display_name: 'Owner', role: 'user', status: 'active' };
  const renter = { id: 'usr_renter', pi_uid: 'pi_renter', username: 'renter1', display_name: 'Renter', role: 'user', status: 'active' };
  const stranger = { id: 'usr_stranger', pi_uid: 'pi_stranger', username: 'stranger1', display_name: 'Stranger', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: owner.id, title: 'Sony A7IV', status: 'active' };
  const rental = { id: 'rent_1', listing_id: listing.id, renter_user_id: renter.id, status: 'completed', payment_status: 'completed' };

  const env = createMockEnv({
    users: [owner, renter, stranger],
    listings: [listing],
    rentals: [rental]
  });

  const strangerToken = await setupSession(env, stranger);
  const req = new Request(`https://rentora.app/api/rentals/${rental.id}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${strangerToken}`
    },
    body: JSON.stringify({ rating: 5, reviewText: 'Unauthorized review' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 403);
});

test('9. Review Submission: Incomplete rental (active) is rejected with 403', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'pi_owner', username: 'owner1', display_name: 'Owner', role: 'user', status: 'active' };
  const renter = { id: 'usr_renter', pi_uid: 'pi_renter', username: 'renter1', display_name: 'Renter', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: owner.id, title: 'Sony A7IV', status: 'active' };
  const rental = { id: 'rent_1', listing_id: listing.id, renter_user_id: renter.id, status: 'active', payment_status: 'completed' };

  const env = createMockEnv({
    users: [owner, renter],
    listings: [listing],
    rentals: [rental]
  });

  const renterToken = await setupSession(env, renter);
  const req = new Request(`https://rentora.app/api/rentals/${rental.id}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${renterToken}`
    },
    body: JSON.stringify({ rating: 5, reviewText: 'Too early' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 403);
});

test('10. Review Submission: Unpaid rental (unpaid) is rejected with 403', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'pi_owner', username: 'owner1', display_name: 'Owner', role: 'user', status: 'active' };
  const renter = { id: 'usr_renter', pi_uid: 'pi_renter', username: 'renter1', display_name: 'Renter', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: owner.id, title: 'Sony A7IV', status: 'active' };
  const rental = { id: 'rent_1', listing_id: listing.id, renter_user_id: renter.id, status: 'completed', payment_status: 'unpaid' };

  const env = createMockEnv({
    users: [owner, renter],
    listings: [listing],
    rentals: [rental]
  });

  const renterToken = await setupSession(env, renter);
  const req = new Request(`https://rentora.app/api/rentals/${rental.id}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${renterToken}`
    },
    body: JSON.stringify({ rating: 5, reviewText: 'Unpaid review' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 403);
});

test('11. Review Submission: Rating < 1 (e.g. 0) is rejected with 400', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'pi_owner', username: 'owner1', display_name: 'Owner', role: 'user', status: 'active' };
  const renter = { id: 'usr_renter', pi_uid: 'pi_renter', username: 'renter1', display_name: 'Renter', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: owner.id, title: 'Sony A7IV', status: 'active' };
  const rental = { id: 'rent_1', listing_id: listing.id, renter_user_id: renter.id, status: 'completed', payment_status: 'completed' };

  const env = createMockEnv({
    users: [owner, renter],
    listings: [listing],
    rentals: [rental]
  });

  const renterToken = await setupSession(env, renter);
  const req = new Request(`https://rentora.app/api/rentals/${rental.id}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${renterToken}`
    },
    body: JSON.stringify({ rating: 0, reviewText: 'Zero stars' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 400);
});

test('12. Review Submission: Rating > 5 (e.g. 6) is rejected with 400', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'pi_owner', username: 'owner1', display_name: 'Owner', role: 'user', status: 'active' };
  const renter = { id: 'usr_renter', pi_uid: 'pi_renter', username: 'renter1', display_name: 'Renter', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: owner.id, title: 'Sony A7IV', status: 'active' };
  const rental = { id: 'rent_1', listing_id: listing.id, renter_user_id: renter.id, status: 'completed', payment_status: 'completed' };

  const env = createMockEnv({
    users: [owner, renter],
    listings: [listing],
    rentals: [rental]
  });

  const renterToken = await setupSession(env, renter);
  const req = new Request(`https://rentora.app/api/rentals/${rental.id}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${renterToken}`
    },
    body: JSON.stringify({ rating: 6, reviewText: 'Six stars' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 400);
});

test('13. Review Submission: Non-integer rating (e.g. 4.5 or string) is rejected with 400', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'pi_owner', username: 'owner1', display_name: 'Owner', role: 'user', status: 'active' };
  const renter = { id: 'usr_renter', pi_uid: 'pi_renter', username: 'renter1', display_name: 'Renter', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: owner.id, title: 'Sony A7IV', status: 'active' };
  const rental = { id: 'rent_1', listing_id: listing.id, renter_user_id: renter.id, status: 'completed', payment_status: 'completed' };

  const env = createMockEnv({
    users: [owner, renter],
    listings: [listing],
    rentals: [rental]
  });

  const renterToken = await setupSession(env, renter);

  // Float rating
  const req1 = new Request(`https://rentora.app/api/rentals/${rental.id}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${renterToken}`
    },
    body: JSON.stringify({ rating: 4.5, reviewText: 'Float rating' })
  });
  const res1 = await gateway.fetch(req1, env);
  assert.equal(res1.status, 400);

  // String rating
  const req2 = new Request(`https://rentora.app/api/rentals/${rental.id}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${renterToken}`
    },
    body: JSON.stringify({ rating: 'five', reviewText: 'String rating' })
  });
  const res2 = await gateway.fetch(req2, env);
  assert.equal(res2.status, 400);
});

test('14. Review Submission: Review text exceeding 1000 characters is rejected with 400', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'pi_owner', username: 'owner1', display_name: 'Owner', role: 'user', status: 'active' };
  const renter = { id: 'usr_renter', pi_uid: 'pi_renter', username: 'renter1', display_name: 'Renter', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: owner.id, title: 'Sony A7IV', status: 'active' };
  const rental = { id: 'rent_1', listing_id: listing.id, renter_user_id: renter.id, status: 'completed', payment_status: 'completed' };

  const env = createMockEnv({
    users: [owner, renter],
    listings: [listing],
    rentals: [rental]
  });

  const renterToken = await setupSession(env, renter);
  const longText = 'a'.repeat(1001);

  const req = new Request(`https://rentora.app/api/rentals/${rental.id}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${renterToken}`
    },
    body: JSON.stringify({ rating: 5, reviewText: longText })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 400);
});

test('15. Review Submission: Self-rating is strictly prohibited (400)', async () => {
  const user = { id: 'usr_both', pi_uid: 'pi_both', username: 'selfuser', display_name: 'Self', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: user.id, title: 'Self Item', status: 'active' };
  const rental = { id: 'rent_1', listing_id: listing.id, renter_user_id: user.id, status: 'completed', payment_status: 'completed' };

  const env = createMockEnv({
    users: [user],
    listings: [listing],
    rentals: [rental]
  });

  const token = await setupSession(env, user);
  const req = new Request(`https://rentora.app/api/rentals/${rental.id}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ rating: 5, reviewText: 'Rating myself' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 400);
});

test('16. Review Submission: Valid review submission by renter for owner succeeds with 201', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'pi_owner', username: 'owner1', display_name: 'Owner', role: 'user', status: 'active' };
  const renter = { id: 'usr_renter', pi_uid: 'pi_renter', username: 'renter1', display_name: 'Renter', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: owner.id, title: 'Sony A7IV', status: 'active' };
  const rental = { id: 'rent_1', listing_id: listing.id, renter_user_id: renter.id, status: 'completed', payment_status: 'completed' };

  const env = createMockEnv({
    users: [owner, renter],
    listings: [listing],
    rentals: [rental]
  });

  const renterToken = await setupSession(env, renter);
  const req = new Request(`https://rentora.app/api/rentals/${rental.id}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${renterToken}`
    },
    body: JSON.stringify({ rating: 5, reviewText: 'Perfect equipment and great host!' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.review.reviewerUserId, renter.id);
  assert.equal(json.review.revieweeUserId, owner.id);
  assert.equal(json.review.rating, 5);
  assert.equal(json.review.reviewText, 'Perfect equipment and great host!');
});

test('17. Review Submission: Valid review submission by owner for renter succeeds with 201', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'pi_owner', username: 'owner1', display_name: 'Owner', role: 'user', status: 'active' };
  const renter = { id: 'usr_renter', pi_uid: 'pi_renter', username: 'renter1', display_name: 'Renter', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: owner.id, title: 'Sony A7IV', status: 'active' };
  const rental = { id: 'rent_1', listing_id: listing.id, renter_user_id: renter.id, status: 'completed', payment_status: 'completed' };

  const env = createMockEnv({
    users: [owner, renter],
    listings: [listing],
    rentals: [rental]
  });

  const ownerToken = await setupSession(env, owner);
  const req = new Request(`https://rentora.app/api/rentals/${rental.id}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`
    },
    body: JSON.stringify({ rating: 5, reviewText: 'Responsible and punctual renter!' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.review.reviewerUserId, owner.id);
  assert.equal(json.review.revieweeUserId, renter.id);
  assert.equal(json.review.rating, 5);
});

test('18. Review Submission: Duplicate review in same direction is rejected with 409', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'pi_owner', username: 'owner1', display_name: 'Owner', role: 'user', status: 'active' };
  const renter = { id: 'usr_renter', pi_uid: 'pi_renter', username: 'renter1', display_name: 'Renter', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: owner.id, title: 'Sony A7IV', status: 'active' };
  const rental = { id: 'rent_1', listing_id: listing.id, renter_user_id: renter.id, status: 'completed', payment_status: 'completed' };
  const existingReview = {
    id: 'rev_1',
    rental_id: rental.id,
    listing_id: listing.id,
    reviewer_user_id: renter.id,
    reviewee_user_id: owner.id,
    rating: 5,
    review_text: 'First review',
    status: 'approved'
  };

  const env = createMockEnv({
    users: [owner, renter],
    listings: [listing],
    rentals: [rental],
    reviews: [existingReview]
  });

  const renterToken = await setupSession(env, renter);
  const req = new Request(`https://rentora.app/api/rentals/${rental.id}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${renterToken}`
    },
    body: JSON.stringify({ rating: 4, reviewText: 'Trying second review' })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 409);
});

test('19. Public User Reviews: GET /api/users/:id/reviews returns aggregate stats and reviews list', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'pi_owner', username: 'owner1', display_name: 'Owner', role: 'user', status: 'active' };
  const reviewer1 = { id: 'usr_rev1', pi_uid: 'pi_rev1', username: 'pioneerA', display_name: 'Pioneer A', role: 'user', status: 'active' };
  const reviewer2 = { id: 'usr_rev2', pi_uid: 'pi_rev2', username: 'pioneerB', display_name: 'Pioneer B', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: owner.id, title: 'Camping Tent', status: 'active' };

  const review1 = {
    id: 'rev_1',
    rental_id: 'rent_1',
    listing_id: listing.id,
    reviewer_user_id: reviewer1.id,
    reviewee_user_id: owner.id,
    rating: 5,
    review_text: 'Excellent service',
    status: 'approved',
    created_at: '2026-09-01T10:00:00Z'
  };

  const review2 = {
    id: 'rev_2',
    rental_id: 'rent_2',
    listing_id: listing.id,
    reviewer_user_id: reviewer2.id,
    reviewee_user_id: owner.id,
    rating: 4,
    review_text: 'Good experience',
    status: 'approved',
    created_at: '2026-09-02T10:00:00Z'
  };

  const env = createMockEnv({
    users: [owner, reviewer1, reviewer2],
    listings: [listing],
    reviews: [review1, review2]
  });

  const req = new Request(`https://rentora.app/api/users/${owner.username}/reviews`, {
    method: 'GET'
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.stats.totalReviews, 2);
  assert.equal(json.stats.averageRating, 4.5);
  assert.equal(json.stats.isNew, false);
  assert.equal(json.reviews.length, 2);
  assert.equal(json.reviews[0].reviewerUsername, 'pioneerA');
});

test('20. Public Listing Reviews: GET /api/listings/:id/reviews returns aggregate stats and reviews list', async () => {
  const owner = { id: 'usr_owner', pi_uid: 'pi_owner', username: 'owner1', display_name: 'Owner', role: 'user', status: 'active' };
  const reviewer1 = { id: 'usr_rev1', pi_uid: 'pi_rev1', username: 'pioneerA', display_name: 'Pioneer A', role: 'user', status: 'active' };
  const listing = { id: 'item_1', owner_user_id: owner.id, title: 'Pro Drone', status: 'active' };

  const review1 = {
    id: 'rev_1',
    rental_id: 'rent_1',
    listing_id: listing.id,
    reviewer_user_id: reviewer1.id,
    reviewee_user_id: owner.id,
    rating: 5,
    review_text: 'Flawless drone in top shape',
    status: 'approved',
    created_at: '2026-09-05T12:00:00Z'
  };

  const env = createMockEnv({
    users: [owner, reviewer1],
    listings: [listing],
    reviews: [review1]
  });

  const req = new Request(`https://rentora.app/api/listings/${listing.id}/reviews`, {
    method: 'GET'
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.stats.totalReviews, 1);
  assert.equal(json.stats.averageRating, 5.0);
  assert.equal(json.reviews.length, 1);
  assert.equal(json.reviews[0].reviewerUsername, 'pioneerA');
  assert.equal(json.reviews[0].reviewText, 'Flawless drone in top shape');
});

test('21. Legacy Review Sync Endpoint: POST /api/sync/review returns 410 Gone', async () => {
  const env = createMockEnv();
  const req = new Request('https://rentora.app/api/sync/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rentalId: 'rent_1', rating: 5 })
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 410);
});

test('22. New Pioneer without reviews: GET /api/users/:id/reviews returns isNew: true and averageRating: null', async () => {
  const newUser = { id: 'usr_new', pi_uid: 'pi_new', username: 'newpioneer', display_name: 'New Pioneer', role: 'user', status: 'active' };
  const env = createMockEnv({ users: [newUser], reviews: [] });

  const req = new Request(`https://rentora.app/api/users/${newUser.username}/reviews`, {
    method: 'GET'
  });
  const res = await gateway.fetch(req, env);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.stats.totalReviews, 0);
  assert.equal(json.stats.averageRating, null);
  assert.equal(json.stats.isNew, true);
  assert.equal(json.reviews.length, 0);
});
