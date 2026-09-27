import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('admin identity configuration keeps UID and username allowlists explicit', () => {
  const wrangler = fs.readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const gateway = fs.readFileSync(new URL('../worker-gateway2.js', import.meta.url), 'utf8');
  const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');

  assert.match(wrangler, /^ADMIN_PI_USERNAMES\s*=\s*"[^"]*"/m);
  assert.match(wrangler, /^ADMIN_PI_UIDS\s*=\s*""/m);

  assert.match(gateway, /env\?\.ADMIN_PI_USERNAMES/);
  assert.match(gateway, /adminAllowed\(row\.pi_uid, row\.username, env\)/);

  assert.match(worker, /function adminUsernames\(env\)/);
  assert.match(worker, /isAdmin\(auth\.user\.pi_uid, env, auth\.user\.username\)/);
});
