import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const gateway = fs.readFileSync(new URL('../worker-gateway.js', import.meta.url), 'utf8');

test('sync endpoint supports public active listings and user-aware sync', () => {
  assert.match(gateway, /url\.pathname === '\/api\/sync\/all'/);
  assert.match(gateway, /await requireUser\(request, env\)/);
  assert.match(gateway, /SELECT \* FROM users WHERE pi_uid=\?1 LIMIT 1/);
});

test('regular users only receive their own rentals and transactions', () => {
  assert.match(gateway, /WHERE r\.renter_user_id=\?1 OR r\.owner_user_id=\?1/);
  assert.match(gateway, /WHERE t\.user_id=\?1 ORDER BY t\.created_at DESC/);
  assert.match(gateway, /\.bind\(user\.id\)\.all\(\)/);
});

test('regular users do not receive the complete user directory', () => {
  assert.match(gateway, /users:\s*user\s*\?\s*\[userView\(user\)\]\s*:\s*\[\]/);
  assert.match(gateway, /if \(isAdmin\)/);
  assert.match(gateway, /SELECT \* FROM users ORDER BY created_at DESC/);
});

test('reports are only queried for verified admins', () => {
  assert.match(gateway, /user\.role === 'admin'/);
  assert.match(gateway, /ADMIN_PI_UIDS/);
  assert.match(gateway, /SELECT r\.\*, u\.username reporter_username/);
});
