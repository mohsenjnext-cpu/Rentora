import test from 'node:test';
import assert from 'node:assert/strict';

const ACTIVE_RENTAL_STATUSES = new Set(['draft', 'pending_payment', 'payment_approved', 'confirmed', 'active', 'requested', 'accepted']);

function countActiveRentals(rentals) {
  return (rentals || []).filter((r) => ACTIVE_RENTAL_STATUSES.has(String(r?.status || '').toLowerCase())).length;
}

test('BottomNav activity badge includes every non-terminal rental state', () => {
  const statuses = ['draft', 'pending_payment', 'payment_approved', 'confirmed', 'active', 'requested', 'accepted'];
  assert.equal(countActiveRentals(statuses.map((status, index) => ({ id: String(index), status }))), statuses.length);
});

test('BottomNav activity badge excludes terminal and unknown rental states', () => {
  assert.equal(countActiveRentals([
    { status: 'completed' },
    { status: 'cancelled' },
    { status: 'rejected' },
    { status: 'disputed' },
    { status: 'awaiting_payment' },
    { status: 'UNKNOWN' },
    { status: null },
    {}
  ]), 0);
});

test('BottomNav activity badge normalizes status casing', () => {
  assert.equal(countActiveRentals([{ status: 'ACTIVE' }, { status: 'Pending_Payment' }]), 2);
});
