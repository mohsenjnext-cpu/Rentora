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
