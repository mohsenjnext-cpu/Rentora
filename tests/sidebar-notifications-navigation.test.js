import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('sidebar exposes a direct notifications route with active state', () => {
  const sidebar = fs.readFileSync(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');

  assert.match(sidebar, /Bell/);
  assert.match(sidebar, /handleNavClick\('notifications'\)/);
  assert.match(sidebar, /currentTab === 'notifications'/);
  assert.match(sidebar, /اعلان‌ها/);
  assert.match(sidebar, /Notifications/);
});
