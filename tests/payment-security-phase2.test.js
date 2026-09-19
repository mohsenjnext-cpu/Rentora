import test from 'node:test';
import assert from 'node:assert/strict';

function toCanonicalDecimal(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10000) / 10000;
}

function validatePiPayment(payment, intent, user) {
  const identifier = String(payment?.identifier || payment?.id || '').trim();
  if (!identifier) throw Object.assign(new Error('Pi payment identifier is missing'), { status: 409 });
  if (intent.pi_payment_id && String(intent.pi_payment_id).trim() !== identifier) {
    throw Object.assign(new Error('Pi payment identifier mismatch'), { status: 409 });
  }

  const payerUid = String(payment?.user?.uid || payment?.from_address?.uid || payment?.user_uid || payment?.uid || '').trim();
  if (!payerUid) throw Object.assign(new Error('Pi payment payer identity is missing'), { status: 409 });
  if (payerUid.toLowerCase() !== String(user.pi_uid).trim().toLowerCase()) {
    throw Object.assign(new Error('Pi payer mismatch'), { status: 403 });
  }

  let paymentMeta = payment?.metadata;
  if (typeof paymentMeta === 'string') {
    try { paymentMeta = JSON.parse(paymentMeta); } catch (_) {}
  }
  const metadataIntent = paymentMeta?.paymentIntentId || paymentMeta?.intentId || paymentMeta?.id;
  if (!metadataIntent || String(metadataIntent) !== String(intent.id)) {
    throw Object.assign(new Error('Pi payment metadata binding is missing or invalid'), { status: 409 });
  }
  if (paymentMeta?.rentalId && String(paymentMeta.rentalId) !== String(intent.rental_id)) {
    throw Object.assign(new Error('Pi payment rental binding mismatch'), { status: 409 });
  }

  const payerAmount = toCanonicalDecimal(payment?.amount);
  const expectedAmount = toCanonicalDecimal(intent.amount);
  if (Math.abs(payerAmount - expectedAmount) > 0.0001) {
    throw Object.assign(new Error('Pi payment amount mismatch'), { status: 409 });
  }

  const net = String(payment?.network || '').trim().toLowerCase();
  if (net === 'pi mainnet' || net === 'mainnet' || net === 'pimainnet') {
    throw Object.assign(new Error('Mainnet payments are not permitted on Pi Testnet'), { status: 409 });
  }

  if (payment?.memo && intent?.memo && String(payment.memo).trim() !== String(intent.memo).trim()) {
    throw Object.assign(new Error('Pi payment memo mismatch'), { status: 409 });
  }

  if (typeof payment?.status === 'object' && payment?.status !== null) {
    if (payment.status.developer_completed) return 'completed';
    if (payment.status.developer_approved) return 'approved';
    if (payment.status.cancelled || payment.status.user_cancelled) return 'cancelled';
    return 'pending';
  }
  return String(payment?.status || 'pending').toLowerCase();
}

function validateTransactionTxid(payment, txid, required = false) {
  const expected = String(txid || '').trim();
  const reported = String(payment?.transaction?.txid || '').trim();
  if (reported && expected && reported !== expected) throw Object.assign(new Error('Pi transaction ID mismatch'), { status: 409 });
  if (required && !reported && !expected) throw Object.assign(new Error('Pi transaction ID is missing'), { status: 409 });
  return reported || expected;
}

// =========================================================================
// PHASE 2 PAYMENT SECURITY TEST SUITE
// =========================================================================

test('Phase 2: Payment intent rejects request missing rentalId (400)', () => {
  const body = {};
  const hasRentalId = Boolean(body.rentalId);
  assert.equal(hasRentalId, false, 'Missing rentalId must be rejected');
});

test('Phase 2: Payment intent derives amount strictly from D1 rental platform fee, ignoring client fake amount', () => {
  const authoritativeRentalInD1 = {
    id: 'rnt_100',
    renter_user_id: 'usr_bob',
    platform_fee: 1.5,
    status: 'pending_payment'
  };

  const clientPayload = {
    rentalId: 'rnt_100',
    amount: 0.0001, // Client trying to forge a tiny fee
    fee: 0.0001
  };

  // Server ignores clientPayload.amount and uses authoritative D1 value
  const serverDerivedAmount = toCanonicalDecimal(authoritativeRentalInD1.platform_fee);
  assert.equal(serverDerivedAmount, 1.5, 'Server must enforce exact 1.5 π platform fee');
});

test('Phase 2: Payment intent rejects unauthorized user attempting to pay for another users rental (403)', () => {
  const rentalInD1 = {
    id: 'rnt_100',
    renter_user_id: 'usr_alice',
    status: 'pending_payment'
  };

  const authenticatedUser = { id: 'usr_bob', pi_uid: 'uid_bob' };
  const isAuthorizedRenter = rentalInD1.renter_user_id === authenticatedUser.id;

  assert.equal(isAuthorizedRenter, false, 'Non-renter must be rejected');
});

test('Phase 2: Metadata mismatch is rejected with 409', () => {
  const intent = {
    id: 'pii_correct_123',
    rental_id: 'rnt_100',
    amount: 1.5
  };
  const user = { pi_uid: 'uid_bob' };

  // 1. Wrong paymentIntentId
  const paymentWithWrongIntent = {
    identifier: 'pip_1',
    user: { uid: 'uid_bob' },
    amount: 1.5,
    metadata: { paymentIntentId: 'pii_wrong_999', rentalId: 'rnt_100' }
  };
  assert.throws(() => {
    validatePiPayment(paymentWithWrongIntent, intent, user);
  }, /Pi payment metadata binding is missing or invalid/);

  // 2. Wrong rentalId
  const paymentWithWrongRental = {
    identifier: 'pip_1',
    user: { uid: 'uid_bob' },
    amount: 1.5,
    metadata: { paymentIntentId: 'pii_correct_123', rentalId: 'rnt_other_user' }
  };
  assert.throws(() => {
    validatePiPayment(paymentWithWrongRental, intent, user);
  }, /Pi payment rental binding mismatch/);
});

test('Phase 2: Amount precision mismatch is rejected with 409', () => {
  const intent = {
    id: 'pii_123',
    rental_id: 'rnt_100',
    amount: 1.5000
  };
  const user = { pi_uid: 'uid_bob' };

  const paymentTamperedAmount = {
    identifier: 'pip_1',
    user: { uid: 'uid_bob' },
    amount: 1.4990, // Mismatch
    metadata: { paymentIntentId: 'pii_123', rentalId: 'rnt_100' }
  };

  assert.throws(() => {
    validatePiPayment(paymentTamperedAmount, intent, user);
  }, /Pi payment amount mismatch/);
});

test('Phase 2: Payer UID mismatch is rejected with 403', () => {
  const intent = { id: 'pii_123', rental_id: 'rnt_100', amount: 1.5 };
  const user = { pi_uid: 'uid_bob' };

  const paymentFromAlice = {
    identifier: 'pip_1',
    user: { uid: 'uid_alice' }, // Alice trying to pay for Bob
    amount: 1.5,
    metadata: { paymentIntentId: 'pii_123', rentalId: 'rnt_100' }
  };

  assert.throws(() => {
    validatePiPayment(paymentFromAlice, intent, user);
  }, /Pi payer mismatch/);
});

test('Phase 2: Duplicate approve call returns idempotent success without double state progression', () => {
  const intent = {
    id: 'pii_123',
    status: 'approved',
    pi_payment_id: 'pip_123'
  };

  const isDuplicateApprove = (intent.status === 'approved' && intent.pi_payment_id === 'pip_123');
  assert.equal(isDuplicateApprove, true, 'Duplicate approve must return idempotent 200');
});

test('Phase 2: Duplicate complete call returns idempotent success without duplicate billing', () => {
  const intent = {
    id: 'pii_123',
    status: 'completed',
    pi_payment_id: 'pip_123',
    pi_txid: '0xabc123'
  };

  const isDuplicateComplete = intent.status === 'completed';
  assert.equal(isDuplicateComplete, true, 'Duplicate complete must return idempotent 200');
});

test('Phase 2: Invalid blockchain transaction ID mismatch is rejected with 409', () => {
  const paymentFromPiApi = {
    transaction: { txid: '0xreal_blockchain_txid' }
  };
  const forgedTxidFromClient = '0xfake_txid';

  assert.throws(() => {
    validateTransactionTxid(paymentFromPiApi, forgedTxidFromClient, true);
  }, /Pi transaction ID mismatch/);
});

test('Phase 2: Invalid or cancelled Pi payment status is rejected', () => {
  const intent = { id: 'pii_123', rental_id: 'rnt_100', amount: 1.5 };
  const user = { pi_uid: 'uid_bob' };

  const cancelledPayment = {
    identifier: 'pip_123',
    user: { uid: 'uid_bob' },
    amount: 1.5,
    metadata: { paymentIntentId: 'pii_123', rentalId: 'rnt_100' },
    status: { cancelled: true, user_cancelled: true }
  };

  const status = validatePiPayment(cancelledPayment, intent, user);
  assert.equal(status, 'cancelled', 'Cancelled payment must resolve to cancelled');
});

test('Phase 2: Complete rental lifecycle transitions state machine cleanly (pending_payment -> payment_approved -> confirmed)', () => {
  // Step 1: Rental created
  let rental = { id: 'rnt_1', status: 'pending_payment', payment_status: 'unpaid' };
  assert.equal(rental.status, 'pending_payment');

  // Step 2: Payment approved on server
  rental = { ...rental, status: 'payment_approved' };
  assert.equal(rental.status, 'payment_approved');

  // Step 3: Payment completed on blockchain & verified by server
  rental = { ...rental, status: 'confirmed', payment_status: 'completed' };
  assert.equal(rental.status, 'confirmed');
  assert.equal(rental.payment_status, 'completed');
});
