import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const entrypoint = fs.readFileSync(new URL('../worker-gateway2.js', import.meta.url), 'utf8');

test('gateway2 admin authorization is configuration-only', () => {
  assert.match(entrypoint, /ADMIN_PI_UIDS/);
  assert.doesNotMatch(entrypoint, /id === ['\"]avina60['\"]/);
  assert.doesNotMatch(entrypoint, /id === ['\"]mohsenjnext['\"]/);
  assert.doesNotMatch(entrypoint, /id === ['\"]admin_user['\"]/);
});
