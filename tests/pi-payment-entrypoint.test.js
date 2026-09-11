import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const entrypoint = fs.readFileSync(new URL('../worker-entry.js', import.meta.url), 'utf8');

test('payment validation uses the official Pi PaymentDTO identity field', () => {
  assert.match(entrypoint, /payment\?\.user_uid/);
  assert.doesNotMatch(entrypoint, /payment\?\.user\?\.uid/);
});

test('payment validation reads Pi status flags as an object', () => {
  assert.match(entrypoint, /status\.developer_approved/);
  assert.match(entrypoint, /status\.developer_completed/);
  assert.match(entrypoint, /status\.cancelled/);
  assert.match(entrypoint, /status\.user_cancelled/);
});

test('payment completion requires Pi server confirmation before local settlement', () => {
  assert.match(entrypoint, /completionResponse\.ok/);
  assert.match(entrypoint, /completion\?\.status\?\.developer_completed/);
  assert.match(entrypoint, /UPDATE payment_intents SET pi_payment_id=.*status='completed'/);
});

test('payment completion verifies the blockchain transaction identifier when Pi already reports completion', () => {
  assert.match(entrypoint, /payment\?\.transaction\?\.txid/);
  assert.match(entrypoint, /Pi transaction ID mismatch/);
});

test('Pi Testnet payments are enforced at the server boundary', () => {
  assert.match(entrypoint, /payment\?\.network/);
  assert.match(entrypoint, /Pi Testnet/);
});
