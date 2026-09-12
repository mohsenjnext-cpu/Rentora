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

test('Image upload: Authenticated user uploads valid JPEG and receives URL', async () => {
  const { env, kvStore, user } = createMockEnv();
  const token = 'valid_token';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const base64Data = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/';
  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: base64Data, mimeType: 'image/jpeg' })
  }), env);

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.match(json.url, /^\/api\/images\/img_/);

  // Fetch the uploaded image
  const imgRes = await gateway.fetch(new Request(`https://rentora.example${json.url}`, { method: 'GET' }), env);
  assert.equal(imgRes.status, 200);
  assert.equal(imgRes.headers.get('Content-Type'), 'image/jpeg');
  assert.match(imgRes.headers.get('Cache-Control'), /immutable/);
});

test('Image upload: Invalid MIME type is rejected with 400', async () => {
  const { env, kvStore, user } = createMockEnv();
  const token = 'valid_token';
  kvStore.set(`session:${await sha256(token)}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }));

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: 'dangerous_executable_content', mimeType: 'application/x-msdownload' })
  }), env);

  assert.equal(res.status, 400);
  const json = await res.json();
  assert.match(json.error, /Invalid image format/);
});

test('Image upload: Unauthenticated request is rejected with 401', async () => {
  const { env } = createMockEnv();

  const res = await gateway.fetch(new Request('https://rentora.example/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: 'data:image/jpeg;base64,...', mimeType: 'image/jpeg' })
  }), env);

  assert.equal(res.status, 401);
});
