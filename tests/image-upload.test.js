import test from 'node:test';
import assert from 'node:assert/strict';
import gateway from '../worker-gateway.js';

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

class MockR2 {
  constructor() {
    this.objects = new Map();
  }

  async put(key, value, options = {}) {
    const httpMetadata = options.httpMetadata || {};
    const customMetadata = options.customMetadata || {};
    const httpEtag = `"etag-${crypto.randomUUID()}"`;

    let bodyBytes;
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
      bodyBytes = value;
    } else if (typeof value === 'string') {
      bodyBytes = Buffer.from(value);
    } else if (value instanceof ArrayBuffer) {
      bodyBytes = new Uint8Array(value);
    } else {
      bodyBytes = Buffer.from(String(value));
    }

    const obj = {
      key,
      size: bodyBytes.length,
      httpEtag,
      httpMetadata,
      customMetadata,
      bodyBytes
    };
    this.objects.set(key, obj);
    return obj;
  }

  async get(key) {
    const obj = this.objects.get(key);
    if (!obj) return null;
    return {
      key: obj.key,
      size: obj.size,
      httpEtag: obj.httpEtag,
      httpMetadata: obj.httpMetadata,
      customMetadata: obj.customMetadata,
      get body() {
        return new ReadableStream({
          start(controller) {
            controller.enqueue(obj.bodyBytes);
            controller.close();
          }
        });
      },
      async arrayBuffer() {
        return obj.bodyBytes.buffer;
      },
      async text() {
        return Buffer.from(obj.bodyBytes).toString('utf-8');
      }
    };
  }

  async head(key) {
    const obj = this.objects.get(key);
    if (!obj) return null;
    return {
      key: obj.key,
      size: obj.size,
      httpEtag: obj.httpEtag,
      httpMetadata: obj.httpMetadata,
      customMetadata: obj.customMetadata
    };
  }

  async delete(keys) {
    if (Array.isArray(keys)) {
      keys.forEach((k) => this.objects.delete(k));
    } else {
      this.objects.delete(keys);
    }
  }

  async list(options = {}) {
    const prefix = options.prefix || '';
    const objects = [];
    for (const [key, obj] of this.objects.entries()) {
      if (key.startsWith(prefix)) {
        objects.push({
          key: obj.key,
          size: obj.size,
          httpEtag: obj.httpEtag,
          httpMetadata: obj.httpMetadata,
          customMetadata: obj.customMetadata
        });
      }
    }
    return { objects, truncated: false };
  }
}

function createMockEnv(initialData = {}) {
  const kvStore = new Map();
  const kvMetadata = new Map();
  const r2Bucket = new MockR2();
  const users = initialData.users || [{
    id: 'usr_alice',
    pi_uid: 'pi_alice',
    username: 'alice',
    status: 'active',
    role: 'user',
    display_name: 'Alice',
    avatar_url: null,
    metadata: '{}',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }];
  const listings = initialData.listings || [];

  const mockDb = {
    prepare(query) {
      return {
        bind(...params) {
          return {
            async first() {
              if (query.includes('FROM users WHERE pi_uid = ?1') || query.includes('FROM users WHERE pi_uid=?1')) {
                const uid = params[0];
                const u = users.find((u) => u.pi_uid === uid);
                return u ? { ...u } : null;
              }
              if (query.includes('FROM users WHERE id = ?1') || query.includes('FROM users WHERE id=?1')) {
                const id = params[0];
                const u = users.find((u) => u.id === id);
                return u ? { ...u } : null;
              }
              if (query.includes('FROM listings WHERE id=?1') || query.includes('FROM listings WHERE id = ?1')) {
                const id = params[0];
                const l = listings.find((l) => l.id === id);
                return l ? { ...l } : null;
              }
              if (query.includes('FROM listings WHERE metadata LIKE')) {
                const pat = String(params[0] || '').replace(/%/g, '');
                const l = listings.find((l) => (l.metadata || '').includes(pat) && l.status !== 'deleted');
                return l ? { ...l } : null;
              }
              if (query.includes('FROM users WHERE (avatar_url LIKE')) {
                const pat = String(params[0] || '').replace(/%/g, '');
                const u = users.find((u) => (u.avatar_url || '').includes(pat) || (u.metadata || '').includes(pat));
                return u ? { ...u } : null;
              }
              return null;
            },
            async all() {
              if (query.includes('FROM listings')) {
                return { results: listings.filter((l) => l.status !== 'deleted') };
              }
              if (query.includes('FROM users')) {
                return { results: users };
              }
              return { results: [] };
            },
            async run() {
              if (query.includes('INSERT INTO listings')) {
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
              }
              if (query.includes('UPDATE listings')) {
                const id = params[params.length - 1];
                const listing = listings.find((l) => l.id === id);
                if (listing) {
                  listing.title = params[0];
                  listing.description = params[1];
                  listing.category = params[2];
                  listing.location = params[3];
                  listing.status = params[4];
                  listing.metadata = params[5];
                  listing.updated_at = params[6];
                }
              }
              if (query.includes('UPDATE users SET display_name')) {
                const id = params[params.length - 1];
                const user = users.find((u) => u.id === id);
                if (user) {
                  user.display_name = params[0];
                  user.avatar_url = params[1];
                  user.metadata = params[2];
                  user.updated_at = params[3];
                }
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
        async getWithMetadata(key) {
          return { value: kvStore.get(key) || null, metadata: kvMetadata.get(key) || null };
        },
        async put(key, val, options = {}) {
          kvStore.set(key, val);
          if (options.metadata) kvMetadata.set(key, options.metadata);
        },
        async delete(key) {
          kvStore.delete(key);
          kvMetadata.delete(key);
        }
      },
      RENTORA_MEDIA: r2Bucket
    },
    kvStore,
    kvMetadata,
    r2Bucket,
    users,
    listings,
    user: users[0]
  };
}

// Sample binary-valid data URLs
const JPEG_PAYLOAD = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/';
const PNG_PAYLOAD = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const WEBP_PAYLOAD = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
const SVG_PAYLOAD = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=';
const FAKE_BINARY_PAYLOAD = 'data:image/jpeg;base64,aGVsbG8gd29ybGQgbm90IGFuIGltYWdl'; // "hello world not an image"

test('1. JPEG → R2 upload succeeds (201)', async () => {
  const { env, kvStore, r2Bucket, user } = createMockEnv();
  const token = 'valid_token_jpeg';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: JPEG_PAYLOAD, mimeType: 'image/jpeg' })
  }), env);

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.match(json.url, /^\/api\/images\/img_/);

  const r2Key = `images/${json.id}`;
  const r2Object = await r2Bucket.get(r2Key);
  assert.ok(r2Object, 'Object must be written to R2');
  assert.equal(r2Object.httpMetadata?.contentType, 'image/jpeg');
  assert.equal(r2Object.customMetadata?.uploaderUid, user.pi_uid);
});

test('2. PNG → R2 upload succeeds (201)', async () => {
  const { env, kvStore, r2Bucket, user } = createMockEnv();
  const token = 'valid_token_png';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: PNG_PAYLOAD, mimeType: 'image/png' })
  }), env);

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.match(json.url, /^\/api\/images\/img_/);

  const r2Object = await r2Bucket.get(`images/${json.id}`);
  assert.ok(r2Object);
  assert.equal(r2Object.httpMetadata?.contentType, 'image/png');
});

test('3. WebP → R2 upload succeeds (201)', async () => {
  const { env, kvStore, r2Bucket, user } = createMockEnv();
  const token = 'valid_token_webp';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: WEBP_PAYLOAD, mimeType: 'image/webp' })
  }), env);

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.match(json.url, /^\/api\/images\/img_/);

  const r2Object = await r2Bucket.get(`images/${json.id}`);
  assert.ok(r2Object);
  assert.equal(r2Object.httpMetadata?.contentType, 'image/webp');
});

test('4. SVG → 400 (rejected)', async () => {
  const { env, kvStore, user } = createMockEnv();
  const token = 'valid_token_svg';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: SVG_PAYLOAD, mimeType: 'image/svg+xml' })
  }), env);

  assert.equal(res.status, 400);
  const json = await res.json();
  assert.match(json.error, /Invalid image format/);
});

test('5. unauthenticated upload → 401', async () => {
  const { env } = createMockEnv();

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: JPEG_PAYLOAD, mimeType: 'image/jpeg' })
  }), env);

  assert.equal(res.status, 401);
  const json = await res.json();
  assert.equal(json.error, 'Authentication required');
});

test('6. >2 MB → 413 (payload too large)', async () => {
  const { env, kvStore, user } = createMockEnv();
  const token = 'valid_token_large';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const largeData = 'data:image/jpeg;base64,' + 'A'.repeat(2.5 * 1024 * 1024);
  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: largeData, mimeType: 'image/jpeg' })
  }), env);

  assert.equal(res.status, 413);
  const json = await res.json();
  assert.match(json.error, /too large|exceeds/i);
});

test('7. MIME spoofing → 400 (PNG declared with JPEG payload)', async () => {
  const { env, kvStore, user } = createMockEnv();
  const token = 'valid_token_spoof';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  // Declare PNG but provide JPEG binary
  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: JPEG_PAYLOAD, mimeType: 'image/png' })
  }), env);

  assert.equal(res.status, 400);
  const json = await res.json();
  assert.match(json.error, /mismatch/i);
});

test('8. JPEG magic bytes → accepted', async () => {
  const { env, kvStore, user } = createMockEnv();
  const token = 'valid_token_mb_jpg';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: JPEG_PAYLOAD, mimeType: 'image/jpeg' })
  }), env);

  assert.equal(res.status, 201);
});

test('9. PNG magic bytes → accepted', async () => {
  const { env, kvStore, user } = createMockEnv();
  const token = 'valid_token_mb_png';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: PNG_PAYLOAD, mimeType: 'image/png' })
  }), env);

  assert.equal(res.status, 201);
});

test('10. WebP magic bytes → accepted', async () => {
  const { env, kvStore, user } = createMockEnv();
  const token = 'valid_token_mb_webp';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: WEBP_PAYLOAD, mimeType: 'image/webp' })
  }), env);

  assert.equal(res.status, 201);
});

test('11. invalid magic bytes → rejected (400)', async () => {
  const { env, kvStore, user } = createMockEnv();
  const token = 'valid_token_invalid_mb';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: FAKE_BINARY_PAYLOAD, mimeType: 'image/jpeg' })
  }), env);

  assert.equal(res.status, 400);
  const json = await res.json();
  assert.match(json.error, /magic bytes/i);
});

test('12. R2 image retrieval → 200', async () => {
  const { env, r2Bucket } = createMockEnv();
  const imgId = 'img_r2_test_123';
  const binary = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);

  await r2Bucket.put(`images/${imgId}`, binary, {
    httpMetadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { uploaderUid: 'pi_alice', createdAt: new Date().toISOString() }
  });

  const res = await gateway.fetch(new Request(`https://rentora.example/api/images/${imgId}`, { method: 'GET' }), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'image/jpeg');
  assert.match(res.headers.get('Cache-Control'), /immutable/);
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.ok(res.headers.get('ETag'), 'ETag header should be present');
});

test('13. missing R2 image + existing KV image → 200 (Dual-read KV fallback)', async () => {
  const { env, kvStore, kvMetadata } = createMockEnv();
  const imgId = 'img_legacy_kv_456';

  kvStore.set(`image:${imgId}`, JPEG_PAYLOAD);
  kvMetadata.set(`image:${imgId}`, { mimeType: 'image/jpeg', uploaderUid: 'pi_legacy' });

  const res = await gateway.fetch(new Request(`https://rentora.example/api/images/${imgId}`, { method: 'GET' }), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'image/jpeg');
  assert.match(res.headers.get('Cache-Control'), /immutable/);
});

test('14. missing R2 + missing KV → 404', async () => {
  const { env } = createMockEnv();
  const res = await gateway.fetch(new Request('https://rentora.example/api/images/img_non_existent_999', { method: 'GET' }), env);
  assert.equal(res.status, 404);
  const json = await res.json();
  assert.match(json.error, /not found/i);
});

test('15. KV fallback lazy migration does not break response', async () => {
  const { env, kvStore, kvMetadata, r2Bucket } = createMockEnv();
  const imgId = 'img_lazy_mig_789';

  kvStore.set(`image:${imgId}`, JPEG_PAYLOAD);
  kvMetadata.set(`image:${imgId}`, { mimeType: 'image/jpeg', uploaderUid: 'pi_alice' });

  const ctx = {
    promises: [],
    waitUntil(p) {
      this.promises.push(p);
    }
  };

  const res = await gateway.fetch(new Request(`https://rentora.example/api/images/${imgId}`, { method: 'GET' }), env, ctx);
  assert.equal(res.status, 200);

  // Await background migration promises
  await Promise.all(ctx.promises);

  // Check that R2 now has the object
  const migrated = await r2Bucket.get(`images/${imgId}`);
  assert.ok(migrated, 'Legacy image should have been lazy-migrated to R2');
  assert.equal(migrated.httpMetadata?.contentType, 'image/jpeg');
});

test('16. listing deletion removes associated R2 object', async () => {
  const { env, kvStore, r2Bucket, user } = createMockEnv();
  const token = 'valid_token_delete_item';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const imgId = 'img_listing_to_delete';
  await r2Bucket.put(`images/${imgId}`, new Uint8Array([0xFF, 0xD8, 0xFF]), { httpMetadata: { contentType: 'image/jpeg' } });

  const item = {
    id: 'item_del_test',
    title: 'Item to delete',
    images: [`/api/images/${imgId}`],
    pricePerDay: 5,
    deposit: 10,
    status: 'active'
  };

  // Create listing
  const postRes = await gateway.fetch(new Request('https://rentora.example/api/sync/item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(item)
  }), env);
  assert.equal(postRes.status, 201);
  assert.ok(await r2Bucket.get(`images/${imgId}`));

  // Mark deleted
  const ctx = { promises: [], waitUntil(p) { this.promises.push(p); } };
  const delRes = await gateway.fetch(new Request('https://rentora.example/api/sync/item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...item, status: 'deleted' })
  }), env, ctx);
  assert.equal(delRes.status, 200);

  await Promise.all(ctx.promises);
  assert.equal(await r2Bucket.get(`images/${imgId}`), null, 'Associated R2 image should be deleted when listing is deleted');
});

test('17. avatar replacement cleanup is safe', async () => {
  const { env, kvStore, r2Bucket, user } = createMockEnv();
  const token = 'valid_token_avatar_safe';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const oldImgId = 'img_old_avatar';
  const newImgId = 'img_new_avatar';
  await r2Bucket.put(`images/${oldImgId}`, new Uint8Array([0xFF, 0xD8, 0xFF]), { httpMetadata: { contentType: 'image/jpeg' } });
  await r2Bucket.put(`images/${newImgId}`, new Uint8Array([0xFF, 0xD8, 0xFF]), { httpMetadata: { contentType: 'image/jpeg' } });

  user.avatar_url = `/api/images/${oldImgId}`;

  const ctx = { promises: [], waitUntil(p) { this.promises.push(p); } };
  const res = await gateway.fetch(new Request('https://rentora.example/api/sync/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ avatar: `/api/images/${newImgId}` })
  }), env, ctx);

  assert.equal(res.status, 200);
  await Promise.all(ctx.promises);

  assert.equal(await r2Bucket.get(`images/${oldImgId}`), null, 'Old unreferenced avatar should be cleaned up');
  assert.ok(await r2Bucket.get(`images/${newImgId}`), 'New avatar should remain intact');
});

test('18. D1 image URLs remain unchanged (/api/images/img_<uuid>)', async () => {
  const { env, kvStore, user } = createMockEnv();
  const token = 'valid_token_d1_url';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: JPEG_PAYLOAD, mimeType: 'image/jpeg' })
  }), env);

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.match(json.url, /^\/api\/images\/img_[a-zA-Z0-9_-]+$/);
});

test('19. existing listing images continue working', async () => {
  const { env, kvStore, kvMetadata } = createMockEnv();
  const legacyImgId = 'img_existing_listing_photo';
  kvStore.set(`image:${legacyImgId}`, JPEG_PAYLOAD);
  kvMetadata.set(`image:${legacyImgId}`, { mimeType: 'image/jpeg' });

  const res = await gateway.fetch(new Request(`https://rentora.example/api/images/${legacyImgId}`, { method: 'GET' }), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'image/jpeg');
});

test('20. existing avatars continue working', async () => {
  const { env, kvStore, kvMetadata } = createMockEnv();
  const legacyAvatarId = 'img_existing_user_avatar';
  kvStore.set(`image:${legacyAvatarId}`, PNG_PAYLOAD);
  kvMetadata.set(`image:${legacyAvatarId}`, { mimeType: 'image/png' });

  const res = await gateway.fetch(new Request(`https://rentora.example/api/images/${legacyAvatarId}`, { method: 'GET' }), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'image/png');
});
