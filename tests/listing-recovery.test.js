import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/pages/ListItemPage.jsx', import.meta.url), 'utf8');

test('listing edit contact loading exposes a real retry path', () => {
  assert.match(source, /const \[contactLoadError, setContactLoadError\] = useState\(''\);/);
  assert.match(source, /fetchListingContact\(itemToEdit\.id\)/);
  assert.match(source, /if \(active\) setContactLoadError\(err\?\.message \|\| l\(/);
  assert.match(source, /setContactRetryNonce\(v => v \+ 1\)/);
  assert.match(source, /\[itemToEdit, currentUser, contactRetryNonce\]/);
  assert.match(source, /l\('تلاش مجدد', 'Try again'/);
});

test('listing image upload failure is surfaced instead of being silently swallowed', () => {
  assert.match(source, /setErrorMessage\(err\?\.message \|\| l\('بارگذاری تصویر ناموفق بود/);
  assert.doesNotMatch(source, /catch \(err\) \{\s*console\.warn\('\[Image Upload Note\]'/);
});
