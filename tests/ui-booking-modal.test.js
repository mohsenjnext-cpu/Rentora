import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const file = fs.readFileSync(new URL('../src/components/BookingModal.jsx', import.meta.url), 'utf8');

test('Booking modal keeps rental and deposit as direct P2P settlement and Pi fee as online payment', () => {
  assert.match(file, /Rental \(Direct P2P\)/);
  assert.match(file, /Deposit \(Direct P2P\)/);
  assert.match(file, /Rentora Fee \(Paid Online\)/);
  assert.match(file, /createRental\(\{ quoteId: serverQuote\.quoteId \}\)/);
});

test('Booking modal does not use a fake external image fallback or copy feedback timer', () => {
  assert.doesNotMatch(file, /images\.unsplash\.com/);
  assert.doesNotMatch(file, /setTimeout/);
});

test('Booking modal copy and call actions have mobile-friendly touch targets', () => {
  assert.match(file, /min-h-11 min-w-11 px-2 py-1 rounded/);
  assert.match(file, /btn-primary min-h-11 px-2\.5 py-1/);
});
