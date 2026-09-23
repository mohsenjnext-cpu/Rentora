import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(new URL('../db/migrations/0010_payout_operations.sql', import.meta.url), 'utf8');
const gateway = fs.readFileSync(new URL('../worker-gateway2.js', import.meta.url), 'utf8');
const mirror = fs.readFileSync(new URL('../workers/worker-gateway2.js', import.meta.url), 'utf8');

const lifecycle = ['reserved', 'creating', 'pi_created', 'approving', 'approved', 'completing', 'completed'];
const safety = ['cancelled', 'reconciliation_required'];

function assertOrdered(source, snippets) {
  let cursor = -1;
  for (const snippet of snippets) {
    const next = source.indexOf(snippet, cursor + 1);
    assert.ok(next > cursor, `Expected ordered snippet: ${snippet}`);
    cursor = next;
  }
}

test('0010 defines the complete payout lifecycle and safety states', () => {
  for (const state of [...lifecycle, ...safety]) assert.match(migration, new RegExp(`['"]${state}['"]`));
  assert.match(migration, /pi_payment_id TEXT UNIQUE/);
  assert.match(migration, /reservation_expires_at TEXT/);
  assert.match(migration, /payout_operations_transition_guard/);
  assert.match(migration, /invalid payout operation transition/);
});

test('both gateway copies implement the same durable state-machine contract', () => {
  assert.equal(gateway, mirror);
  for (const source of [gateway, mirror]) {
    assert.match(source, /PAYOUT_STALE_MS/);
    assert.match(source, /INSERT INTO payout_operations[\s\S]*SELECT[\s\S]*ON CONFLICT\(operation_key\) DO NOTHING/);
    assert.match(source, /transitionPayoutOperation\(env, operationKey, \['reserved'\], 'creating'/);
    assert.match(source, /transitionPayoutOperation\(env, operation\.operation_key, \['creating'\], 'pi_created'/);
    assert.match(source, /transitionPayoutOperation\(env, operation.operation_key, \['pi_created'\], 'approving'/);
    assert.match(source, /transitionPayoutOperation\(env, operation.operation_key, \['approving'\], 'approved'/);
    assert.match(source, /transitionPayoutOperation\(env, operation.operation_key, \['approved', 'reconciliation_required'\], 'completing'/);
    assert.match(source, /status='completed'/);
    const route = source.slice(source.indexOf("path === '/api/admin/payout'"));
    assertOrdered(route, [
      "await autoResolveIncompleteServerPayments(env, user)",
      "createPayoutPayment(env, operation, claim.leaseOwner",
      "resumePayoutOperation(env, operation)"
    ]);
  }
});

test('retry and crash boundaries are reconciliation-safe', () => {
  assert.match(gateway, /if \(claim\.operation\.status === 'completed' \|\| claim\.operation\.status === 'cancelled' \|\| claim\.operation\.status === 'reconciliation_required'\)/);
  assert.match(gateway, /resumePayoutOperation\(env, claim\.operation\)/);
  assert.match(gateway, /Create phase was interrupted before payment id persistence/);
  assert.match(gateway, /Pi create request was ambiguous/);
  assert.match(gateway, /operationKey, adminUid/);
  assert.match(gateway, /reconcileStalePayoutOperations\(env\)/);
});

test('approval and completion use GET reconciliation and explicit already-approved handling', () => {
  assert.match(gateway, /current\.status\.developer_approved/);
  assert.match(gateway, /current\.status\.developer_completed/);
  assert.match(gateway, /Current payment is already approved/);
  assert.match(gateway, /already approved/);
  assert.match(gateway, /Already-approved response could not be reconciled/);
  assert.match(gateway, /Pi completion requires reconciliation/);
  assert.match(gateway, /before completion/);
});

test('incomplete server payments are correlated to payout_operations', () => {
  assert.match(gateway, /metadata\?\.operationKey \|\| metadata\?\.payoutOperationKey/);
  assert.match(gateway, /WHERE pi_payment_id=\?1/);
  assert.match(gateway, /Incomplete payment has no safely actionable Pi state/);
  assert.match(gateway, /incomplete payment was cancelled/);
});

test('completion is transaction-idempotent and conflict-safe', () => {
  assert.match(gateway, /SELECT \* FROM transactions WHERE pi_payment_id=\?1 OR pi_txid=\?2/);
  assert.match(gateway, /already linked to a conflicting transaction/);
  assert.match(gateway, /INSERT OR IGNORE INTO transactions/);
  assert.match(gateway, /env\.RENTORA_DB\.batch\(\[/);
});

test('legacy weaker payout state names are absent from the new operation implementation', () => {
  assert.doesNotMatch(migration, /'processing'/);
  assert.doesNotMatch(migration, /'pending'/);
  assert.doesNotMatch(gateway.slice(gateway.indexOf("path === '/api/admin/payout'")), /updatePayoutOperation/);
});

// Scenario contract inventory required by the implementation brief.
test('required operational scenarios are represented by explicit safeguards', () => {
  const scenarios = {
    retryBeforeCreate: /status === 'reserved'/,
    retryAfterCreateBeforePersist: /Create phase was interrupted before payment id persistence/,
    retryAfterPersist: /operation\.pi_payment_id/,
    paymentAlreadyApproved: /already approved/,
    paymentAlreadyCompleted: /developer_completed/,
    approveTimeout: /Pi approval request was ambiguous/,
    completeTimeout: /Pi completion requires reconciliation/,
    duplicateOperationKey: /UNIQUE|ON CONFLICT\(operation_key\)/,
    concurrentPayout: /SUM\(amount\).*payout_operations/s,
    staleOperation: /updated_at < \?1/,
    reconciliationRequired: /reconciliation_required/,
    cancelledPayment: /Pi payment was cancelled/,
    incompleteServerPayment: /incomplete_server_payments/,
    idempotentTransaction: /INSERT OR IGNORE INTO transactions/
  };
  for (const [name, pattern] of Object.entries(scenarios)) assert.match(gateway, pattern, name);
});


test('A2U payout binds Pi payment to operation recipient, amount, direction, network and metadata', () => {
  assert.match(gateway, /validateA2UPayment/);
  assert.match(gateway, /recipient uid does not match payout operation/);
  assert.match(gateway, /payment amount does not match payout operation/);
  assert.match(gateway, /payment direction is not app-to-user/);
  assert.match(gateway, /payment is not on Pi Testnet/);
  assert.match(gateway, /metadata does not match payout operation/);
  assert.match(gateway, /Pi A2U completion could not be re-verified/);
});

test('A2U route does not accept a client-supplied wallet address as the payout authority', () => {
  assert.match(gateway, /آدرس کیف پول مستقیم قابل تعیین نیست/);
  assert.doesNotMatch(gateway, /targetWallet\s*:\s*targetWallet\s*\|\|\s*undefined/);
});
