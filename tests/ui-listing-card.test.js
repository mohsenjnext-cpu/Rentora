import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const home = fs.readFileSync(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8');
const card = fs.readFileSync(new URL('../src/components/ItemCard.jsx', import.meta.url), 'utf8');

test('Home uses the shared ItemCard for mobile listings', () => {
  assert.match(home, /<ItemCard[^>]+variant="compact"/);
  assert.doesNotMatch(home, /MobileItemCard/);
});

test('compact listing card keeps shared business behavior in ItemCard', () => {
  assert.match(card, /variant = 'default'/);
  assert.match(card, /variant === 'compact'/);
  assert.match(card, /toggleFavorite\(item\.id\)/);
  assert.match(card, /onRentClick\?\.\(item\)/);
  assert.match(card, /isOwner/);
});


test('Home renders shared listing card skeletons during initial load', () => {
  assert.match(home, /isInitialItemsLoading/);
  assert.match(home, /variant="skeleton"/);
  assert.match(home, /Array.from({ length: 4 }/);
  assert.match(home, /Array.from({ length: 8 }/);
});

test('listing card exposes a dedicated skeleton variant', () => {
  assert.match(card, /variant === 'skeleton'/);
  assert.match(card, /aria-hidden="true"/);
  assert.match(card, /animate-pulse/);
});


test('compact card does not use a nested interactive role', () => {
  assert.doesNotMatch(card, /variant === 'compact'[\s\S]*?role="button"/);
});
