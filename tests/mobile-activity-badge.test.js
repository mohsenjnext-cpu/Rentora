import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('mobile activity badge is scoped to the authenticated renter', () => {
  const source = fs.readFileSync(new URL('../src/components/BottomNav.jsx', import.meta.url), 'utf8');

  assert.match(source, /usePiAuth/);
  assert.match(source, /renterUsername/);
  assert.match(source, /renterUid/);
  assert.match(source, /belongsToCurrentUser/);
  assert.match(source, /belongsToCurrentUser && ACTIONABLE_RENTAL_STATUSES/);
});
