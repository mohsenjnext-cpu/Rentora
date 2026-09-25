import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = fs.readFileSync(new URL('../src/pages/ItemDetailRedesign.jsx', import.meta.url), 'utf8');

test('redesigned item detail preserves real booking and reporting entry points', () => {
  assert.match(file, /BookingModal/);
  assert.match(file, /ReportModal/);
  assert.match(file, /setBookingOpen\(true\)/);
  assert.match(file, /setReportOpen\(true\)/);
});

test('redesigned item detail does not introduce a fake external image fallback', () => {
  assert.doesNotMatch(file, /images\.unsplash\.com/);
  assert.match(file, /No listing image/);
});

test('redesigned item detail keeps private contact behind verified rental context', () => {
  assert.match(file, /verified booking-fee completion/);
  assert.match(file, /Private contact details/);
});

test('redesigned item detail keeps direct P2P rental and deposit settlement explicit', () => {
  assert.match(file, /Direct P2P/);
  assert.match(file, /Rentora processes only the platform fee through Pi/);
});

test('redesigned item detail provides keyboard-friendly 44px touch targets', () => {
  assert.match(file, /min-h-11/);
  assert.match(file, /focus-visible:ring-2/);
});

test('app keeps the legacy item detail and exposes the redesign additively behind an explicit preview flag', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /ItemDetailRedesign/);
  assert.match(app, /ui.*redesign/);
  assert.match(app, /ItemDetailPage/);
});
