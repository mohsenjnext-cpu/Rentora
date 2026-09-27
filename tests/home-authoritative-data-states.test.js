import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('home handles authoritative listing loading and error states', () => {
  const source = fs.readFileSync(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8');
  assert.match(source, /const \[dataState, setDataState\]/);
  assert.match(source, /refreshApp\?\.\(\)/);
  assert.match(source, /dataState\.loading \|\| isRefreshing/);
  assert.match(source, /dataState\.error \?/);
  assert.match(source, /تلاش دوباره/);
  assert.match(source, /activeCategoryCount/);
  assert.doesNotMatch(source, /homeStatPioneers/);
  assert.doesNotMatch(source, /const \{ users = \[\], currentUser \}/);
});
