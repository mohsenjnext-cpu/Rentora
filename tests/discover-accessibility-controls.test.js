import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/pages/DiscoverPage.jsx', import.meta.url), 'utf8');

test('Discover search and filter controls expose accessible names', () => {
  assert.match(source, /aria-label=\{t\('discoverSearchPlaceholder'\)\}/);
  assert.match(source, /aria-label=\{t\('discoverFilterBtn'\)\}/);
  assert.match(source, /aria-label=\{l\('پاک کردن جستجو'/);
  assert.match(source, /aria-label=\{t\('discoverFilterMaxPrice'\)\}/);
  assert.match(source, /aria-label=\{t\('discoverFilterLocation'\)\}/);
});

test('Discover sort control has an associated label', () => {
  assert.match(source, /htmlFor="discover-sort"/);
  assert.match(source, /id="discover-sort"/);
});
