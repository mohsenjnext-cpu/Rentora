import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/pages/DiscoverPage.jsx', 'utf8');

test('discover exposes pressed state for category shortcuts and filter categories', () => {
  assert.match(source, /aria-pressed=\{active\}/);
  assert.match(source, /aria-pressed=\{isSel\}/);
});

test('discover filter dialog has accessible name and modal semantics', () => {
  assert.match(source, /id="discover-filter-dialog"/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby="discover-filter-title"/);
  assert.match(source, /id="discover-filter-title"/);
  assert.match(source, /aria-controls="discover-filter-dialog"/);
  assert.match(source, /aria-expanded=\{filterSheetOpen\}/);
});

test('discover filter controls have explicit labels', () => {
  assert.match(source, /htmlFor="discover-condition"/);
  assert.match(source, /id="discover-condition"/);
  assert.match(source, /htmlFor="discover-location"/);
  assert.match(source, /id="discover-location"/);
  assert.match(source, /aria-label=\{l\('بستن فیلترها', 'Close filters'/);
});
