import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Header uses the persisted profile avatar and a neutral icon fallback', () => {
  const source = fs.readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');

  assert.match(source, /currentUser\.avatar/);
  assert.match(source, /<User className="w-4 h-4 text-slate-500 stroke-\[1\.8\] mx-auto mt-2" \/>/);
  assert.doesNotMatch(source, /api\.dicebear\.com/);
});
