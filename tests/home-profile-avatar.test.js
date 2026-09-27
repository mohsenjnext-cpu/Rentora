import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('HomePage uses the authenticated profile avatar in both hero layouts', () => {
  const source = fs.readFileSync(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8');
  assert.match(source, /currentUser\?\.avatar \? <img src=\{currentUser\.avatar\}/);
  assert.match(source, /className="w-7 h-7 rounded-lg overflow-hidden/);
  assert.match(source, /className="hidden lg:flex w-14 h-14 rounded-2xl overflow-hidden/);
});
