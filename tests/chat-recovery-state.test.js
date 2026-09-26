import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/pages/ChatPage.jsx', 'utf8');

test('chat list refresh clears stale errors before retrying', () => {
  assert.match(source, /setListError\('\'\)/);
  assert.match(source, /catch \(e\) \{\s*setListError\(/);
});

test('chat list refresh failure exposes a real retry action', () => {
  assert.match(source, /onClick=\{loadList\}/);
  assert.match(source, /l\('تلاش مجدد', 'Try again'/);
});
