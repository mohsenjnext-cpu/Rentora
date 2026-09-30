import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const context = fs.readFileSync(new URL('../src/context/RentoraContext.jsx', import.meta.url), 'utf8');
const owner = fs.readFileSync(new URL('../src/pages/OwnerHubPage.jsx', import.meta.url), 'utf8');

test('owner dashboard refresh callback is stable and cannot retrigger its loading effect every render', () => {
  assert.match(context, /const refreshApp = useCallback\(async \(\) =>/);
  assert.match(context, /\}, \[currentUser, refreshConversations\]\);/);
  assert.match(owner, /refreshApp\?\.\(\)/);
  assert.match(owner, /\}, \[isAuthenticated, currentUser\?\.uid, refreshApp, l\]\);/);
});
