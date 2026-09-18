import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const entrypoint = fs.readFileSync(new URL('../worker-gateway2.js', import.meta.url), 'utf8');

test('gateway2 admin authorization is configuration-only and UID-bound', () => {
  assert.match(entrypoint, /function adminAllowed\(value, env\)/);
  assert.match(entrypoint, /ADMIN_PI_UIDS/);
  assert.match(entrypoint, /adminAllowed\(row\.pi_uid, env\)/);
  assert.doesNotMatch(entrypoint, /adminAllowed\(row\.username, env\)/);
  assert.doesNotMatch(entrypoint, /avina60|mohsenjnext|admin_user/);
});

test('gateway2 contains no legacy hardcoded admin identity guard', () => {
  assert.doesNotMatch(entrypoint, /function legacyAdminIdentity\(value\)/);
  assert.doesNotMatch(entrypoint, /guardLegacyAdminIdentity/);
  assert.doesNotMatch(entrypoint, /Legacy hardcoded admin identity is disabled/);
  assert.doesNotMatch(entrypoint, /avina60|mohsenjnext|admin_user/);
});

test('gateway2 binds completed Pi payment to the reported blockchain transaction ID', () => {
  assert.match(entrypoint, /payment\?\.transaction\?\.txid/);
  assert.match(entrypoint, /Pi transaction ID mismatch/);
  assert.match(entrypoint, /Pi transaction ID is missing/);
  assert.match(entrypoint, /validateTransactionTxid\(completion, body\.txid, true\)/);
});


test('gateway2 incomplete payment recovery is authenticated and metadata-bound', () => {
  assert.match(gatewaySource, /async function handleIncompletePayment/);
  assert.match(gatewaySource, /const user = await requireUser\(request, env\)/);
  assert.match(gatewaySource, /payment_intents WHERE id=\?1 AND user_id=\?2/);
  assert.match(gatewaySource, /admin_treasury_payout/);
  assert.match(gatewaySource, /metadata\?\.adminUid.*user\?\.pi_uid/);
  assert.doesNotMatch(gatewaySource, /UPDATE payment_intents SET status='completed'.*WHERE pi_payment_id=\?3/);
});

test('gateway2 CORS preflight fails closed when CORS_ORIGIN is empty', () => {
  assert.doesNotMatch(gatewaySource, /configured\.length === 0 \|\| configured\.includes\(origin\)/);
  assert.doesNotMatch(gatewaySource, /configured\.includes\('\*'\)/);
});
