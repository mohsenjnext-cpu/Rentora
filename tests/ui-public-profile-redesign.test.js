import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('public profile redesign is additive and feature-flagged', () => {
  const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  const page=fs.readFileSync(new URL('../src/pages/PublicProfileRedesign.jsx',import.meta.url),'utf8');
  assert.match(app,/import PublicProfileRedesign from '\.\/pages\/PublicProfileRedesign'/);
  assert.match(app,/currentTab === 'public-profile'.*useItemDetailRedesign/s);
  assert.match(page,/fetchPublicUserProfile/);
  assert.match(page,/getUserReputationSummary/);
  assert.match(page,/ItemCard/);
  assert.doesNotMatch(page,/localStorage\.(getItem|setItem|removeItem)/);
});
