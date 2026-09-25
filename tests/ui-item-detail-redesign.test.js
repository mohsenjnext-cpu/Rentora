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


test('redesigned item detail converges reviews and primary booking CTA on shared primitives', () => {
  assert.match(file, /RentoraButton/);
  assert.match(file, /RentoraCard/);
  assert.match(file, /RentoraEmptyState/);
  assert.match(file, /RentoraSkeleton/);
  assert.match(file, /loadingReviews/);
  assert.match(file, /totalReviews === 0/);
});

test('booking and report modals converge on shared interaction primitives', () => {
  const booking = fs.readFileSync(new URL('../src/components/BookingModal.jsx', import.meta.url), 'utf8');
  const report = fs.readFileSync(new URL('../src/components/ReportModal.jsx', import.meta.url), 'utf8');
  assert.match(booking, /RentoraModal/);
  assert.match(booking, /RentoraButton/);
  assert.match(booking, /RentoraInput/);
  assert.match(booking, /RentoraAlert/);
  assert.doesNotMatch(booking, /offline\\/compatibility mode/);
  assert.doesNotMatch(booking, /broadcastNewRental/);
  assert.match(booking, /serverQuote/);
  assert.match(booking, /hasAuthoritativeQuote/);
  assert.match(report, /RentoraModal/);
  assert.match(report, /RentoraButton/);
  assert.match(report, /RentoraAlert/);
  assert.match(report, /RentoraEmptyState/);
});


test('rental creation client contract requires an authoritative quote id', () => {
  const sync = fs.readFileSync(new URL('../src/services/cloudSyncService.js', import.meta.url), 'utf8');
  assert.match(sync, /async createRental\(\{ quoteId \}\)/);
  assert.match(sync, /if \(!quoteId\) throw new Error/);
  assert.match(sync, /const body = \{ quoteId \};/);
});


test('active booking path cannot fall back to client-supplied listing dates', () => {
  const booking = fs.readFileSync(new URL('../src/components/BookingModal.jsx', import.meta.url), 'utf8');
  assert.match(booking, /const persistedRental = await cloudSyncService\.createRental\(\{ quoteId: serverQuote\.quoteId \}\)/);
  assert.doesNotMatch(booking, /createRental\(\{[\s\S]*listingId: item\.id/);
  assert.doesNotMatch(booking, /createRental\(\{[\s\S]*startDate: dates\.startDate/);
  assert.doesNotMatch(booking, /createRental\(\{[\s\S]*endDate: dates\.endDate/);
});

test('context rental compatibility wrapper delegates only to authoritative quote creation', () => {
  const context = fs.readFileSync(new URL('../src/context/RentoraContext.jsx', import.meta.url), 'utf8');
  const start = context.indexOf('const createRentalBooking');
  const end = context.indexOf('const executePiPaymentForRental', start);
  assert.ok(start >= 0 && end > start);
  const bookingFn = context.slice(start, end);
  assert.match(bookingFn, /quoteId/);
  assert.match(bookingFn, /cloudSyncService\.createRental\(\{ quoteId \}\)/);
  assert.doesNotMatch(bookingFn, /FinancialEngine/);
  assert.doesNotMatch(bookingFn, /Math\.random/);
  assert.doesNotMatch(bookingFn, /pricePerDay|dailyRate|securityDeposit|rentalTotal|rentoraFee/);
});


test('Pi payment wrapper does not synthesize or broadcast a confirmed rental client-side', () => {
  const context = fs.readFileSync(new URL('../src/context/RentoraContext.jsx', import.meta.url), 'utf8');
  const start = context.indexOf('const executePiPaymentForRental');
  const end = context.indexOf('const transitionRentalStatus', start);
  assert.ok(start >= 0 && end > start);
  const paymentFn = context.slice(start, end);
  assert.match(paymentFn, /piService\.createPayment/);
  assert.doesNotMatch(paymentFn, /const confirmedRental/);
  assert.doesNotMatch(paymentFn, /setRentals/);
  assert.doesNotMatch(paymentFn, /broadcastNewRental/);
  assert.doesNotMatch(paymentFn, /saveCachedRentals/);
});
