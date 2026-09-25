import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const piAuthContext = fs.readFileSync(new URL('../src/context/PiAuthContext.jsx', import.meta.url), 'utf8');
const activationMigration = fs.readFileSync(new URL('../db/migrations/0013_owner_fee_activation_cycle.sql', import.meta.url), 'utf8');

function section(start, end) {
  const from = worker.indexOf(start);
  assert.notEqual(from, -1, `missing section: ${start}`);
  const to = end ? worker.indexOf(end, from) : worker.length;
  return worker.slice(from, to === -1 ? worker.length : to);
}

test('payment intent amount is server-owned and obligation-bound', () => {
  const intent = section("path === '/api/payments/intent'", "path === '/api/payments/approve'");
  assert.match(intent, /payment_obligations/);
  assert.match(intent, /obligation\.amount/);
  assert.doesNotMatch(intent, /body\.amount/);
  assert.match(intent, /body\?\.paymentIntentId/);
});

test('payment approval route requires an authenticated, obligation-bound payment', () => {
  const approve = section("path === '/api/payments/approve'", "path === '/api/payments/complete'");
  assert.match(approve, /requireUser\(request, env\)/);
  assert.match(approve, /payment_obligations WHERE id=\?1 AND user_id=\?2/);
  assert.match(approve, /body\.paymentIntentId/);
  assert.match(approve, /validatePiPayment\(payment, obligation, user\)/);
  assert.match(worker, /const payerUid = payment\?\.user\?\.uid \|\| payment\?\.from_address\?\.uid/);
  assert.match(worker, /Pi payer mismatch/);
  assert.match(worker, /paymentMeta\.paymentIntentId/);
  assert.match(worker, /Pi payment metadata obligation binding is invalid/);
});

test('payment approval uses an atomic D1 claim for the Pi payment ID', () => {
  const approve = section("path === '/api/payments/approve'", "path === '/api/payments/complete'");
  assert.match(approve, /status='created' AND pi_payment_id IS NULL/);
  assert.match(approve, /claim\?\.meta\?\.changes/);
  assert.match(approve, /concurrently claimed by another payment/);
});

test('payment completion requires an approved obligation and strict Pi binding', () => {
  const complete = section("path === '/api/payments/complete'", "path === '/api/payments/incomplete'");
  assert.match(complete, /obligation\.pi_payment_id && obligation\.pi_payment_id !== body\.paymentId/);
  assert.match(complete, /\['approved','completed'\]\.includes/);
  assert.match(worker, /Pi payment identifier mismatch/);
  assert.match(worker, /Pi payment amount mismatch/);
  assert.match(worker, /Pi payment memo mismatch/);
  assert.match(worker, /Pi payment metadata obligation binding is invalid/);
  assert.match(complete, /\['approved','completed','complete'\]/);
});

test('payment completion reconciles the authoritative Pi transaction hash', () => {
  const complete = section("path === '/api/payments/complete'", "path === '/api/payments/incomplete'");
  assert.match(complete, /verifiedPayment\?\.transaction\?\.txid/);
  assert.match(complete, /const actualTxid/);
  assert.match(complete, /Pi transaction hash mismatch/);
  assert.match(complete, /UPDATE payment_obligations SET pi_payment_id=\?1, pi_txid=\?2, status='completed'/);
  assert.match(complete, /INSERT OR IGNORE INTO transactions/);
});

test('owner completion activates the listing only after owner fee completion', () => {
  const complete = section("path === '/api/payments/complete'", "path === '/api/payments/incomplete'");
  assert.match(complete, /owner_fee_payment_status='completed'/);
  assert.match(complete, /status='active'/);
  assert.match(complete, /activated_at/);
});

test('renter completion requires owner activation fee completion', () => {
  const complete = section("path === '/api/payments/complete'", "path === '/api/payments/incomplete'");
  assert.match(complete, /Owner activation fee is not completed/);
  assert.match(complete, /renter_fee_payment_status='completed'/);
});

test('server logout revokes the KV session', () => {
  const logout = section("path === '/api/auth/logout'", "path === '/api/payments/intent'");
  assert.match(logout, /RENTORA_KV\.delete/);
  assert.match(logout, /session:/);
});

test('worker has no marketplace memory fallback', () => {
  assert.doesNotMatch(worker, /globalThis\.__RENTORA_STATE/);
  assert.doesNotMatch(worker, /let\s+marketplaceState/);
  assert.match(worker, /requireBindings\(env\)/);
});

test('CORS preflight allows the session bridge client header', () => {
  assert.match(worker, /Access-Control-Allow-Headers.*X-Rentora-Client/);
});

test('frontend auth bridge uses HttpOnly cookie sessions instead of browser-stored bearer tokens', () => {
  assert.doesNotMatch(piAuthContext, /localStorage\.getItem\(STORAGE_KEY_USER\)/);
  assert.doesNotMatch(piAuthContext, /session\.sessionToken/);
  assert.doesNotMatch(piAuthContext, /headers\.set\('Authorization'/);
  assert.match(piAuthContext, /credentials: init\.credentials \|\| 'include'/);
  assert.match(piAuthContext, /headers\.set\('X-Rentora-Client', 'web'\)/);
  assert.match(piAuthContext, /localStorage\.removeItem\('rentora_live_v1_session'\)/);
});

test('owner activation obligations are bound to an activation cycle in D1', () => {
  assert.match(worker, /payment_obligations\(id,rental_id,listing_id,user_id,role,purpose,amount,currency,status,memo,metadata,activation_cycle,expires_at,created_at,updated_at\)/);
  assert.match(worker, /activationCycle: cycle/);
  assert.match(worker, /activation_cycle=\?3/);
  assert.match(activationMigration, /ALTER TABLE payment_obligations ADD COLUMN activation_cycle TEXT NOT NULL DEFAULT 'initial'/);
  assert.match(activationMigration, /DROP INDEX IF EXISTS uq_payment_obligations_listing_role_purpose/);
  assert.match(activationMigration, /uq_payment_obligations_listing_role_purpose_cycle/);
});
