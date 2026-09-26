import fs from 'fs';
import assert from 'assert';

const item = fs.readFileSync('src/pages/ItemDetailPage.jsx', 'utf8');

assert(item.includes("['paused', 'deleted', 'expired', 'unavailable', 'inactive']"), 'Item Detail should recognize non-bookable listing states');
assert(item.includes('item.expiresAt'), 'Item Detail should recognize expired listings');
assert(item.includes('disabled={isOwner || isUnavailable}'), 'Booking should be disabled when the listing is unavailable');
assert(item.includes('!isUnavailable && onOpenChat'), 'Chat should not be offered for unavailable listings');
assert(item.includes('This listing is currently unavailable for booking.'), 'Unavailable state should have accessible English copy');
