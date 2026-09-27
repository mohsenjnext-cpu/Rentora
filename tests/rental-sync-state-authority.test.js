import fs from 'fs';
import assert from 'assert';

const worker = fs.readFileSync('_worker.js', 'utf8');
const start = worker.indexOf("path === '/api/sync/rental'");
assert.ok(start >= 0, 'rental sync route must exist');
const block = worker.slice(start, start + 6500);

assert.ok(block.includes("existing.status !== 'pending_payment' || existing.payment_status !== 'unpaid'"),
  'settled rentals must not be mutated by sync');
assert.ok(block.includes("authoritative: true"),
  'settled rental sync should return the authoritative server rental');
assert.ok(block.includes("WHERE id=?9 AND status='pending_payment' AND payment_status='unpaid'"),
  'mutable rental updates must be limited to unpaid pending rentals');
assert.ok(block.includes("existing.listing_id !== listing.id"),
  'rental sync must reject listing identity changes');

console.log('Rental sync state authority checks passed.');
