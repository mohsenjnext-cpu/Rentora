import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/pages/AdminDashboardPage.jsx', 'utf8');

test('admin dashboard imports all rendered icons and exposes retry recovery', () => {
  assert.ok(source.includes('CheckCircle2'));
  assert.ok(source.includes('onClick={load}'));
  assert.ok(source.includes('تلاش دوباره برای بارگذاری پنل مدیریت'));
});

test('admin dashboard exposes accessible search and refresh controls', () => {
  assert.ok(source.includes('aria-label="جستجوی پنل مدیریت"'));
  assert.ok(source.includes('aria-label="تازه‌سازی پنل مدیریت"'));
});

test('admin dashboard navigation exposes expanded and current state', () => {
  assert.ok(source.includes('aria-label="ناوبری پنل مدیریت"'));
  assert.ok(source.includes('aria-expanded={n.children ? open : undefined}'));
  assert.ok(source.includes('aria-current={section===n.id ? "page" : undefined}'));
  assert.ok(source.includes('aria-current={section===c[0] ? "page" : undefined}'));
});
