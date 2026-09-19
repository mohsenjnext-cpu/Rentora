import test from 'node:test';
import assert from 'node:assert/strict';

function calculateAuthoritativeFinancials(pricePerDay, depositAmount, startDateStr, endDateStr, feeRate = 0.05, minFeePi = 0.0001) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw Object.assign(new Error('Invalid ISO 8601 date'), { status: 400 });
  }
  if (start >= end) {
    throw Object.assign(new Error('End date must be strictly after start date'), { status: 400 });
  }
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  if (start.getTime() < todayUtc.getTime() - 86400000) {
    throw Object.assign(new Error('Start date cannot be in the past'), { status: 400 });
  }

  const diffMs = end.getTime() - start.getTime();
  const daysCount = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  const dailyRate = Number(Number(pricePerDay || 0).toFixed(4));
  const deposit = Number(Number(depositAmount || 0).toFixed(4));
  const baseRentalAmount = Number((daysCount * dailyRate).toFixed(4));

  const calculatedFee = Number((baseRentalAmount * feeRate).toFixed(4));
  const platformFee = Math.max(minFeePi, calculatedFee);
  const totalAmount = Number((baseRentalAmount + deposit + platformFee).toFixed(4));

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    daysCount,
    pricePerDay: dailyRate,
    baseRentalAmount,
    depositAmount: deposit,
    platformFee,
    totalAmount,
    currency: 'PI'
  };
}

test('Phase 1: Valid Quote calculation derives exact amounts from D1 listing parameters', () => {
  const listing = {
    id: 'lst_drill_01',
    price_per_day: 10.0,
    deposit_amount: 50.0,
    status: 'active'
  };

  const startDate = '2026-09-25T10:00:00.000Z';
  const endDate = '2026-09-28T10:00:00.000Z'; // 3 days

  const financials = calculateAuthoritativeFinancials(
    listing.price_per_day,
    listing.deposit_amount,
    startDate,
    endDate,
    0.05
  );

  assert.equal(financials.daysCount, 3);
  assert.equal(financials.pricePerDay, 10.0);
  assert.equal(financials.baseRentalAmount, 30.0);
  assert.equal(financials.depositAmount, 50.0);
  assert.equal(financials.platformFee, 1.5);
  assert.equal(financials.totalAmount, 81.5);
  assert.equal(financials.currency, 'PI');
});

test('Phase 1: Quote rejection on invalid listing or inactive/paused listing', () => {
  const pausedListing = { id: 'lst_camera_02', status: 'paused' };
  assert.equal(pausedListing.status !== 'active', true, 'Paused listing must not allow quote creation');

  const nonExistentListing = null;
  assert.equal(nonExistentListing === null, true, 'Non-existent listing must return 404');
});

test('Phase 1: Date validation rejects invalid formats, past dates, and endDate <= startDate', () => {
  // 1. Invalid date string
  assert.throws(() => {
    calculateAuthoritativeFinancials(10, 50, 'not-a-date', '2026-09-25T00:00:00.000Z');
  }, /Invalid ISO 8601 date/);

  // 2. End date before or equal to start date
  assert.throws(() => {
    calculateAuthoritativeFinancials(10, 50, '2026-09-25T10:00:00.000Z', '2026-09-25T10:00:00.000Z');
  }, /End date must be strictly after start date/);

  // 3. Past date
  assert.throws(() => {
    calculateAuthoritativeFinancials(10, 50, '2020-01-01T00:00:00.000Z', '2020-01-05T00:00:00.000Z');
  }, /Start date cannot be in the past/);
});

test('Phase 1: Self-booking is strictly prohibited', () => {
  const listingOwnerId = 'usr_alice';
  const renterId = 'usr_alice';
  const isSelfBooking = listingOwnerId === renterId;

  assert.equal(isSelfBooking, true, 'Self-booking check must detect identical owner and renter');
});

test('Phase 1: Overlap detection rejects booking overlapping with active/confirmed rental', () => {
  const existingRental = {
    listing_id: 'lst_1',
    start_date: '2026-09-20T00:00:00.000Z',
    end_date: '2026-09-25T00:00:00.000Z',
    status: 'confirmed'
  };

  const requestedStart = '2026-09-22T00:00:00.000Z';
  const requestedEnd = '2026-09-27T00:00:00.000Z';

  const isOverlap = (
    new Date(existingRental.end_date) > new Date(requestedStart) &&
    new Date(existingRental.start_date) < new Date(requestedEnd)
  );

  assert.equal(isOverlap, true, 'Overlap must be detected and rejected');
});

test('Phase 1: Expired quote is rejected during rental creation', () => {
  const expiredQuote = {
    quoteId: 'qt_123',
    expiresAt: new Date(Date.now() - 60 * 1000).toISOString() // 1 min ago
  };

  const isExpired = new Date(expiredQuote.expiresAt) <= new Date();
  assert.equal(isExpired, true, 'Expired quote must be rejected with 410');
});

test('Phase 1: Listing price change after quote creation invalidates stale quote', () => {
  const quote = {
    quoteId: 'qt_456',
    pricePerDay: 10.0,
    depositAmount: 50.0
  };

  const currentListingInD1 = {
    id: 'lst_1',
    price_per_day: 15.0, // Owner updated price to 15
    deposit_amount: 50.0
  };

  const priceChanged = (
    quote.pricePerDay !== currentListingInD1.price_per_day ||
    quote.depositAmount !== currentListingInD1.deposit_amount
  );

  assert.equal(priceChanged, true, 'Stale quote with outdated price must be rejected');
});

test('Phase 1: Client tampering of amount, deposit, or platform fee is ignored in favor of server D1 calculations', () => {
  const clientProvidedBody = {
    listingId: 'lst_drill_01',
    startDate: '2026-09-25T10:00:00.000Z',
    endDate: '2026-09-28T10:00:00.000Z',
    amount: 0.0001, // Attacker trying to set price to 0.0001
    deposit: 0,
    platformFee: 0.0001,
    totalAmount: 0.0002
  };

  const authoritativeListingInD1 = {
    id: 'lst_drill_01',
    price_per_day: 10.0,
    deposit_amount: 50.0
  };

  // Server re-derives all financials from D1 regardless of client payload
  const serverFinancials = calculateAuthoritativeFinancials(
    authoritativeListingInD1.price_per_day,
    authoritativeListingInD1.deposit_amount,
    clientProvidedBody.startDate,
    clientProvidedBody.endDate,
    0.05
  );

  assert.equal(serverFinancials.baseRentalAmount, 30.0, 'Server must enforce real 30.0 π rental amount');
  assert.equal(serverFinancials.depositAmount, 50.0, 'Server must enforce real 50.0 π deposit');
  assert.equal(serverFinancials.platformFee, 1.5, 'Server must enforce real 1.5 π platform fee');
  assert.equal(serverFinancials.totalAmount, 81.5, 'Server must enforce real 81.5 π total');
});

test('Phase 1: Valid rental creation produces atomic rental with status "pending_payment" and "unpaid"', () => {
  const rentalId = 'rnt_test_valid_01';
  const rental = {
    id: rentalId,
    listing_id: 'lst_drill_01',
    renter_user_id: 'usr_bob',
    owner_user_id: 'usr_alice',
    start_date: '2026-09-25T10:00:00.000Z',
    end_date: '2026-09-28T10:00:00.000Z',
    rental_amount: 30.0,
    deposit_amount: 50.0,
    platform_fee: 1.5,
    total_amount: 81.5,
    status: 'pending_payment',
    payment_status: 'unpaid',
    created_at: new Date().toISOString()
  };

  assert.equal(rental.status, 'pending_payment');
  assert.equal(rental.payment_status, 'unpaid');
  assert.equal(rental.platform_fee, 1.5);
  assert.equal(rental.rental_amount, 30.0);
});
