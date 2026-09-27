import fs from 'fs';
import assert from 'assert';

const booking = fs.readFileSync('src/components/BookingModal.jsx', 'utf8');

assert.doesNotMatch(booking, /images\.unsplash\.com/, 'booking must not use an external mock image fallback');
assert.match(booking, /createRentalQuote\(\{/, 'booking must request a server-authoritative quote');
assert.match(booking, /createRental\(\{ quoteId: serverQuote\.quoteId \}\)/, 'booking must create rentals from the authoritative quote');
assert.match(booking, /role="status" aria-live="polite"/, 'booking must expose quote loading state');
assert.match(booking, /role="alert" aria-live="assertive"/, 'booking must expose recoverable quote errors');
assert.match(booking, /setQuoteRetryNonce\(v => v \+ 1\)/, 'booking quote failure must expose a retry action');
assert.match(booking, /status === 409/, 'booking must surface authoritative overlap conflicts');
assert.match(booking, /executePiPaymentForRental\(persistedRental\.id, persistedRental\)/, 'booking must pass the server-created rental into Pi payment flow');

console.log('Booking rental authority and recovery checks passed.');
