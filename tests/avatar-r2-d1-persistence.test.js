import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync('_worker.js', 'utf8');
const syncService = fs.readFileSync('src/services/cloudSyncService.js', 'utf8');
const profile = fs.readFileSync('src/pages/ProfilePage.jsx', 'utf8');

test('avatar upload persists through authenticated API to R2 with KV fallback', () => {
  const uploadStart = worker.indexOf("if (method === 'POST' && path === '/api/upload')");
  const uploadEnd = worker.indexOf("if (method === 'GET' && path.startsWith('/api/images/'))", uploadStart);
  assert.ok(uploadStart >= 0, 'avatar upload route should exist');
  assert.ok(uploadEnd > uploadStart, 'avatar upload route should have a bounded implementation block');
  const block = worker.slice(uploadStart, uploadEnd);
  assert.match(block, /await requireUser\\(request, env\\)/);
  assert.match(block, /detectImageFormat\\(bytes\\)/);
  assert.match(block, /env\\.RENTORA_MEDIA\\.put\\(.*images\\/\\$\\{imgId\\}/);
  assert.match(block, /env\\.RENTORA_KV\\.put\\(.*image:\\$\\{imgId\\}/);
  assert.match(block, /url:.*\\/api\\/images\\/\\$\\{imgId\\}/);
});

test('profile save writes the server image URL into the D1-backed user profile', () => {
  const syncStart = worker.indexOf("if (method === 'POST' && path === '/api/sync/user')");
  const syncEnd = worker.indexOf("if (method === 'POST' && path === '/api/upload')", syncStart);
  assert.ok(syncStart >= 0 && syncEnd > syncStart, 'profile sync route should exist');
  const block = worker.slice(syncStart, syncEnd);
  assert.match(block, /await requireUser\\(request, env\\)/);
  assert.match(block, /const newAvatar = body\\.avatar !== undefined/);
  assert.match(block, /UPDATE users SET display_name=\\?1,avatar_url=\\?2,metadata=\\?3,updated_at=\\?4 WHERE id=\\?5/);
  assert.match(block, /SELECT \\* FROM users WHERE id=\\?1/);
});

test('frontend never commits a local data URL as a successful persisted avatar', () => {
  assert.match(syncService, /fetch\\(.*\\/api\\/upload/);
  assert.match(syncService, /if \\(res\\.ok && json\\?\\.url\\) \\{/);
  assert.match(profile, /if \\(!url \\|\\| url\\.startsWith\\('data:'\\)\\)/);
  assert.match(profile, /setAvatar\\(url\\);/);
});
