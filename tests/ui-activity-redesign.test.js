import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('activity redesign is wired behind the existing redesign flag', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../src/pages/ActivityRedesign.jsx', import.meta.url), 'utf8');
  assert.match(app, /import ActivityRedesign from '\.\/pages\/ActivityRedesign'/);
  assert.match(app, /currentTab === 'activity'.*useItemDetailRedesign/s);
  assert.match(page, /useRentora/);
  assert.match(page, /fetchRentalContact/);
  assert.match(page, /confirmHandoverOneTap/);
  assert.match(page, /ReviewModal/);
  assert.match(page, /ReportModal/);
  assert.doesNotMatch(page, /localStorage\.(getItem|setItem|removeItem)/);
});
