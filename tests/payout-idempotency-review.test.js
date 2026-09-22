import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(new URL('../db/migrations/0010_payout_operations.sql', import.meta.url), 'utf8');
const gateways = [
  fs.readFileSync(new URL('../worker-gateway2.js', import.meta.url), 'utf8'),
  fs.readFileSync(new URL('../workers/worker-gateway2.js', import.meta.url), 'utf8')
];

test('payout operation schema is unique and stateful', () => {
  assert.match(migration, /operation_key TEXT NOT NULL UNIQUE/);
  assert.match(migration, /status TEXT NOT NULL CHECK/);
  assert.match(migration, /idx_payout_operations_payment_id/);
});

test('both gateways claim idempotency before Pi API work', () => {
  for (const source of gateways) {
    assert.match(source, /function payoutIdempotencyKey\(/);
    assert.match(source, /ON CONFLICT\(operation_key\) DO NOTHING/);
    assert.match(source, /return payoutOperationResponse\(operationClaim\.operation/);
    const route = source.slice(source.indexOf("path === '/api/admin/payout'"));
    assert.ok(route.indexOf('claimPayoutOperation(env, operationKey') < route.indexOf('autoResolveIncompleteServerPayments(env, user)'));
  }
});

test('payout transitions are persisted and payment settlement is unique', () => {
  for (const source of gateways) {
    assert.match(source, /UPDATE payout_operations SET status=/);
    assert.match(source, /updatePayoutOperation\(env, operationKey, 'pending'/);
    assert.match(source, /updatePayoutOperation\(env, operationKey, 'completed'/);
    assert.match(source, /ON CONFLICT\(pi_payment_id\) DO NOTHING/);
  }
});
