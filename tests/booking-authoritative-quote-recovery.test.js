import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/BookingModal.jsx', import.meta.url), 'utf8');

test('BookingModal does not fall back to client pricing when the server quote is unavailable', () => {
  assert.match(source, /const pricingReady = Boolean\(serverQuote\?\.quoteId\);/);
  assert.match(source, /const dailyPrice = serverQuote\?\.pricePerDay \?\? null;/);
  assert.match(source, /const rentalTotal = serverQuote\?\.baseRentalAmount \?\? null;/);
  assert.doesNotMatch(source, /const fallbackPricing = calculatePricing\(/);
});

test('BookingModal requires the authoritative quote before creating a rental', () => {
  assert.match(source, /if \(!pricingReady\) \{/);
  assert.match(source, /persistedRental = await cloudSyncService\.createRental\(\{ quoteId: serverQuote\.quoteId \}\);/);
  assert.doesNotMatch(source, /createRental\(\{\s*listingId: item\.id,\s*startDate: dates\.startDate,\s*endDate: dates\.endDate/);
});

test('BookingModal exposes quote failure and a real retry path', () => {
  assert.match(source, /const \[quoteError, setQuoteError\] = useState\(''\);/);
  assert.match(source, /setQuoteError\(err\?\.message \|\| l\(/);
  assert.match(source, /onClick=\{\(\) => setQuoteRetryNonce\(v => v \+ 1\)\}/);
  assert.match(source, /disabled=\{isSubmitting \|\| isLoadingQuote \|\| !pricingReady\}/);
});
