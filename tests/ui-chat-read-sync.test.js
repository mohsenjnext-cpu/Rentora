import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('chat read state is broadcast for cross-tab synchronization', () => {
  const cloud = fs.readFileSync(new URL('../src/services/cloudSyncService.js', import.meta.url), 'utf8');
  const rentora = fs.readFileSync(new URL('../src/context/RentoraContext.jsx', import.meta.url), 'utf8');

  assert.match(cloud, /type: 'CHAT_READ'/);
  assert.match(cloud, /conversationId: convId/);
  assert.match(rentora, /event === 'CHAT_READ' && data\?\.conversationId/);
  assert.match(rentora, /cloudSyncService\.broadcastConversationRead\(convId\)/);
});
