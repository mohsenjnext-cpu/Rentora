import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/pages/ProfilePage.jsx', 'utf8');

test('profile settings and listing management controls expose localized accessible names', () => {
  assert.match(source, /aria-label=\{l\('تنظیمات پروفایل', 'Profile settings'/);
  assert.match(source, /aria-label=\{l\('مدیریت آگهی‌های من', 'Manage my listings'/);
});

test('profile avatar camera control exposes a localized accessible name', () => {
  assert.match(source, /aria-label=\{l\('تغییر تصویر پروفایل', 'Change profile photo'/);
  assert.match(source, /<Camera aria-hidden="true"/);
});

test('profile controls keep explicit button semantics', () => {
  assert.match(source, /<button type="button" onClick=\{\(\) => fileInputRef\.current\?\.click\(\)\} aria-label=/);
  assert.match(source, /<button type="button" onClick=\{\(\) => onNavigate\('settings'\)\} aria-label=/);
});