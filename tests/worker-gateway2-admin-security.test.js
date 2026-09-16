import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const entrypoint = fs.readFileSync(new URL('../worker-gateway2.js', import.meta.url), 'utf8');

test('gateway2 admin authorization is configuration-only', () => {
  assert.match(entrypoint, /function adminAllowed\(value, env\)/);
  const adminAllowedSource = entrypoint.match(/function adminAllowed\(value, env\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(adminAllowedSource, /ADMIN_PI_UIDS/);
  assert.doesNotMatch(adminAllowedSource, /avina60|mohsenjnext|admin_user/);
});

test('gateway2 contains no legacy hardcoded admin identity guard', () => {
  assert.doesNotMatch(entrypoint, /function legacyAdminIdentity\(value\)/);
  assert.doesNotMatch(entrypoint, /guardLegacyAdminIdentity/);
  assert.doesNotMatch(entrypoint, /Legacy hardcoded admin identity is disabled/);
  assert.doesNotMatch(entrypoint, /avina60|mohsenjnext|admin_user/);
});

test('gateway2 binds completed Pi payment to the reported blockchain transaction ID', () => {
  assert.match(entrypoint, /payment\?\.transaction\?\.txid/);
  assert.match(entrypoint, /Pi transaction ID mismatch/);
  assert.match(entrypoint, /Pi transaction ID is missing/);
  assert.match(entrypoint, /validateTransactionTxid\(completion, body\.txid, true\)/);
});
