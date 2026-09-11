import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');

function section(start, end) {
  const from = worker.indexOf(start);
  assert.notEqual(from, -1, `missing section: ${start}`);
  const to = end ? worker.indexOf(end, from) : worker.length;
  return worker.slice(from, to === -1 ? worker.length : to);
}

test('payment intent amount is server-owned', () => {
  const intent = section("path === '/api/payments/intent'", "path === '/api/payments/approve'");
  assert.match(intent, /SELECT r\.\*, l\.title/);
  assert.match(intent, /bind\(body\.rentalId, user\.id\)/);
  assert.match(intent, /rental\.platform_fee/);
  assert.doesNotMatch(intent, /body\.amount/);
});

test('payment approval binds payment to the authenticated Pioneer', () => {
  const approve = section("path === '/api/payments/approve'", "path === '/api/payments/complete'");
  assert.match(approve, /const payerUid = payment\?\.user\?\.uid/);
  assert.match(approve, /Pi payer mismatch/);
  assert.match(approve, /paymentIntentId/);
  assert.match(approve, /Pi payment metadata mismatch/);
});

test('payment completion cannot silently accept a different payment id', () => {
  const complete = section("path === '/api/payments/complete'", "path === '/api/payments/incomplete'");
  assert.match(complete, /intent\.pi_payment_id && intent\.pi_payment_id !== body\.paymentId/);
  assert.match(complete, /Pi payment identifier mismatch/);
  assert.match(complete, /Pi payment amount mismatch/);
  assert.match(complete, /Pi payment memo mismatch/);
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
