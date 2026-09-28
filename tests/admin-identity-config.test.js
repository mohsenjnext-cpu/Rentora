import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('admin identity configuration requires explicit Pi UIDs and never usernames', () => {
  const wrangler = fs.readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const gateway = fs.readFileSync(new URL('../worker-gateway2.js', import.meta.url), 'utf8');
  const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');

  // ADMIN_PI_UIDS is intentionally not defined in wrangler.toml.
  // The real allowlist is provisioned per environment in Cloudflare so deploys cannot overwrite it.
  assert.doesNotMatch(wrangler, /^ADMIN_PI_UIDS\s*=/m);
  assert.doesNotMatch(wrangler, /^ADMIN_PI_USERNAMES\s*=/m);
  assert.match(gateway, /function adminAllowed\(value, env\)/);
  assert.doesNotMatch(gateway, /ADMIN_PI_USERNAMES/);
  assert.match(worker, /function isAdmin\(uid, env\)/);
  assert.doesNotMatch(worker, /adminUsernames|ADMIN_PI_USERNAMES/);
});
