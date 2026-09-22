import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(new URL('../db/migrations/0010_payout_operations.sql', import.meta.url), 'utf8');
const gateways = [
  fs.readFileSync(new URL('../worker-gateway2.js', import.meta.url), 'utf8'),
  fs.readFileSync(new URL('../workers/worker-gateway2.js', import.meta.url), 'utf8')
];

test('payout operation schema is durable, unique, and stateful', () => {
  assert.match(migration, /operation_key TEXT NOT NULL UNIQUE/);
  assert.match(migration, /pi_payment_id TEXT UNIQUE/);
  assert.match(migration, /reservation_expires_at TEXT/);
  assert.match(migration, /idx_payout_operations_payment_id/);
  assert.match(migration, /payout_operations_transition_guard/);
  for (const state of ['reserved', 'creating', 'pi_created', 'approving', 'approved', 'completing', 'completed', 'cancelled', 'reconciliation_required']) {
    assert.match(migration, new RegExp(`['"]${state}['"]`));
  }
});

test('both gateways reserve before Pi API work and resume by operation key', () => {
  for (const source of gateways) {
    assert.match(source, /function payoutIdempotencyKey\(/);
    assert.match(source, /INSERT INTO payout_operations[\s\S]*SELECT[\s\S]*ON CONFLICT\(operation_key\) DO NOTHING/);
    assert.match(source, /resumePayoutOperation\(env, claim\.operation\)/);
    assert.match(source, /operationKey, adminUid/);
    assert.match(source, /PAYOUT_STALE_MS/);
  }
});

test('payout transitions are persisted at each external boundary', () => {
  for (const source of gateways) {
    assert.match(source, /'reserved'\], 'creating'/);
    assert.match(source, /'creating'\], 'pi_created'/);
    assert.match(source, /'pi_created'\], 'approving'/);
    assert.match(source, /'approving'\], 'approved'/);
    assert.match(source, /'approved', 'reconciliation_required'\], 'completing'/);
    assert.match(source, /status='completed'/);
  }
});

test('transaction settlement is conflict-safe', () => {
  for (const source of gateways) {
    assert.match(source, /SELECT \* FROM transactions WHERE pi_payment_id=\?1 OR pi_txid=\?2/);
    assert.match(source, /INSERT OR IGNORE INTO transactions/);
    assert.match(source, /already linked to a conflicting transaction/);
  }
});
