import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('desktop shell uses Sidebar as the single primary navigation source', () => {
  const header = fs.readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const sidebar = fs.readFileSync(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');

  assert.match(header, /Primary desktop navigation lives in the Sidebar/);
  assert.doesNotMatch(header, /Horizontal Nav Links/);
  assert.doesNotMatch(header, /onNavigate\('discover'\)/);
  assert.doesNotMatch(header, /onNavigate\('owner-hub'\)/);
  assert.doesNotMatch(header, /onNavigate\('activity'\)/);
  assert.match(app, /<Sidebar /);
  assert.match(sidebar, /navItems\.map/);
});
