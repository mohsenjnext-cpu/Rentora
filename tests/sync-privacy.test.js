import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');

test('sync endpoint supports public active listings and user-aware sync', () => {
  assert.match(worker, /path === '\/api\/sync\/all'/);
  assert.match(worker, /await requireUser\(request, env\)/);
  assert.match(worker, /SELECT \* FROM users WHERE pi_uid ?= ?\?1 LIMIT 1/);
});

test('regular users only receive their own rentals and transactions', () => {
  assert.match(worker, /r\.renter_user_id=\?1 OR r\.owner_user_id=\?1/);
  assert.match(worker, /t\.user_id=\?1/);
});

test('regular users do not receive the complete user directory', () => {
  assert.match(worker, /SELECT \* FROM users ORDER BY created_at DESC/);
  assert.match(worker, /isAdminUser/);
});

test('reports are only queried for verified admins', () => {
  assert.match(worker, /role === 'admin'/);
  assert.match(worker, /ADMIN_PI_UIDS/);
  assert.match(worker, /reporter_username/);
});
