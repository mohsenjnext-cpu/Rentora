import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');

test('server auth session uses an HttpOnly host cookie for browser API requests', () => {
  assert.ok(worker.includes('__Host-rentora_session='));
  assert.ok(worker.includes('HttpOnly; Secure; SameSite=Lax; Partitioned'));
  assert.ok(worker.includes('Max-Age=\${SESSION_TTL}'));
  assert.ok(worker.includes("request.headers.get('Cookie')"));
  assert.ok(worker.includes('decodeURIComponent(cookieMatch[1])'));
});

test('logout revokes cookie-backed sessions and clears the browser session cookie', () => {
  assert.ok(worker.includes('await env.RENTORA_KV.delete(\`session:\${hash}\`);'));
  assert.ok(worker.includes("const cookie = request.headers.get('Cookie') || '';"));
  assert.ok(worker.includes('const cookieMatch = cookie.match'));
  assert.ok(worker.includes('__Host-rentora_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax; Partitioned'));
});

test('login response sets the browser session cookie', () => {
  assert.ok(worker.includes('const sessionToken = await createSession(env, user);'));
  assert.ok(worker.includes("response.headers.set('Set-Cookie', \`__Host-rentora_session=\${encodeURIComponent(sessionToken)}; Max-Age=\${SESSION_TTL}; Path=/; HttpOnly; Secure; SameSite=Lax; Partitioned\`);"));
});


test('gateway session cookie supports Pi App Studio External App cross-site requests', () => {
  const gateway = fs.readFileSync(new URL('../worker-gateway2.js', import.meta.url), 'utf8');
  assert.ok(gateway.includes('SameSite=None'));
  assert.ok(gateway.includes('__Host-rentora_session='));
  assert.ok(gateway.includes('HttpOnly; Secure; SameSite=None'));
});
