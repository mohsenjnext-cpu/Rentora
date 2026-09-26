import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const file = fs.readFileSync(new URL('../src/components/ChatModal.jsx', import.meta.url), 'utf8');

test('Chat modal interactive actions meet the 44px touch target baseline', () => {
  assert.ok((file.match(/min-h-11/g) || []).length >= 9);
  assert.match(file, /btn-primary min-h-11 min-w-11 p-2\.5 rounded-xl/);
  assert.match(file, /min-h-11 px-2\.5 py-1 rounded-lg/);
});

test('Chat modal keeps authenticated message flow server-context based', () => {
  assert.match(file, /sendConversationMessage\(targetId, \{ text \}\)/);
  assert.match(file, /archiveConversation\(convToDelete\)/);
  assert.doesNotMatch(file, /localStorage/);
});
