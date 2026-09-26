import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const home = fs.readFileSync(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8');

test('Home uses the shared ItemCard for mobile featured listings', () => {
  assert.match(home, /featuredItems\.slice\(0, 4\)\.map\(item => <ItemCard key=\{item\.id\} item=\{item\} onSelect=\{onSelectItem\} onRentClick=\{onRentItem\} \/>\)/);
  assert.doesNotMatch(home, /const MobileItemCard =/);
  assert.doesNotMatch(home, /<MobileItemCard\b/);
});

test('Home keeps the shared ItemCard available for desktop featured listings', () => {
  assert.match(home, /featuredItems\.map\(item => <ItemCard key=\{item\.id\} item=\{item\} onSelect=\{onSelectItem\} onRentClick=\{onRentItem\} \/>\)/);
});
