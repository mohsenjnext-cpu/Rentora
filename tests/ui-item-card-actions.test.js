import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const file = fs.readFileSync(new URL('../src/components/ItemCard.jsx', import.meta.url), 'utf8');

test('ItemCard interactive actions use 44px minimum touch targets', () => {
  assert.match(file, /w-11 h-11 min-w-11/);
  assert.match(file, /min-h-11 bg-\[#26215C\]/);
  assert.match(file, /min-h-11 px-2\.5 py-1\.5 rounded-xl/);
  assert.match(file, /btn-primary min-h-11/);
});

test('ItemCard favorite actions remain explicit buttons', () => {
  const buttons = (file.match(/<button/g) || []).length;
  assert.ok(buttons >= 4);
  assert.match(file, /aria-label=\{t\('btnFavorite'\)\}/);
});
