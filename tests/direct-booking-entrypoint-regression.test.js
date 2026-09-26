import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('App resolves the authoritative item collection before direct booking', () => {
  assert.match(app, /const \{ items \} = useRentora\(\);/);
  assert.match(app, /const fullItem = \(items \|\| \[\]\)\.find\(i => i\.id === item\.id\) \|\| item;/);
});

test('App blocks owners from opening their own direct booking flow', () => {
  assert.match(
    app,
    /if \(\(myName && ownerName && myName === ownerName\) \|\| \(fullItem\.ownerUid && currentUser\?\.uid && fullItem\.ownerUid === currentUser\.uid\)\)/
  );
  assert.match(app, /handleSelectItem\(fullItem\);/);
  assert.match(app, /return;/);
});

test('App opens direct booking only after the owner guard passes', () => {
  const guardIndex = app.indexOf('if ((myName && ownerName');
  const bookingIndex = app.indexOf('setDirectBookingItem(fullItem);', guardIndex);
  const openIndex = app.indexOf('setIsDirectBookingOpen(true);', bookingIndex);

  assert.ok(guardIndex >= 0, 'direct booking owner guard should exist');
  assert.ok(bookingIndex > guardIndex, 'booking state should be set after the owner guard');
  assert.ok(openIndex > bookingIndex, 'booking modal should open after the selected item is set');
});
