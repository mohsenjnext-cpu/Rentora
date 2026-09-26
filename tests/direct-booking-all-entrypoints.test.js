import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('src/App.jsx');
const itemDetail = read('src/pages/ItemDetailPage.jsx');
const publicProfile = read('src/pages/PublicProfilePage.jsx');
const chatModal = read('src/components/ChatModal.jsx');

test('App wires Home and Discover rental actions to the centralized direct-booking handler', () => {
  assert.ok(app.includes('<HomePage'));
  assert.ok(app.includes('<DiscoverPage'));
  assert.ok((app.match(/onRentItem=\{handleRentItem\}/g) || []).length >= 2);
});

test('App wires Profile and Public Profile rental actions to the centralized direct-booking handler', () => {
  assert.ok(app.includes('<PublicProfilePage'));
  assert.ok(app.includes('<ProfilePage'));
  assert.ok((app.match(/onRentItem=\{handleRentItem\}/g) || []).length >= 4);
});

test('Item Detail keeps booking gated by owner and availability checks', () => {
  assert.match(itemDetail, /const isOwner = Boolean\(/);
  assert.match(itemDetail, /const isUnavailable = /);
  assert.match(itemDetail, /onClick=\{\(\) => setBookingModalOpen\(true\)\}/);
  assert.match(itemDetail, /disabled=\{isOwner \|\| isUnavailable\}/);
  assert.match(itemDetail, /<BookingModal item=\{item\} isOpen=\{bookingModalOpen\}/);
});

test('Public Profile exposes rental actions through ItemCard', () => {
  assert.ok(publicProfile.includes('<ItemCard'));
  assert.ok(publicProfile.includes('onRentClick={onRentItem}'));
});

test('Chat booking CTA delegates to its parent booking action', () => {
  assert.match(chatModal, /const handleBookingCTA = \(\) => \{/);
  assert.match(chatModal, /if \(onDirectRent && activeItem\) onDirectRent\(activeItem\);/);
  assert.match(app, /onDirectRent=\{\(item\) => \{ setIsChatModalOpen\(false\); handleRentItem\(item\); \}\}/);
});
