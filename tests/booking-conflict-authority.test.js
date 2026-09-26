import fs from 'fs';
import assert from 'assert';

const modal = fs.readFileSync('src/components/BookingModal.jsx', 'utf8');
const service = fs.readFileSync('src/services/cloudSyncService.js', 'utf8');

assert(!modal.includes('broadcastNewRental(draftRental)'), 'Booking must not bypass authoritative rental creation with a local fallback');
assert(modal.includes("createErr?.status === 409"), 'Booking should recognize authoritative conflict responses');
assert(modal.includes('These dates are no longer available for this listing.'), 'Booking conflict should have clear English UI copy');
assert(service.includes('err.status = res.status'), 'Rental API errors should preserve HTTP status for UI handling');
