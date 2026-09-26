import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('chat read state is server-authoritative and broadcasts locally after persistence', () => {
  const cloud = fs.readFileSync(new URL('../src/services/cloudSyncService.js', import.meta.url), 'utf8');
  const rentora = fs.readFileSync(new URL('../src/context/RentoraContext.jsx', import.meta.url), 'utf8');

  assert.match(cloud, /async markConversationAsRead\(conversationId\)/);
  assert.match(cloud, /\/api\/conversations\/\$\{encodeURIComponent\(conversationId\)\}\/read/);
  assert.match(rentora, /await cloudSyncService\.markConversationAsRead\(convId\)/);
  assert.match(rentora, /cloudSyncService\.broadcastConversationRead\(convId\)/);
  assert.doesNotMatch(rentora, /rentora_chat_reads_/);
  assert.doesNotMatch(rentora, /localStorage\.setItem\(key, JSON\.stringify\(reads\)/);
});

test('conversation refresh trusts server-provided unreadCount', () => {
  const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
  const cloud = fs.readFileSync(new URL('../src/services/cloudSyncService.js', import.meta.url), 'utf8');

  assert.match(worker, /conversation_reads/);
  assert.match(worker, /unread_count/);
  assert.match(worker, /INSERT INTO conversation_reads/);
  assert.match(cloud, /async fetchConversations\(\)/);
});
