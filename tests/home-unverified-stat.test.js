import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('Home does not display an unverified handover percentage', () => {
  const source = fs.readFileSync(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8');
  assert.equal((source.match(/۱۰۰٪|100%/g) || []).length, 0);
  assert.match(source, /Pickup handover confirmation|تأیید تحویل در محل/);
});
