import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/pages/SettingsPage.jsx', 'utf8');

test('settings language controls expose selected state and accessible names', () => {
  assert.ok(source.includes('aria-pressed={isSelected}'));
  assert.ok(source.includes('Select language ${lng.native}'));
});

test('settings theme control exposes state and localized action name', () => {
  assert.ok(source.includes('aria-pressed={theme === \'dark\'}'));
  assert.ok(source.includes('Switch to light mode'));
  assert.ok(source.includes('Switch to dark mode'));
});