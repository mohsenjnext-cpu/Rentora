import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');

test('server auth session uses an HttpOnly host cookie for browser API requests', () => {
  assert.match(worker, /__Host-rentora_session=/);
  assert.match(worker, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(worker, /Max-Age=\$\{SESSION_TTL\}/);
  assert.match(worker, /request\\.headers\\.get\\('Cookie'\\)/);
  assert.match(worker, /decodeURIComponent\\(match\\[1\\]\\)/);
});

test('logout revokes the KV session and clears the browser session cookie', () => {
  assert.match(worker, /RENTORA_KV\\.delete\\(`session:\\$\\{hash\\}`\\)/);
  assert.match(worker, /__Host-rentora_session=; Max-Age=0; Path=\\/; HttpOnly; Secure; SameSite=Lax/);
});

test('login does not expose the server session token in the JSON response', () => {
  assert.doesNotMatch(worker, /authenticated: true, verifiedWithPiApi: true, user: userView\\(user, env\\), sessionToken,/);
});
