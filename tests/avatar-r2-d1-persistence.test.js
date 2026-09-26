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
  assert.ok(block.includes('await requireUser(request, env)'), 'upload must require an authenticated user');
  assert.ok(block.includes('detectImageFormat(bytes)'), 'uploaded bytes must be format-validated');
  assert.ok(block.includes('env?.RENTORA_MEDIA') && block.includes('RENTORA_MEDIA.put(`images/${imgId}`'), 'R2 should be the primary avatar store');
  assert.ok(block.includes('env?.RENTORA_KV') && block.includes('RENTORA_KV.put(`image:${imgId}`'), 'KV fallback should exist');
  assert.ok(block.includes('url: `/api/images/${imgId}`'), 'upload should return the persisted image API URL');
});

test('profile save writes the server image URL into the D1-backed user profile', () => {
  const syncStart = worker.indexOf("if (method === 'POST' && path === '/api/sync/user')");
  const syncEnd = worker.indexOf("if (method === 'POST' && path === '/api/upload')", syncStart);
  assert.ok(syncStart >= 0 && syncEnd > syncStart, 'profile sync route should exist');
  const block = worker.slice(syncStart, syncEnd);
  assert.ok(block.includes('await requireUser(request, env)'), 'profile sync must require an authenticated user');
  assert.ok(block.includes('const newAvatar = body.avatar !== undefined'), 'profile sync must derive avatar from the request');
  assert.ok(block.includes('UPDATE users SET display_name=?1,avatar_url=?2,metadata=?3,updated_at=?4 WHERE id=?5'), 'avatar URL must persist in D1');
  assert.ok(block.includes('SELECT * FROM users WHERE id=?1'), 'saved profile must be read back from D1');
});

test('frontend never commits a local data URL as a successful persisted avatar', () => {
  assert.ok(syncService.includes('/api/upload'), 'frontend must use the server upload endpoint');
  assert.ok(syncService.includes('if (res.ok && json?.url)'), 'frontend must only accept a server URL as upload success');
  assert.ok(profile.includes("if (!url || url.startsWith('data:'))"), 'profile must reject local data URLs');
  assert.ok(profile.includes('setAvatar(url);'), 'profile UI should update from the persisted URL');
});
