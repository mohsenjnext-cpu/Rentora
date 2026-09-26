import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const redesign = fs.readFileSync(new URL('../src/pages/ItemDetailRedesign.jsx', import.meta.url), 'utf8');
const legacy = fs.readFileSync(new URL('../src/pages/ItemDetailPage.jsx', import.meta.url), 'utf8');

test('listing detail has a stable /item/:id route and restores it on direct load', () => {
  assert.match(app, /getListingIdFromPath/);
  assert.match(app, /window\.location\.pathname\.match/);
  assert.match(app, /new URL\(window\.location\.href\)/);
  assert.match(app, /url\.pathname = `\/item\/\$\{encodeURIComponent\(item\.id\)\}`/);
  assert.match(app, /window\.history\.pushState/);
  assert.match(app, /window\.addEventListener\('popstate'/);
  assert.match(app, /cloudSyncService\.fetchListingById\(listingId\)/);
});

test('redesigned item share uses the current canonical page URL', () => {
  assert.match(redesign, /navigator\.share\(\{ title: item\.title, url: window\.location\.href \}\)/);
  assert.match(redesign, /navigator\.clipboard\.writeText\(window\.location\.href\)/);
});

test('legacy item detail share also benefits from the canonical route', () => {
  assert.match(legacy, /navigator\.clipboard\.writeText\(window\.location\.href\)/);
});


test('direct listing route exposes an explicit not-found state after initial sync completes', () => {
  assert.match(app, /const \{ items, isInitialLoadDone \} = useRentora\(\)/);
  assert.match(app, /currentTab === 'item-detail' && !selectedItem && isInitialLoadDone/);
  assert.match(app, /آگهی پیدا نشد/);
});
