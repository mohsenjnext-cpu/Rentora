import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../src/pages/HomeRedesign.jsx', import.meta.url), 'utf8');

test('HomeRedesign is wired behind the redesign flag', () => {
  assert.match(app, /import HomeRedesign from ['"]\.\/pages\/HomeRedesign['"]/);
  assert.match(app, /currentTab === ['"]home['"][\s\S]*useItemDetailRedesign \? <HomeRedesign/);
});

test('HomeRedesign uses authoritative Rentora data and design-system states', () => {
  assert.match(page, /useRentora/);
  assert.match(page, /usePiAuth/);
  assert.match(page, /RentoraCard/);
  assert.match(page, /RentoraButton/);
  assert.match(page, /RentoraEmptyState/);
  assert.match(page, /RentoraSkeleton/);
  assert.match(page, /onNavigate\(['"]discover['"]/);
  assert.match(page, /onNavigate\(['"]list-item['"]/);
  assert.doesNotMatch(page, /localStorage\.(getItem|setItem|removeItem)/);
});

test('HomeRedesign preserves listing selection and booking actions', () => {
  assert.match(page, /onSelectItem/);
  assert.match(page, /onRentItem/);
  assert.match(page, /<ItemCard/);
});
