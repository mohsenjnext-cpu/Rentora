import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('sidebar exposes help and issue reporting entry', () => {
  const sidebar = fs.readFileSync(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');

  assert.match(sidebar, /HelpCircle/);
  assert.match(sidebar, /onOpenHelp\?\.\('guide'\)/);
  assert.match(sidebar, /راهنما و گزارش مشکل/);
  assert.match(sidebar, /Help & report an issue/);
  assert.match(sidebar, /setMobileOpen\?\.\(false\)/);
});
