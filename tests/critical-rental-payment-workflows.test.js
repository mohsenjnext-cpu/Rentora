import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');

test('critical rental workflow keeps quote -> rental authority on the server', () => {
  const quoteStart = worker.indexOf("path === '/api/rentals/quote'");
  const rentalStart = worker.indexOf("path === '/api/rentals'");
  assert.ok(quoteStart >= 0, 'quote endpoint must exist');
  assert.ok(rentalStart > quoteStart, 'rental creation must follow quote route');

  const quoteBlock = worker.slice(quoteStart, rentalStart);
  assert.match(quoteBlock, /listing\.price_per_day/);
  assert.match(quoteBlock, /listing\.deposit_amount/);
  assert.match(quoteBlock, /calculateAuthoritativeFinancials\(/);
  assert.match(quoteBlock, /quote:\s*quoteData/);
  assert.match(quoteBlock, /RENTORA_KV\.put\(\`quote:\$\{quoteId\}/);

  const rentalBlock = worker.slice(rentalStart, worker.indexOf("path === '/api/payments/intent'", rentalStart));
  assert.match(rentalBlock, /quote\.listingId/);
  assert.match(rentalBlock, /quote\.startDate/);
  assert.match(rentalBlock, /quote\.endDate/);
  assert.match(rentalBlock, /quote\.pricePerDay !== financials\.pricePerDay/);
  assert.match(rentalBlock, /quote\.depositAmount !== financials\.depositAmount/);
  assert.match(rentalBlock, /rental_amount/);
  assert.match(rentalBlock, /deposit_amount/);
  assert.match(rentalBlock, /platform_fee/);
  assert.match(rentalBlock, /total_amount/);
  assert.match(rentalBlock, /'pending_payment'/);
});

test('payment intent derives the Pi amount from the persisted rental fee', () => {
  const start = worker.indexOf("path === '/api/payments/intent'");
  const end = worker.indexOf("path === '/api/payments/approve'", start);
  assert.ok(start >= 0 && end > start, 'payment intent route must exist');
  const block = worker.slice(start, end);

  assert.match(block, /SELECT r\.\*, l\.title, l\.id listing_id, l\.price_per_day, l\.deposit_amount/);
  assert.match(block, /r\.renter_user_id=\?2/);
  assert.match(block, /const canonicalAmount = toCanonicalDecimal\(rental\.platform_fee\)/);
  assert.match(block, /expectedAmount: canonicalAmount/);
  assert.match(block, /rentalId: rental\.id/);
  assert.match(block, /userId: user\.id/);
  assert.match(block, /amount: canonicalAmount/);
  assert.doesNotMatch(block, /body\.(amount|totalAmount|platformFee)/);
});

test('Pi approval and completion re-verify identity, amount, payment state and intent ownership', () => {
  const approveStart = worker.indexOf("path === '/api/payments/approve'");
  const completeStart = worker.indexOf("path === '/api/payments/complete'", approveStart);
  assert.ok(approveStart >= 0 && completeStart > approveStart, 'payment approval route must exist');

  const approve = worker.slice(approveStart, completeStart);
  assert.match(approve, /payment_intents WHERE id=\?1 AND user_id=\?2/);
  assert.match(approve, /validatePiPayment\(payment, intent, user\)/);
  assert.match(approve, /pi_payment_id && intent\.pi_payment_id !== body\.paymentId/);
  assert.match(approve, /UPDATE payment_intents SET pi_payment_id=.*status='approved'/);

  const complete = worker.slice(completeStart, worker.indexOf("path === '/api/sync/", completeStart));
  assert.match(complete, /paymentId, txid and paymentIntentId are required/);
  assert.match(complete, /payment_intents WHERE id=\?1 AND user_id=\?2/);
  assert.match(complete, /validatePiPayment\(payment, \{ \.\.\.intent, pi_payment_id: body\.paymentId \}, user\)/);
  assert.match(complete, /method: 'POST'/);
  assert.match(complete, /txid: body\.txid/);
  assert.match(complete, /status='completed'/);
  assert.match(complete, /idempotent: true/);
});

test('rental overlap remains an authoritative D1 gate before persistence', () => {
  const start = worker.indexOf("path === '/api/rentals'");
  const end = worker.indexOf("path === '/api/payments/intent'", start);
  const block = worker.slice(start, end);

  const overlapAt = block.indexOf('SELECT 1 FROM rentals');
  const insertAt = block.indexOf('INSERT INTO rentals');
  assert.ok(overlapAt >= 0 && insertAt > overlapAt, 'overlap query must run before rental insert');
  assert.match(block, /status IN \('pending_payment', 'paid', 'confirmed', 'active'\)/);
  assert.match(block, /julianday\(end_date\) > julianday\(\?2\)/);
  assert.match(block, /julianday\(start_date\) < julianday\(\?3\)/);
  assert.match(block, /return errorResponse\('این کالا برای تاریخ‌های انتخابی در دسترس نیست یا قبلاً رزرو شده است\.', 409/);
});
