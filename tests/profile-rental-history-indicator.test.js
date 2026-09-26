import test from 'node:test';
import assert from 'node:assert/strict';

const HISTORY_STATUSES = new Set(['completed', 'cancelled', 'rejected', 'disputed']);
const ACTIVE_STATUSES = new Set(['draft', 'pending_payment', 'payment_approved', 'confirmed', 'active', 'requested', 'accepted']);

function countRentalIndicators(rentals) {
  const list = rentals || [];
  return {
    total: list.length,
    active: list.filter((r) => ACTIVE_STATUSES.has(String(r.status || '').toLowerCase())).length,
    history: list.filter((r) => HISTORY_STATUSES.has(String(r.status || '').toLowerCase())).length
  };
}

test('Profile rental history indicator counts completed and terminal rentals separately from active rentals', () => {
  const result = countRentalIndicators([
    { id: 'r1', status: 'active' },
    { id: 'r2', status: 'confirmed' },
    { id: 'r3', status: 'completed' },
    { id: 'r4', status: 'cancelled' },
    { id: 'r5', status: 'disputed' },
    { id: 'r6', status: 'rejected' }
  ]);

  assert.deepEqual(result, { total: 6, active: 2, history: 4 });
});

test('Profile rental history indicator is resilient to missing status and empty rental data', () => {
  assert.deepEqual(countRentalIndicators(), { total: 0, active: 0, history: 0 });
  assert.deepEqual(countRentalIndicators([{ id: 'r1' }, { id: 'r2', status: 'COMPLETED' }]), {
    total: 2,
    active: 0,
    history: 1
  });
});
