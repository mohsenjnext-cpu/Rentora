import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const gateway = fs.readFileSync(new URL('../worker-gateway2.js', import.meta.url), 'utf8');

test('server sessions are short-lived and stored only as hashed KV keys', () => {
  assert.ok(worker.includes('const SESSION_TTL = 60 * 60 * 8;'));
  assert.ok(worker.includes("const token = randomToken('sess');"));
  assert.ok(worker.includes('const hash = await sha256(token);'));
  assert.ok(worker.includes('env.RENTORA_KV.put(`session:${hash}`'));
  assert.ok(worker.includes('expirationTtl: SESSION_TTL'));
  assert.ok(!worker.includes('session:${token}'));
});

test('logout revokes the exact server session before returning success', () => {
  const logoutStart = worker.indexOf("path === '/api/auth/logout'");
  assert.ok(logoutStart >= 0, 'logout route should exist');
  const logoutEnd = worker.indexOf("path === '/api/payments/intent'", logoutStart);
  assert.ok(logoutEnd > logoutStart, 'logout route should end before payment intent route');
  const logout = worker.slice(logoutStart, logoutEnd);
  assert.ok(logout.includes('const hash = await sha256(token);'));
  assert.ok(logout.includes('await env.RENTORA_KV.delete(`session:${hash}`);'));
  assert.ok(logout.includes('return jsonResponse({ success: true }, 200, env, origin);'));
});

test('authenticated requests can only resolve sessions through the hashed KV record', () => {
  assert.ok(worker.includes('async function getSession(request, env)'));
  assert.ok(worker.includes('const hash = await sha256(token);'));
  assert.ok(worker.includes('const raw = await env.RENTORA_KV.get(`session:${hash}`);'));
  assert.ok(worker.includes('if (!raw) return null;'));
  assert.ok(worker.includes('async function requireUser(request, env)'));
  assert.ok(worker.includes("status: 401"));
});

test('gateway forwards the session cookie into the legacy worker as an Authorization bearer token', () => {
  assert.ok(gateway.includes('const cookieToken = parseCookies(request).rentora_session'));
  assert.ok(gateway.includes("headers.set('Authorization', `Bearer ${cookieToken}`);"));
  assert.ok(gateway.includes("path === '/api/auth/pi-login'"));
  assert.ok(gateway.includes("Max-Age=28800; HttpOnly; Secure; SameSite=None"));
  assert.ok(gateway.includes('delete cleanData.sessionToken;'));
});
