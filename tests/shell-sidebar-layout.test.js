import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('app content offset matches the 272px desktop sidebar width', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const sidebar = fs.readFileSync(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');

  assert.match(sidebar, /w-\[272px\]/);
  assert.match(app, /flex flex-col md:ps-\[272px\]/);
  assert.doesNotMatch(app, /md:ps-64/);
});
