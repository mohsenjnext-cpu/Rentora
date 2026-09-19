import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';
import gateway from '../worker-gateway.js';

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function createContactMockEnv(initialData = {}) {
  const kvStore = new Map();
  const dbData = {
    users: initialData.users || [],
    listings: initialData.listings || [],
    listing_contacts: initialData.listing_contacts || [],
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

          // Users
          if (q.includes('FROM users WHERE pi_uid = ?1') || q.includes('FROM users WHERE pi_uid=?1')) {
            const uid = this._params[0];
            return dbData.users.find((u) => u.pi_uid === uid) || null;
          }
          if (q.includes('FROM users WHERE id=?1')) {
            const id = this._params[0];
            return dbData.users.find((u) => u.id === id) || null;
          }

          // Rentals Contact Query
          if (q.includes('FROM rentals r') && q.includes('JOIN listings l') && q.includes('JOIN users u') && q.includes('WHERE r.id = ?1')) {
            const rentalId = this._params[0];
            const rental = dbData.rentals.find(r => r.id === rentalId);
            if (!rental) return null;
            const listing = dbData.listings.find(l => l.id === rental.listing_id);
            if (!listing) return null;
            const owner = dbData.users.find(u => u.id === listing.owner_user_id) || {};
            const contact = dbData.listing_contacts.find(c => c.listing_id === listing.id) || {};
            return {
              rental_id: rental.id,
              listing_id: listing.id,
              renter_user_id: rental.renter_user_id,
              rental_status: rental.status,
              payment_status: rental.payment_status,
              owner_user_id: listing.owner_user_id,
              listing_title: listing.title,
              owner_username: owner.username || '',
              owner_display_name: owner.display_name || '',
              contact_name: contact.contact_name || null,
              contact_phone: contact.contact_phone || null,
              whatsapp: contact.whatsapp || null,
              preferred_contact_method: contact.preferred_contact_method || 'phone',
              contact_hours: contact.contact_hours || null,
              coordination_notes: contact.coordination_notes || null,
              contact_updated_at: contact.updated_at || null
            };
          }

          // Listings Contact Query (Owner/Admin direct)
          if (q.includes('FROM listings l') && q.includes('LEFT JOIN listing_contacts lc') && q.includes('WHERE l.id = ?1')) {
            const listingId = this._params[0];
            const listing = dbData.listings.find(l => l.id === listingId);
            if (!listing) return null;
            const contact = dbData.listing_contacts.find(c => c.listing_id === listingId) || {};
            return {
              listing_id: listing.id,
              owner_user_id: listing.owner_user_id,
              listing_title: listing.title,
              contact_name: contact.contact_name || null,
              contact_phone: contact.contact_phone || null,
              whatsapp: contact.whatsapp || null,
              preferred_contact_method: contact.preferred_contact_method || 'phone',
              contact_hours: contact.contact_hours || null,
              coordination_notes: contact.coordination_notes || null,
              contact_updated_at: contact.updated_at || null
            };
          }

          // Listings
          if (q.includes('FROM listings WHERE id=?1')) {
            const id = this._params[0];
            return dbData.listings.find((l) => l.id === id) || null;
          }

          return null;
        },
        async all() {
          const q = this._query.trim();
          if (q.includes('FROM listings l JOIN users u')) {
            const activeListings = dbData.listings.filter((l) => l.status !== 'deleted');
            const mapped = activeListings.map((l) => {
              const owner = dbData.users.find((u) => u.id === l.owner_user_id) || {};
              return { ...l, owner_pi_uid: owner.pi_uid, owner_username: owner.username, owner_avatar: owner.avatar_url };
            });
            return { results: mapped };
          }
          if (q.includes('FROM reviews r')) {
            return { results: dbData.reviews };
          }
          if (q.includes('FROM rentals r')) {
            return { results: dbData.rentals };
          }
          if (q.includes('FROM transactions t')) {
            return { results: dbData.transactions };
          }
          if (q.includes('FROM chats c')) {
            return { results: dbData.chats };
          }
          if (q.includes('FROM users')) {
            return { results: dbData.users };
          }
          return { results: [] };
        },
        async run() {
          const q = this._query.trim();

          // Upsert listing_contacts
          if (q.includes('INSERT INTO listing_contacts')) {
            const [listing_id, contact_name, contact_phone, whatsapp, preferred_contact_method, contact_hours, coordination_notes, updated_at] = this._params;
            const idx = dbData.listing_contacts.findIndex(c => c.listing_id === listing_id);
            const entry = { listing_id, contact_name, contact_phone, whatsapp, preferred_contact_method, contact_hours, coordination_notes, updated_at };
            if (idx >= 0) {
              dbData.listing_contacts[idx] = entry;
            } else {
              dbData.listing_contacts.push(entry);
            }
            return { meta: { changes: 1 } };
          }

          // Insert listing
          if (q.includes('INSERT INTO listings')) {
            const [id, owner_user_id, title, description, category, location, price_per_day, deposit_amount, platform_fee_rate, metadata, created_at] = this._params;
            dbData.listings.push({
              id, owner_user_id, title, description, category, location,
              price_per_day, deposit_amount, platform_fee_rate, status: 'active',
              metadata, created_at, updated_at: created_at
            });
            return { meta: { changes: 1 } };
          }

          // Update listing
          if (q.includes('UPDATE listings SET')) {
            const id = this._params[7];
            const listing = dbData.listings.find(l => l.id === id);
            if (listing) {
              listing.title = this._params[0];
              listing.description = this._params[1];
              listing.category = this._params[2];
              listing.location = this._params[3];
              listing.status = this._params[4];
              listing.metadata = this._params[5];
              listing.updated_at = this._params[6];
            }
            return { meta: { changes: 1 } };
          }

          return { meta: { changes: 1 } };
        }
      };
    },
    async batch(stmts) {
      for (const s of stmts) await s.run();
      return [];
    }
  };

  const mockKv = {
    async get(key) { return kvStore.get(key) || null; },
    async getWithMetadata(key) {
      const val = kvStore.get(key);
      if (!val) return null;
      return { value: val, metadata: { mimeType: 'image/jpeg', uploaderUid: 'mock' } };
    },
    async put(key, val) { kvStore.set(key, typeof val === 'string' ? val : JSON.stringify(val)); },
    async delete(key) { kvStore.delete(key); },
  };

  return {
    env: {
      RENTORA_DB: mockDb,
      RENTORA_KV: mockKv,
      ADMIN_PI_UIDS: 'avina60,mohsenjnext',
      PLATFORM_FEE_RATE: '0.05',
    },
    kvStore,
    dbData,
  };
}

// 1. Anonymous -> 401
test('Contact Security 1: Anonymous request to /api/rentals/:id/contact is rejected with 401', async () => {
  const { env } = createContactMockEnv();
  const res = await worker.fetch(new Request('https://rentora.example/api/rentals/rnt_100/contact', { method: 'GET' }), env);
  assert.equal(res.status, 401);
});

// 2. Unauthorized Renter (different user) -> 403
test('Contact Security 2: Request from a user who is not renter or owner is rejected with 403', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const bob = { id: 'usr_bob', pi_uid: 'pi_bob', username: 'bob', display_name: 'Bob', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const charlie = { id: 'usr_charlie', pi_uid: 'pi_charlie', username: 'charlie', display_name: 'Charlie', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const listing = { id: 'item_camera', owner_user_id: 'usr_alice', title: 'Sony FX3', price_per_day: 10, deposit_amount: 5, status: 'active' };
  const contact = { listing_id: 'item_camera', contact_name: 'Alice Private', contact_phone: '09121112233', whatsapp: '09121112233', preferred_contact_method: 'phone' };
  const rental = { id: 'rnt_101', listing_id: 'item_camera', renter_user_id: 'usr_bob', status: 'confirmed', payment_status: 'completed' };

  const { env, kvStore } = createContactMockEnv({
    users: [alice, bob, charlie],
    listings: [listing],
    listing_contacts: [contact],
    rentals: [rental]
  });

  const token = 'token_charlie';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: charlie.pi_uid, username: charlie.username, role: 'user' }));

  const res = await worker.fetch(new Request('https://rentora.example/api/rentals/rnt_101/contact', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  }), env);

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error, 'Access denied to rental contact details');
});

// 3. Unpaid Reservation -> 403
test('Contact Security 3: Unpaid reservation (pending_payment / unpaid) is rejected with 403', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const bob = { id: 'usr_bob', pi_uid: 'pi_bob', username: 'bob', display_name: 'Bob', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const listing = { id: 'item_camera', owner_user_id: 'usr_alice', title: 'Sony FX3', price_per_day: 10, deposit_amount: 5, status: 'active' };
  const contact = { listing_id: 'item_camera', contact_name: 'Alice Private', contact_phone: '09121112233', whatsapp: '09121112233', preferred_contact_method: 'phone' };
  const rental = { id: 'rnt_102', listing_id: 'item_camera', renter_user_id: 'usr_bob', status: 'pending_payment', payment_status: 'unpaid' };

  const { env, kvStore } = createContactMockEnv({
    users: [alice, bob],
    listings: [listing],
    listing_contacts: [contact],
    rentals: [rental]
  });

  const token = 'token_bob';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: bob.pi_uid, username: bob.username, role: 'user' }));

  const res = await worker.fetch(new Request('https://rentora.example/api/rentals/rnt_102/contact', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  }), env);

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error, 'Contact information is locked until rental payment is confirmed');
});

// 4. Pending / Incomplete Payment -> 403
test('Contact Security 4: Pending / approving payment is rejected with 403', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const bob = { id: 'usr_bob', pi_uid: 'pi_bob', username: 'bob', display_name: 'Bob', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const listing = { id: 'item_drill', owner_user_id: 'usr_alice', title: 'Drill', price_per_day: 2, deposit_amount: 1, status: 'active' };
  const contact = { listing_id: 'item_drill', contact_name: 'Alice Phone', contact_phone: '09129998877' };
  const rental = { id: 'rnt_103', listing_id: 'item_drill', renter_user_id: 'usr_bob', status: 'pending_payment', payment_status: 'pending' };

  const { env, kvStore } = createContactMockEnv({
    users: [alice, bob],
    listings: [listing],
    listing_contacts: [contact],
    rentals: [rental]
  });

  const token = 'token_bob';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: bob.pi_uid, username: bob.username, role: 'user' }));

  const res = await worker.fetch(new Request('https://rentora.example/api/rentals/rnt_103/contact', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  }), env);

  assert.equal(res.status, 403);
});

// 5. Cancelled Reservation -> 403
test('Contact Security 5: Cancelled reservation is rejected with 403', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const bob = { id: 'usr_bob', pi_uid: 'pi_bob', username: 'bob', display_name: 'Bob', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const listing = { id: 'item_drill', owner_user_id: 'usr_alice', title: 'Drill', price_per_day: 2, deposit_amount: 1, status: 'active' };
  const contact = { listing_id: 'item_drill', contact_name: 'Alice Phone', contact_phone: '09129998877' };
  const rental = { id: 'rnt_104', listing_id: 'item_drill', renter_user_id: 'usr_bob', status: 'cancelled', payment_status: 'completed' };

  const { env, kvStore } = createContactMockEnv({
    users: [alice, bob],
    listings: [listing],
    listing_contacts: [contact],
    rentals: [rental]
  });

  const token = 'token_bob';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: bob.pi_uid, username: bob.username, role: 'user' }));

  const res = await worker.fetch(new Request('https://rentora.example/api/rentals/rnt_104/contact', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  }), env);

  assert.equal(res.status, 403);
});

// 6. Verified Paid Reservation -> 200 with Contact Data
test('Contact Security 6: Verified paid reservation returns 200 with private contact data', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice Owner', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const bob = { id: 'usr_bob', pi_uid: 'pi_bob', username: 'bob', display_name: 'Bob Renter', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const listing = { id: 'item_tent', owner_user_id: 'usr_alice', title: 'Camping Tent 4P', price_per_day: 3, deposit_amount: 5, status: 'active' };
  const contact = {
    listing_id: 'item_tent',
    contact_name: 'Reza Handover Manager',
    contact_phone: '09123456789',
    whatsapp: '09123456789',
    preferred_contact_method: 'whatsapp',
    contact_hours: '9 to 21',
    coordination_notes: 'Please call 2 hours prior to arrival',
    updated_at: '2026-01-01T00:00:00Z'
  };
  const rental = { id: 'rnt_200', listing_id: 'item_tent', renter_user_id: 'usr_bob', status: 'confirmed', payment_status: 'completed' };

  const { env, kvStore } = createContactMockEnv({
    users: [alice, bob],
    listings: [listing],
    listing_contacts: [contact],
    rentals: [rental]
  });

  const token = 'token_bob';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: bob.pi_uid, username: bob.username, role: 'user' }));

  const res = await worker.fetch(new Request('https://rentora.example/api/rentals/rnt_200/contact', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  }), env);

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.rentalId, 'rnt_200');
  assert.equal(data.contact.contactName, 'Reza Handover Manager');
  assert.equal(data.contact.contactPhone, '09123456789');
  assert.equal(data.contact.whatsapp, '09123456789');
  assert.equal(data.contact.preferredContactMethod, 'whatsapp');
  assert.equal(data.contact.contactHours, '9 to 21');
  assert.equal(data.contact.coordinationNotes, 'Please call 2 hours prior to arrival');
});

// 7. Listing ID Alone cannot fetch rental contact without valid rental -> denied
test('Contact Security 7: Querying nonexistent rental or random ID returns 404', async () => {
  const bob = { id: 'usr_bob', pi_uid: 'pi_bob', username: 'bob', display_name: 'Bob', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const { env, kvStore } = createContactMockEnv({ users: [bob] });

  const token = 'token_bob';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: bob.pi_uid, username: bob.username, role: 'user' }));

  const res = await worker.fetch(new Request('https://rentora.example/api/rentals/fake_rental_id/contact', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  }), env);

  assert.equal(res.status, 404);
});

// 8. Contact data in /api/sync/all is strictly ABSENT
test('Contact Security 8: Private contact info is stripped and absent in /api/sync/all', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const listing = {
    id: 'item_drone',
    owner_user_id: 'usr_alice',
    title: 'DJI Mini 4 Pro',
    price_per_day: 15,
    deposit_amount: 20,
    status: 'active',
    metadata: JSON.stringify({
      title: 'DJI Mini 4 Pro',
      phoneContact: '09120000000',
      contactInfo: { contactPhone: '09120000000' }
    })
  };

  const { env } = createContactMockEnv({
    users: [alice],
    listings: [listing]
  });

  const res = await gateway.fetch(new Request('https://rentora.example/api/sync/all', { method: 'GET' }), env);
  assert.equal(res.status, 200);
  const data = await res.json();
  const drone = data.items.find(i => i.id === 'item_drone');
  assert.ok(drone);
  assert.equal(drone.phoneContact, undefined);
  assert.equal(drone.contactInfo, undefined);
  assert.equal(drone.ownerPhone, undefined);
  assert.equal(drone.contactPhone, undefined);
  assert.equal(drone.whatsapp, undefined);
});

// 9. Contact response header has Cache-Control: private, no-store
test('Contact Security 9: Contact endpoint response includes Cache-Control: private, no-store', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice Owner', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const bob = { id: 'usr_bob', pi_uid: 'pi_bob', username: 'bob', display_name: 'Bob Renter', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const listing = { id: 'item_kayak', owner_user_id: 'usr_alice', title: 'Kayak', price_per_day: 8, deposit_amount: 10, status: 'active' };
  const contact = { listing_id: 'item_kayak', contact_phone: '09127776655' };
  const rental = { id: 'rnt_300', listing_id: 'item_kayak', renter_user_id: 'usr_bob', status: 'confirmed', payment_status: 'completed' };

  const { env, kvStore } = createContactMockEnv({
    users: [alice, bob],
    listings: [listing],
    listing_contacts: [contact],
    rentals: [rental]
  });

  const token = 'token_bob';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: bob.pi_uid, username: bob.username, role: 'user' }));

  const res = await worker.fetch(new Request('https://rentora.example/api/rentals/rnt_300/contact', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  }), env);

  assert.equal(res.status, 200);
  const cacheHeader = res.headers.get('Cache-Control');
  assert.ok(cacheHeader.includes('private'));
  assert.ok(cacheHeader.includes('no-store'));
});

// 10. Owner can only update their own listing contact
test('Contact Security 10: Non-owner cannot update listing or its contact info', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const bob = { id: 'usr_bob', pi_uid: 'pi_bob', username: 'bob', display_name: 'Bob', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const listing = { id: 'item_owned_by_alice', owner_user_id: 'usr_alice', title: 'Generator', price_per_day: 20, deposit_amount: 50, status: 'active' };

  const { env, kvStore } = createContactMockEnv({
    users: [alice, bob],
    listings: [listing]
  });

  const token = 'token_bob';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: bob.pi_uid, username: bob.username, role: 'user' }));

  const res = await worker.fetch(new Request('https://rentora.example/api/sync/item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      id: 'item_owned_by_alice',
      title: 'Hacked Title',
      contactInfo: { contactPhone: '09999999999' }
    })
  }), env);

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error, 'Listing ownership denied');
});

// 11. Two listings of the same owner can have different contact info
test('Contact Security 11: Two listings of the same owner can store distinct contact info', async () => {
  const alice = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', display_name: 'Alice', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };
  const bob = { id: 'usr_bob', pi_uid: 'pi_bob', username: 'bob', display_name: 'Bob', role: 'user', status: 'active', created_at: '2026-01-01T00:00:00Z' };

  const listing1 = { id: 'item_1', owner_user_id: 'usr_alice', title: 'Listing 1', price_per_day: 5, deposit_amount: 0, status: 'active' };
  const listing2 = { id: 'item_2', owner_user_id: 'usr_alice', title: 'Listing 2', price_per_day: 10, deposit_amount: 0, status: 'active' };

  const contact1 = { listing_id: 'item_1', contact_name: 'Branch North', contact_phone: '09121111111', preferred_contact_method: 'phone' };
  const contact2 = { listing_id: 'item_2', contact_name: 'Branch South', contact_phone: '09122222222', preferred_contact_method: 'whatsapp' };

  const rental1 = { id: 'rnt_item1', listing_id: 'item_1', renter_user_id: 'usr_bob', status: 'confirmed', payment_status: 'completed' };
  const rental2 = { id: 'rnt_item2', listing_id: 'item_2', renter_user_id: 'usr_bob', status: 'confirmed', payment_status: 'completed' };

  const { env, kvStore } = createContactMockEnv({
    users: [alice, bob],
    listings: [listing1, listing2],
    listing_contacts: [contact1, contact2],
    rentals: [rental1, rental2]
  });

  const token = 'token_bob';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: bob.pi_uid, username: bob.username, role: 'user' }));

  const res1 = await worker.fetch(new Request('https://rentora.example/api/rentals/rnt_item1/contact', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  }), env);
  const data1 = await res1.json();
  assert.equal(data1.contact.contactName, 'Branch North');
  assert.equal(data1.contact.contactPhone, '09121111111');
  assert.equal(data1.contact.preferredContactMethod, 'phone');

  const res2 = await worker.fetch(new Request('https://rentora.example/api/rentals/rnt_item2/contact', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  }), env);
  const data2 = await res2.json();
  assert.equal(data2.contact.contactName, 'Branch South');
  assert.equal(data2.contact.contactPhone, '09122222222');
  assert.equal(data2.contact.preferredContactMethod, 'whatsapp');
});
