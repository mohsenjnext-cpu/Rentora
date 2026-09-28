import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('home page keeps the final visual sections explicit', () => {
  const source = fs.readFileSync('src/pages/HomePage.jsx', 'utf8');
  for (const marker of ['home-page', 'home-hero', 'home-quick-discovery', 'home-trust', 'home-stats', 'home-featured']) {
    assert.ok(source.includes(marker), `missing Home UI marker: ${marker}`);
  }
  assert.ok(source.includes('refreshApp'));
  assert.ok(source.includes('ItemCard'));
});
