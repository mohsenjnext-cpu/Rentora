import test from 'node:test';
import assert from 'node:assert/strict';
import gateway from '../worker-gateway.js';

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function createMockEnv(initialData = {}) {
  const kvStore = new Map();
  const kvMetadata = new Map();
  const user = { id: 'usr_alice', pi_uid: 'pi_alice', username: 'alice', status: 'active', role: 'user' };

  const mockDb = {
    prepare(query) {
      return {
        bind(...params) {
          return {
            async first() {
              if (query.includes('pi_uid')) return user;
              return null;
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
        }
      }
    },
    kvStore,
    user
  };
}

test('1. JPEG upload → PASS (201)', async () => {
  const { env, kvStore, user } = createMockEnv();
  const token = 'valid_token_jpeg';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/', mimeType: 'image/jpeg' })
  }), env);

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.match(json.url, /^\/api\/images\/img_/);
});

test('2. PNG upload → PASS (201)', async () => {
  const { env, kvStore, user } = createMockEnv();
  const token = 'valid_token_png';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', mimeType: 'image/png' })
  }), env);

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.match(json.url, /^\/api\/images\/img_/);
});

test('3. WebP upload → PASS (201)', async () => {
  const { env, kvStore, user } = createMockEnv();
  const token = 'valid_token_webp';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', mimeType: 'image/webp' })
  }), env);

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.match(json.url, /^\/api\/images\/img_/);
});

test('4. SVG upload (image/svg+xml) → REJECTED (400)', async () => {
  const { env, kvStore, user } = createMockEnv();
  const token = 'valid_token_svg';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const svgPayload = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=';
  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: svgPayload, mimeType: 'image/svg+xml' })
  }), env);

  assert.equal(res.status, 400);
  const json = await res.json();
  assert.match(json.error, /Invalid image format/);
});

test('5. Unauthenticated upload → 401', async () => {
  const { env } = createMockEnv();

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: 'data:image/jpeg;base64,...', mimeType: 'image/jpeg' })
  }), env);

  assert.equal(res.status, 401);
  const json = await res.json();
  assert.equal(json.error, 'Authentication required');
});

test('6. Oversized image (> 2MB) → 413', async () => {
  const { env, kvStore, user } = createMockEnv();
  const token = 'valid_token_large';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  // Create > 2MB dummy payload
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

test('7. Existing image retrieval → PASS (200)', async () => {
  const { env, kvStore, user } = createMockEnv();
  const token = 'valid_token_get';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/', mimeType: 'image/jpeg' })
  }), env);

  const json = await res.json();
  const imgRes = await gateway.fetch(new Request(`https://rentora.example${json.url}`, { method: 'GET' }), env);
  assert.equal(imgRes.status, 200);
  assert.equal(imgRes.headers.get('Content-Type'), 'image/jpeg');
  assert.match(imgRes.headers.get('Cache-Control'), /immutable/);
});
