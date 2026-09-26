import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/pages/ProfilePage.jsx', 'utf8');

test('profile avatar upload rejects data URLs instead of reporting a persistent save', () => {
  assert.match(source, /if \(!url \|\| url\.startsWith\('data:'\)\)/);
  assert.match(source, /throw new Error\(l\('آپلود سرور تصویر انجام نشد/);
});

test('profile avatar state is updated only after the persistence guard', () => {
  const guardIndex = source.indexOf("if (!url || url.startsWith('data:'))");
  const avatarIndex = source.indexOf('setAvatar(url);', guardIndex);
  assert.ok(guardIndex >= 0, 'avatar persistence guard should exist');
  assert.ok(avatarIndex > guardIndex, 'avatar UI state should update after persistence validation');
});
