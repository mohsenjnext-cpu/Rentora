import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const piAuthContext = fs.readFileSync(new URL('../src/context/PiAuthContext.jsx', import.meta.url), 'utf8');

function section(start, end) {
  const from = worker.indexOf(start);
  assert.notEqual(from, -1, `missing section: ${start}`);
  const to = end ? worker.indexOf(end, from) : worker.length;
  return worker.slice(from, to === -1 ? worker.length : to);
}

test('payment intent amount is server-owned', () => {
  const intent = section("path === '/api/payments/intent'", "path === '/api/payments/approve'");
  assert.match(intent, /SELECT r\.,?\s*\*?,?\s*l\.title/);
  assert.match(intent, /bind\(body\.rentalId, user\.id\)/);
  assert.match(intent, /rental\.platform_fee/);
  assert.doesNotMatch(intent, /body\.amount/);
});

test('payment approval route requires an authenticated, user-bound intent', () => {
  const approve = section("path === '/api/payments/approve'", "path === '/api/payments/complete'");
  assert.match(approve, /requireUser\(request, env\)/);
  assert.match(approve, /payment_intents WHERE id=\?1 AND user_id=\?2/);
  assert.match(approve, /body\.paymentIntentId/);
  assert.match(approve, /validatePiPayment\(payment, intent, user\)/);
  assert.match(approve, /\['created','pending','approved'\]/);
  assert.match(worker, /const payerUid = payment\?\.user\?\.uid \|\| payment\?\.from_address\?\.uid/);
  assert.match(worker, /Pi payer mismatch/);
  assert.match(worker, /metadataIntent/);
  assert.match(worker, /Pi payment metadata binding is missing or invalid/);
});

test('payment approval uses an atomic D1 claim for the Pi payment ID', () => {
  const approve = section("path === '/api/payments/approve'", "path === '/api/payments/complete'");
  assert.match(approve, /status='created' AND pi_payment_id IS NULL/);
  assert.match(approve, /claim\?\.meta\?\.changes/);
  assert.match(approve, /concurrently claimed by another payment/);
});

test('payment completion requires an approved intent and strict Pi binding', () => {
  const complete = section("path === '/api/payments/complete'", "path === '/api/payments/incomplete'");
  assert.match(complete, /intent\.pi_payment_id && intent\.pi_payment_id !== body\.paymentId/);
  assert.match(complete, /\['approved','completed'\]\.includes/);
  assert.match(worker, /Pi payment identifier mismatch/);
  assert.match(worker, /Pi payment amount mismatch/);
  assert.match(worker, /Pi payment memo mismatch/);
  assert.match(worker, /payment metadata binding is missing or invalid/);
  assert.match(complete, /\['approved','completed','complete'\]/);
});

test('payment completion can recover when Pi is already completed but D1 has not finalized it', () => {
  const complete = section("path === '/api/payments/complete'", "path === '/api/payments/incomplete'");
  assert.match(complete, /\['approved','completed','complete'\]\.includes\(status\)/);
  assert.match(complete, /if \(!completionResponse\.ok && !\['completed','complete'\]\.includes\(status\)\)/);
  assert.match(complete, /UPDATE payment_intents SET pi_payment_id=\?1,pi_txid=\?2,status='completed'/);
  assert.match(complete, /UPDATE rentals SET payment_status='completed',status='confirmed'/);
  assert.match(complete, /INSERT OR IGNORE INTO transactions/);
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

test('frontend auth bridge uses HttpOnly cookie sessions instead of browser-stored bearer tokens', () => {
  assert.doesNotMatch(piAuthContext, /localStorage\.getItem\(STORAGE_KEY_USER\)/);
  assert.doesNotMatch(piAuthContext, /session\.sessionToken/);
  assert.doesNotMatch(piAuthContext, /headers\.set\('Authorization'/);
  assert.match(piAuthContext, /credentials: init\.credentials \|\| 'include'/);
  assert.match(piAuthContext, /headers\.set\('X-Rentora-Client', 'web'\)/);
  assert.match(piAuthContext, /localStorage\.removeItem\('rentora_live_v1_session'\)/);
});

test('legacy rental sync rejects malformed and past dates before persistence', () => {
  const rentalSync = section("path === '/api/sync/rental'", "path === '/api/sync/rental/status'");
  assert.match(rentalSync, /Invalid rental dates/);
  assert.match(rentalSync, /Rental end date must be after start date/);
  assert.match(rentalSync, /Rental start date cannot be in the past/);
});

test('profile sync enforces bounded field lengths server-side', () => {
  const profileSync = section("path === '/api/sync/user'", "path === '/api/upload'");
  assert.match(profileSync, /profileLimits/);
  assert.match(profileSync, /Profile field too long/);
});


test('conversation and message reads are bounded server-side', () => {
  const list = section("path === '/api/conversations'", "method === 'POST' && path === '/api/conversations'");
  assert.match(list, /ORDER BY COALESCE\(c\.last_message_at, c\.created_at\) DESC\n\s*LIMIT 100/);
  const messages = section("path.startsWith('/api/conversations/') && path.endsWith('/messages')", "method === 'POST' && path.startsWith('/api/conversations/') && path.endsWith('/messages')");
  assert.match(messages, /ORDER BY m\.created_at ASC\n\s*LIMIT 200/);
});
