import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('admin console exposes responsive primary and secondary navigation', () => {
  const source = fs.readFileSync(new URL('../src/pages/AdminDashboardPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /className="admin-primary-nav"/);
  assert.match(source, /className="admin-subnav"/);
  assert.match(source, /className="admin-context-bar"/);
});
