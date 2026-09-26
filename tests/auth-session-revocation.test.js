import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const gateway = fs.readFileSync(new URL('../worker-gateway2.js', import.meta.url), 'utf8');

test('server sessions are short-lived and stored only as hashed KV keys', () => {
  assert.match(worker, /const SESSION_TTL = 60 \\* 60 \\* 8;/);
  assert.match(worker, /const token = randomToken\\('sess'\\);/);
  assert.match(worker, /const hash = await sha256\\(token\\);/);
  assert.match(worker, /env\\.RENTORA_KV\\.put\\(\\`session:\\$\\{hash\\}\\`/);
  assert.match(worker, /expirationTtl: SESSION_TTL/);
  assert.doesNotMatch(worker, /session:\\$\\{token\\}/);
});

test('logout revokes the exact server session before returning success', () => {
  const logoutStart = worker.indexOf("path === '/api/auth/logout'");
  assert.ok(logoutStart >= 0, 'logout route should exist');
  const logoutEnd = worker.indexOf("path === '/api/payments/intent'", logoutStart);
  assert.ok(logoutEnd > logoutStart, 'logout route should end before payment intent route');
  const logout = worker.slice(logoutStart, logoutEnd);
  assert.match(logout, /const hash = await sha256\\(token\\);/);
  assert.match(logout, /await env\\.RENTORA_KV\\.delete\\(\\`session:\\$\\{hash\\}\\`\\);/);
  assert.match(logout, /return jsonResponse\\(\\{ success: true \\}/);
});

test('authenticated requests can only resolve sessions through the hashed KV record', () => {
  assert.match(worker, /async function getSession\\(request, env\\)/);
  assert.match(worker, /const hash = await sha256\\(token\\);/);
  assert.match(worker, /const raw = await env\\.RENTORA_KV\\.get\\(\\`session:\\$\\{hash\\}\\`\\);/);
  assert.match(worker, /if \\(!raw\\) return null;/);
  assert.match(worker, /async function requireUser\\(request, env\\)/);
  assert.match(worker, /if \\(!session\\?\\.uid\\) throw Object\\.assign\\(new Error\\('Authentication required'\\), \\{ status: 401 \\}\\);/);
});

test('gateway forwards the session cookie into the legacy worker as an Authorization bearer token', () => {
  assert.match(gateway, /const cookieToken = parseCookies\\(request\\)\\.rentora_session/);
  assert.match(gateway, /headers\\.set\\('Authorization', \\`Bearer \\$\\{cookieToken\\}\\`\\);/);
  assert.match(gateway, /path === '\\/api\\/auth\\/pi-login'/);
  assert.match(gateway, /headers\\.set\\('Set-Cookie', \\`rentora_session=\\$\\{encodeURIComponent\\(data\\.sessionToken\\)\\}; Path=\\/; Max-Age=28800; HttpOnly; Secure; SameSite=None\\`\\);/);
  assert.doesNotMatch(gateway, /headers\\.set\\('Set-Cookie'.*sessionToken/s);
});
