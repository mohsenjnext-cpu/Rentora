import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../db/migrations/0004_listing_status_guards.sql', import.meta.url), 'utf8');

test('listing status writes are authenticated and ownership-bound at the Worker', () => {
  assert.match(worker, /path === '\/api\/sync\/item'\) \{ const \{ user \} = await requireUser\(request, env\)/);
  assert.match(worker, /existing\.owner_user_id !== user\.id && !isAdmin\(user\.pi_uid, env\)/);
});

test('listing status is constrained to the supported lifecycle values in D1', () => {
  assert.match(migration, /OLD\.status = 'active' AND NEW\.status IN \('paused', 'deleted'\)/);
  assert.match(migration, /OLD\.status = 'paused' AND NEW\.status IN \('active', 'deleted'\)/);
  assert.match(migration, /RAISE\(ABORT, 'invalid listing status transition'\)/);
});

test('listing lifecycle cannot resurrect a deleted listing', () => {
  assert.doesNotMatch(migration, /OLD\.status = 'deleted'.*NEW\.status/);
});
