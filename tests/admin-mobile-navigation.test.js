import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('admin console exposes mobile section navigation and keeps desktop sidebar separate', () => {
  const source = fs.readFileSync(new URL('../src/pages/AdminDashboardPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /id="admin-mobile-section"/);
  assert.match(source, /aria-label="انتخاب بخش مدیریت"/);
  assert.match(source, /className="hidden lg:block rentora-card p-2 h-fit lg:sticky lg:top-3"/);
  assert.match(source, /onChange=\{\(e\)=>go\(e\.target\.value\)\}/);
});
