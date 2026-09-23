import test from 'node:test';
import assert from 'node:assert/strict';
import gateway from '../worker-gateway2.js';
import worker from '../_worker.js';

function createMockDb() {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('FROM users WHERE pi_uid')) {
                return { id: 'usr_1', pi_uid: 'pi_1', username: 'testuser', display_name: 'Test', role: 'user', status: 'active', metadata: '{}', created_at: '2026-01-01', updated_at: '2026-01-01' };
              }
              return null;
            },
            async all() { return { results: [] }; },
            async run() { return { meta: { changes: 0 } }; }
          };
        },
        async first() { return null; },
        async all() { return { results: [] }; }
      };
    },
    async batch() { return []; }
  };
}

function createMockKv() {
  const store = new Map();
  return {
    async get(key, type) {
      const val = store.get(key);
      if (!val) return null;
      if (type === 'json') return JSON.parse(val);
      return val;
    },
    async put(key, value) { store.set(key, typeof value === 'string' ? value : JSON.stringify(value)); },
    async delete(key) { store.delete(key); },
    async getWithMetadata(key) {
      const val = store.get(key);
      if (!val) return { value: null, metadata: null };
      return { value: val, metadata: null };
    }
  };
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function setupSession(kv, uid = 'pi_1') {
  const token = `sess_${crypto.randomUUID()}`;
  const hash = await sha256(token);
  await kv.put(`session:${hash}`, JSON.stringify({ uid, username: 'testuser', role: 'user' }));
  return token;
}

function baseEnv(corsOrigin) {
  return {
    RENTORA_DB: createMockDb(),
    RENTORA_KV: createMockKv(),
    PI_API_KEY: 'test_key',
    PI_API_URL: 'https://api.minepi.com/v2',
    ADMIN_PI_UIDS: '',
    CORS_ORIGIN: corsOrigin
  };
}

// 1. allowed HTTPS origin
test('CORS 1: allowed HTTPS origin receives exact ACAO', async () => {
  const env = baseEnv('https://allowed.com');
  const req = new Request('https://rentora.workers.dev/api/health', {
    method: 'GET',
    headers: { 'Origin': 'https://allowed.com' }
  });
  const res = await gateway.fetch(req, env, {});
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://allowed.com');
  assert.equal(res.headers.get('Vary'), 'Origin');
});

// 2. disallowed origin
test('CORS 2: disallowed origin does NOT receive CORS permission', async () => {
  const env = baseEnv('https://allowed.com');
  const req = new Request('https://rentora.workers.dev/api/health', {
    method: 'GET',
    headers: { 'Origin': 'https://evil.com' }
  });
  const res = await gateway.fetch(req, env, {});
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});

// 3. empty CORS configuration -> fail-closed
test('CORS 3: empty CORS_ORIGIN is fail-closed (no allow-all)', async () => {
  const env = baseEnv('');
  const req = new Request('https://rentora.workers.dev/api/health', {
    method: 'GET',
    headers: { 'Origin': 'https://any.com' }
  });
  const res = await gateway.fetch(req, env, {});
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});

// 4. wildcard configuration -> fail-closed
test('CORS 4: wildcard CORS_ORIGIN=* is rejected as invalid', async () => {
  const env = baseEnv('*');
  const req = new Request('https://rentora.workers.dev/api/health', {
    method: 'GET',
    headers: { 'Origin': 'https://any.com' }
  });
  const res = await gateway.fetch(req, env, {});
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});

// 5. multiple allowed origins validated separately
test('CORS 5: multiple allowed origins validated separately', async () => {
  const env = baseEnv('https://a.com,https://b.com');
  const reqA = new Request('https://rentora.workers.dev/api/health', {
    method: 'GET',
    headers: { 'Origin': 'https://a.com' }
  });
  const resA = await gateway.fetch(reqA, env, {});
  assert.equal(resA.headers.get('Access-Control-Allow-Origin'), 'https://a.com');

  const reqB = new Request('https://rentora.workers.dev/api/health', {
    method: 'GET',
    headers: { 'Origin': 'https://b.com' }
  });
  const resB = await gateway.fetch(reqB, env, {});
  assert.equal(resB.headers.get('Access-Control-Allow-Origin'), 'https://b.com');

  const reqC = new Request('https://rentora.workers.dev/api/health', {
    method: 'GET',
    headers: { 'Origin': 'https://c.com' }
  });
  const resC = await gateway.fetch(reqC, env, {});
  assert.equal(resC.headers.get('Access-Control-Allow-Origin'), null);
});

// 6. OPTIONS preflight for allowed origin
test('CORS 6: OPTIONS preflight for allowed origin returns 204 with correct ACAO', async () => {
  const env = baseEnv('https://allowed.com');
  const req = new Request('https://rentora.workers.dev/api/payments/approve', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://allowed.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type, Authorization'
    }
  });
  const res = await gateway.fetch(req, env, {});
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://allowed.com');
  assert.ok(res.headers.get('Access-Control-Allow-Methods'));
});

// 6b. OPTIONS preflight for disallowed origin -> no ACAO
test('CORS 6b: OPTIONS preflight for disallowed origin does NOT receive ACAO', async () => {
  const env = baseEnv('https://allowed.com');
  const req = new Request('https://rentora.workers.dev/api/payments/approve', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://evil.com',
      'Access-Control-Request-Method': 'POST'
    }
  });
  const res = await gateway.fetch(req, env, {});
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});

// 7. credentialed request must not use wildcard
test('CORS 7: credentialed request never uses wildcard', async () => {
  const env = baseEnv('*');
  const req = new Request('https://rentora.workers.dev/api/health', {
    method: 'GET',
    headers: { 'Origin': 'https://allowed.com' }
  });
  const res = await gateway.fetch(req, env, {});
  const acao = res.headers.get('Access-Control-Allow-Origin');
  assert.notEqual(acao, '*');
  assert.equal(acao, null);
});

// 8. request without Origin header
test('CORS 8: request without Origin header is allowed without CORS header', async () => {
  const env = baseEnv('https://allowed.com');
  const req = new Request('https://rentora.workers.dev/api/health', {
    method: 'GET'
  });
  const res = await gateway.fetch(req, env, {});
  assert.ok(res.status === 200 || res.status === 503);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});

// 9. malicious prefix/suffix origin blocked
test('CORS 9: malicious prefix/suffix origin is blocked (exact match only)', async () => {
  const env = baseEnv('https://rentora.com');
  const maliciousOrigins = [
    'https://rentora.com.evil.com',
    'https://evil-rentora.com',
    'https://rentora.com.attacker.com',
    'https://sub.rentora.com',
    'https://rentora.com.'
  ];
  for (const malicious of maliciousOrigins) {
    const req = new Request('https://rentora.workers.dev/api/health', {
      method: 'GET',
      headers: { 'Origin': malicious }
    });
    const res = await gateway.fetch(req, env, {});
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), null, `should block ${malicious}`);
  }
});

// 10. prevent direct reflection of Origin
test('CORS 10: never directly reflect request Origin without allowlist check', async () => {
  const envEmpty = baseEnv('');
  const req = new Request('https://rentora.workers.dev/api/health', {
    method: 'GET',
    headers: { 'Origin': 'https://attacker.com' }
  });
  const res = await gateway.fetch(req, envEmpty, {});
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
  assert.notEqual(res.headers.get('Access-Control-Allow-Origin'), 'https://attacker.com');
});

// Additional: _worker.js direct tests for fail-closed
test('CORS 11: _worker.js empty config is fail-closed', async () => {
  const env = baseEnv('');
  const req = new Request('https://rentora.workers.dev/api/health', {
    method: 'GET',
    headers: { 'Origin': 'https://any.com' }
  });
  const res = await worker.fetch(req, env, {});
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});

test('CORS 12: _worker.js wildcard config is fail-closed', async () => {
  const env = baseEnv('*');
  const req = new Request('https://rentora.workers.dev/api/health', {
    method: 'GET',
    headers: { 'Origin': 'https://any.com' }
  });
  const res = await worker.fetch(req, env, {});
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});

test('CORS 13: _worker.js allowed origin returns exact ACAO', async () => {
  const env = baseEnv('https://allowed.com');
  const req = new Request('https://rentora.workers.dev/api/health', {
    method: 'GET',
    headers: { 'Origin': 'https://allowed.com' }
  });
  const res = await worker.fetch(req, env, {});
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://allowed.com');
});

test('CORS 14: _worker.js OPTIONS preflight allowed origin', async () => {
  const env = baseEnv('https://allowed.com');
  const req = new Request('https://rentora.workers.dev/api/health', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://allowed.com',
      'Access-Control-Request-Method': 'GET'
    }
  });
  const res = await worker.fetch(req, env, {});
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://allowed.com');
});
