import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('owner hub redesign is wired behind the existing redesign flag', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../src/pages/OwnerHubRedesign.jsx', import.meta.url), 'utf8');
  assert.match(app, /import OwnerHubRedesign from '\.\/pages\/OwnerHubRedesign'/);
  assert.match(app, /currentTab === 'owner-hub'.*useItemDetailRedesign/s);
  assert.match(page, /useRentora/);
  assert.match(page, /toggleItemStatus/);
  assert.match(page, /confirmReturnOneTap/);
  assert.doesNotMatch(page, /localStorage\.(getItem|setItem|removeItem)/);
});
