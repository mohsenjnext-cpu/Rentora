import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('src/App.jsx');
const itemDetail = read('src/pages/ItemDetailPage.jsx');
const publicProfile = read('src/pages/PublicProfilePage.jsx');
const chatModal = read('src/components/ChatModal.jsx');

test('App wires Home and Discover rental actions to the centralized direct-booking handler', () => {
  assert.match(app, /<HomePage[^>]*onRentItem=\{handleRentItem\}/s);
  assert.match(app, /<DiscoverPage[^>]*onRentItem=\{handleRentItem\}/s);
});

test('App wires Profile and Public Profile rental actions to the centralized direct-booking handler', () => {
  assert.match(app, /<PublicProfilePage[^>]*onRentItem=\{handleRentItem\}/s);
  assert.match(app, /<ProfilePage[^>]*onRentItem=\{handleRentItem\}/s);
});

test('Item Detail keeps booking gated by authoritative availability and owner checks', () => {
  assert.match(itemDetail, /const isOwner = Boolean\(/);
  assert.match(itemDetail, /const isUnavailable = /);
  assert.match(itemDetail, /onClick=\{\(\) => setBookingModalOpen\(true\)\}/);
  assert.match(itemDetail, /disabled=\{isOwner \|\| isUnavailable\}/);
  assert.match(itemDetail, /<BookingModal item=\{item\} isOpen=\{bookingModalOpen\}/);
});

test('Public Profile exposes rental actions through ItemCard', () => {
  assert.match(publicProfile, /<ItemCard[^>]*onRentClick=\{onRentItem\}/s);
});

test('Chat booking CTA delegates to its parent booking action', () => {
  assert.match(chatModal, /const handleBookingCTA = \(\) => \{/);
  assert.match(chatModal, /if \(onDirectRent && activeItem\) onDirectRent\(activeItem\);/);
  assert.match(app, /onDirectRent=\{\(item\) => \{ setIsChatModalOpen\(false\); handleRentItem\(item\); \}\}/);
});
