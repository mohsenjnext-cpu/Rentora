import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import gateway from '../worker-gateway2.js';

const legacyWorker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');

function createEnv(overrides = {}) {
  return {
    RENTORA_DB: { prepare() { return { bind() { return this; }, async first() { return null; }, async all() { return { results: [] }; }, async run() { return { meta: { changes: 0 } }; } }; } },
    RENTORA_KV: { async get() { return null; }, async put() {}, async delete() {} },
    PI_API_KEY: 'test_key',
    PI_API_URL: 'https://api.minepi.com/v2',
    ADMIN_PI_UIDS: 'avina60',
    CORS_ORIGIN: '',
    ...overrides
  };
}

async function preflight(origin, env) {
  return gateway.fetch(new Request('https://rentora.workers.dev/api/payments/approve', {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' }
  }), env, {});
}

test('unconfigured CORS_ORIGIN still allows the Pi ecosystem origins', async () => {
  const res = await preflight('https://sandbox.minepi.com', createEnv());
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://sandbox.minepi.com');
});

test('unconfigured CORS_ORIGIN rejects arbitrary third-party origins', async () => {
  const res = await preflight('https://evil.example', createEnv());
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});

test('configured CORS_ORIGIN is an exclusive allowlist', async () => {
  const env = createEnv({ CORS_ORIGIN: 'https://rentora.app' });
  const allowedRes = await preflight('https://rentora.app', env);
  assert.equal(allowedRes.headers.get('Access-Control-Allow-Origin'), 'https://rentora.app');

  const deniedRes = await preflight('https://sandbox.minepi.com', env);
  assert.equal(deniedRes.status, 403);
});

test('admin authorization relies on configured Pi UIDs only', () => {
  assert.doesNotMatch(legacyWorker, /id === 'avina60'|id === 'mohsenjnext'|id === 'admin_user'/);
  assert.doesNotMatch(legacyWorker, /isAdmin\((?:user|row)\.username, env\)/);
});

test('login never derives KYC status from the request body', () => {
  assert.doesNotMatch(legacyWorker, /body\?\.user\?\.kyc/);
  assert.doesNotMatch(legacyWorker, /body\?\.user\?\.is_kyc/);
  assert.doesNotMatch(legacyWorker, /body\?\.kycStatus/);
  assert.match(legacyWorker, /piUser\?\.kyc_status === true/);
});
