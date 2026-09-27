import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('mobile sidebar supports Escape dismissal and dialog semantics', () => {
  const source = fs.readFileSync(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');

  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /setMobileOpen\?\.\(false\)/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-label=\{l\('منوی کناری', 'Side menu'/);
});
