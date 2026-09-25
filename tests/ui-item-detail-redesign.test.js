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
  assert.doesNotMatch(booking, /offline\/compatibility mode/);
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


test('incomplete Pi callback cannot mutate a rental without verified intent binding', () => {
  const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
  const start = worker.indexOf("path === '/api/payments/incomplete'");
  const end = worker.indexOf("path === '/api/sync/item'", start);
  assert.ok(start >= 0 && end > start);
  const route = worker.slice(start, end);
  assert.match(route, /SELECT pi\.\*, u\.pi_uid FROM payment_intents pi JOIN users u ON u\.id=pi\.user_id/);
  assert.match(route, /payerUid\.toLowerCase\(\) !== String\(intent\.pi_uid/);
  assert.match(route, /metadataIntent/);
  assert.match(route, /Math\.abs\(payerAmount - expectedAmount\)/);
  assert.match(route, /UPDATE rentals SET payment_status='completed', status='confirmed'/);
  assert.match(route, /INSERT INTO transactions\(/);
});


test('Pi payment flow never retries native payment merely because a payment/approval/completion error contains payment wording', () => {
  const service = fs.readFileSync(new URL('../src/services/piService.js', import.meta.url), 'utf8');
  assert.match(service, /errMsg\.includes\('scope'\) \|\| errMsg\.includes\('authenticate'\)/);
  assert.doesNotMatch(service, /errMsg\.includes\('payment'\)/);
  assert.match(service, /onReadyForServerCompletion/);
  assert.match(service, /completePaymentOnServer/);
});


test('listing KYC badge cannot be asserted by client-supplied listing metadata', () => {
  const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
  const listingViewStart = worker.indexOf('function listingView');
  const rentalViewStart = worker.indexOf('function rentalView', listingViewStart);
  assert.ok(listingViewStart >= 0 && rentalViewStart > listingViewStart);
  const listingView = worker.slice(listingViewStart, rentalViewStart);
  assert.match(listingView, /ownerMeta\.kycStatus === 'verified'/);
  assert.doesNotMatch(listingView, /meta\.ownerKYC/);
});


test('cloud sync requests carry the server session token for authenticated API routes', () => {
  const sync = fs.readFileSync(new URL('../src/services/cloudSyncService.js', import.meta.url), 'utf8');
  const start = sync.indexOf('getAuthHeaders()');
  const end = sync.indexOf('async compressImage', start);
  assert.ok(start >= 0 && end > start);
  const helper = sync.slice(start, end);
  assert.match(helper, /localStorage\.getItem\(STORAGE_USER_KEY\)/);
  assert.ok(helper.includes('session?.sessionToken'));
  assert.ok(helper.includes('headers.Authorization ='));
  assert.ok(helper.includes('Bearer'));
});


test('legacy rental sync endpoint is retired so client payloads cannot bypass quote authority', () => {
  const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
  const route = worker.indexOf("path === '/api/sync/rental'");
  assert.ok(route >= 0);
  const next = worker.indexOf("path === '/api/sync/rental/status'", route);
  assert.ok(next > route);
  const block = worker.slice(route, next);
  assert.match(block, /Legacy rental endpoint is deprecated/);
  assert.match(block, /410/);
  assert.doesNotMatch(block, /INSERT INTO rentals/);
});


test('archived conversations cannot accept new messages', () => {
  const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
  const start = worker.indexOf("path.startsWith('/api/conversations/') && path.endsWith('/messages')");
  assert.ok(start >= 0);
  const block = worker.slice(start, worker.indexOf("path.startsWith('/api/conversations/') && path.endsWith('/archive')", start));
  assert.match(block, /conv\.status === 'archived'/);
  assert.match(block, /Archived conversations are read-only/);
});


test('Pi approval binds the intent before the external approve call and preserves the binding for retry', () => {
  const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
  const start = worker.indexOf("path === '/api/payments/approve'");
  const end = worker.indexOf("path === '/api/payments/complete'", start);
  assert.ok(start >= 0 && end > start);
  const route = worker.slice(start, end);
  const claim = route.indexOf("UPDATE payment_intents SET pi_payment_id=?1");
  const approve = route.indexOf('const approveResponse = await piFetch');
  const finalize = route.indexOf("UPDATE payment_intents SET status='approved'");
  assert.ok(claim >= 0 && approve > claim && finalize > approve);
  assert.match(route, /status='created' AND \(pi_payment_id IS NULL OR pi_payment_id=\?1\)/);
  assert.match(route, /Keep the same Pi payment bound to the intent/);
  assert.ok(!route.includes("status='created' AND pi_payment_id IS NULL\\n\n        const approveResponse"));
});

test('payment intent creation never resets a live Pi payment binding', () => {
  const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
  const start = worker.indexOf("path === '/api/payments/intent'");
  const end = worker.indexOf("path === '/api/payments/approve'", start);
  assert.ok(start >= 0 && end > start);
  const route = worker.slice(start, end);
  assert.match(route, /existing\.pi_payment_id/);
  assert.match(route, /boundPaymentId/);
  assert.match(route, /Never reset the binding and orphan that payment/);
});

test('expired payment intent bindings are reconciled before any replacement intent is created', () => {
  const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
  const start = worker.indexOf("path === '/api/payments/intent'");
  const end = worker.indexOf("path === '/api/payments/approve'", start);
  assert.ok(start >= 0 && end > start);
  const route = worker.slice(start, end);
  assert.match(route, /existingLiveBinding/);
  assert.match(route, /Bound Pi payment could not be reconciled/);
  assert.match(route, /paymentStatus/);
  assert.match(route, /status != 'cancelled'/);
});

test('native Pi SDK errors trigger server reconciliation when a payment identifier exists', () => {
  const service = fs.readFileSync(new URL('../src/services/piService.js', import.meta.url), 'utf8');
  const start = service.indexOf('onError: async');
  const end = service.indexOf('fail(new Error', start);
  assert.ok(start >= 0 && end > start);
  const handler = service.slice(start, end);
  assert.match(handler, /handleIncompletePayment/);
  assert.match(handler, /paymentId/);
});


test('Pi completion cannot accept a client txid that conflicts with the verified payment or another transaction', () => {
  const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
  const start = worker.indexOf("path === '/api/payments/complete'");
  const end = worker.indexOf("path === '/api/payments/incomplete'", start);
  assert.ok(start >= 0 && end > start);
  const route = worker.slice(start, end);
  assert.match(route, /payment\?\.transaction\?\.txid/);
  assert.match(route, /Transaction ID does not match the verified Pi payment/);
  assert.match(route, /SELECT payment_intent_id, pi_payment_id, pi_txid FROM transactions WHERE pi_payment_id=\?1 OR pi_txid=\?2/);
  assert.match(route, /Transaction is already bound to another payment intent/);
});

test('Pi completion transaction persistence uses conflict-safe identity checks before confirming the rental', () => {
  const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
  const start = worker.indexOf("path === '/api/payments/complete'");
  const end = worker.indexOf("path === '/api/payments/incomplete'", start);
  assert.ok(start >= 0 && end > start);
  const route = worker.slice(start, end);
  const identityCheck = route.indexOf('const existingTransaction');
  const confirm = route.indexOf("UPDATE rentals SET payment_status='completed',status='confirmed'");
  assert.ok(identityCheck >= 0 && confirm > identityCheck);
  assert.match(route, /INSERT INTO transactions\(/);
});
