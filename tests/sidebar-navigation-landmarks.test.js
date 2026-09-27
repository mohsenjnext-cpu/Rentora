import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('sidebar exposes named navigation landmarks for assistive technology', () => {
  const source = fs.readFileSync(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');

  assert.match(source, /<aside aria-label=\{l\('منوی اصلی','Main navigation'/);
  assert.match(source, /<nav aria-label=\{l\('ناوبری اصلی','Primary navigation'/);
});
