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
  assert.match(intent, /bind\(rentalId, user\.id\)/);
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
  assert.match(approve, /status='created' AND \(pi_payment_id IS NULL OR pi_payment_id=\?1\)/);
  assert.match(approve, /claim\?\.meta\?\.changes/);
  assert.match(approve, /concurrently claimed by another payment/);
});

test('incomplete Pi reconciliation is authenticated and user-bound', () => {
  const route = section("path === '/api/payments/incomplete'", "path === '/api/sync/item'");
  assert.match(route, /const \{ user \} = await requireUser\(request, env\)/);
  assert.match(route, /WHERE pi\.pi_payment_id=\?1 AND pi\.user_id=\?2 LIMIT 1/);
  assert.match(route, /\.bind\(paymentId, user\.id\)\.first\(\)/);
});

test('incomplete Pi reconciliation rejects transaction identity collisions before confirming', () => {
  const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
  const start = worker.indexOf("path === '/api/payments/incomplete'");
  const end = worker.indexOf("path === '/api/sync/item'", start);
  assert.ok(start >= 0 && end > start);
  const route = worker.slice(start, end);
  assert.match(route, /SELECT payment_intent_id, pi_payment_id, pi_txid FROM transactions WHERE pi_payment_id=\?1 OR pi_txid=\?2/);
  assert.match(route, /Pi transaction is already bound to another payment intent/);
  assert.match(route, /idempotent: true/);
  assert.match(route, /INSERT INTO transactions\(/);
  assert.doesNotMatch(route, /INSERT OR IGNORE INTO transactions/);
});


test('payment completion requires an approved intent and strict Pi binding', () => {
  const complete = section("path === '/api/payments/complete'", "path === '/api/payments/incomplete'");
  assert.match(complete, /intent\.pi_payment_id && intent\.pi_payment_id !== paymentId/);
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
  assert.match(complete, /INSERT INTO transactions\(/);
});

test('API responses include baseline security headers', () => {
  assert.match(worker, /Content-Security-Policy/);
  assert.match(worker, /Strict-Transport-Security/);
  assert.match(worker, /X-Frame-Options/);
  assert.match(worker, /X-Content-Type-Options/);
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

test('server auth session is issued and revoked as an HttpOnly cookie', () => {
  assert.match(worker, /function getCookie\(request, name\)/);
  assert.match(worker, /rentora_session=/);
  assert.match(worker, /HttpOnly; Secure; SameSite=None/);
  assert.match(worker, /Set-Cookie/);
  assert.match(worker, /const cookieToken = getCookie\(request, 'rentora_session'\)/);
  assert.match(worker, /const token = cookieToken \|\| \(header\.startsWith\('Bearer '\)/);
});

test('sync client sends cookies without reading session tokens from localStorage', () => {
  const sync = fs.readFileSync(new URL('../src/services/cloudSyncService.js', import.meta.url), 'utf8');
  assert.doesNotMatch(sync, /localStorage\.getItem\(STORAGE_USER_KEY\)/);
  assert.doesNotMatch(sync, /session\.sessionToken/);
  assert.match(sync, /credentials: 'include'/);
});


test('Pi cancellation converges payment intent and rental state server-side', () => {
  const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
  const start = worker.indexOf("path === '/api/payments/cancel'");
  const end = worker.indexOf("path === '/api/payments/approve'", start);
  assert.ok(start >= 0 && end > start);
  const route = worker.slice(start, end);
  assert.match(route, /paymentIntentId is required/);
  assert.match(route, /status='cancelled'/);
  assert.match(route, /payment_status='cancelled', status='cancelled'/);
  assert.match(route, /Completed payment cannot be cancelled/);
  assert.match(route, /RENTORA_KV\.delete/);
});

test('Pi native cancellation callback invokes server-side cancellation', () => {
  const service = fs.readFileSync(new URL('../src/services/piService.js', import.meta.url), 'utf8');
  const context = fs.readFileSync(new URL('../src/context/RentoraContext.jsx', import.meta.url), 'utf8');
  assert.match(service, /async cancelPaymentOnServer\(paymentId, paymentIntentId\)/);
  assert.match(service, /api\/payments\/cancel/);
  assert.match(service, /onCancel: \(paymentId\) =>/);
  assert.match(context, /onCancel: async \(paymentId\)/);
  assert.match(context, /piService\.cancelPaymentOnServer\(paymentId, draftRental\.paymentIntentId\)/);
});


test('failed or cancelled Pi payments release the bound intent for a fresh retry', () => {
  const intent = section("path === '/api/payments/intent'", "path === '/api/payments/cancel'");
  assert.match(intent, /normalizedPaymentStatus/);
  assert.match(intent, /\['cancelled','failed'\]\.includes\(normalizedPaymentStatus\)/);
  assert.match(intent, /UPDATE payment_intents SET status='cancelled'/);
  assert.match(intent, /UPDATE rentals SET payment_status='pending', status='pending_payment'/);
  assert.match(intent, /`payment-intent:\$\{existing\.id\}`/);
});

test('incomplete reconciliation converges failed or cancelled Pi payments without confirming the rental', () => {
  const incomplete = section("path === '/api/payments/incomplete'", "path === '/api/sync/item'");
  assert.match(incomplete, /payment\?\.status\?\.cancelled/);
  assert.match(incomplete, /String\(payment\?\.status \|\| ''\)\.toLowerCase\(\) === 'failed'/);
  assert.match(incomplete, /paymentStatus: 'cancelled'/);
  assert.match(incomplete, /payment_status='pending', status='pending_payment'/);
});


test('sensitive mutation endpoints have KV-backed abuse throttles', () => {
  assert.match(worker, /async function enforceRateLimit\(request, env, scope/);
  for (const scope of ['pi-login', 'payment-intent', 'payment-approve', 'payment-complete', 'payment-incomplete', 'upload', 'reports', 'messages']) {
    assert.match(worker, new RegExp(`enforceRateLimit\\(request, env, '${scope}'`));
  }
  assert.match(worker, /return errorResponse\('Too many .*', 429/);
  assert.match(worker, /expirationTtl: windowSeconds \+ 5/);
});


test('optional-auth public data routes resolve the HttpOnly session cookie', () => {
  assert.match(worker, /async function getOptionalUser\(request, env\)/);
  assert.match(section("path === '/api/sync/all'", "path === '/api/listings'"), /getOptionalUser\(request, env\)/);
  assert.match(section("path === '/api/listings'", "path.startsWith\('/api/listings/'\)"), /getOptionalUser\(request, env\)/);
  assert.match(section("path.startsWith('/api/listings/')", "path.startsWith('/api/admin/reconciliation/')"), /getOptionalUser\(request, env\)/);
});


test('server error responses do not expose internal exception text', () => {
  assert.match(worker, /else if \(status >= 500\)/);
  assert.match(worker, /خطای داخلی سرور/);
  assert.match(worker, /سرویس موقتاً در دسترس نیست/);
  assert.match(worker, /errorResponse\('Pi payment approval failed', 502, env, undefined/);
  assert.match(worker, /errorResponse\('Pi payment completion failed', 502, env, undefined/);
});


test('listing mutations validate bounded fields and enum status', () => {
  const route = section("path === '/api/sync/item'", "path === '/api/rentals/'");
  assert.match(route, /listingId\.length > 128/);
  assert.match(route, /title\.length > 200/);
  assert.match(route, /description\.length > 5000/);
  assert.match(route, /category\.length > 100/);
  assert.match(route, /location\.length > 200/);
  assert.match(route, /\['draft','active','paused','deleted'\]\.includes\(listingStatus\)/);
  assert.match(route, /status=\?5/);
});


test('frontend authenticated actions use HttpOnly cookie sessions instead of localStorage bearer tokens', () => {
  const context = fs.readFileSync(new URL('../src/context/RentoraContext.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(context, /localStorage\.getItem\(['"]rentora_live_v1_session['"]\)/);
});

test('server rejects malformed report target types and oversized text fields', () => {
  const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
  assert.match(worker, /function requireString\(value, field, maxLength/);
  assert.match(worker, /function requireEnum\(value, field, allowed/);
  assert.match(worker, /requireEnum\(body\?\.type \|\| body\?\.targetType \|\| 'listing'/);
  assert.match(worker, /requireString\(body\?\.details \?\? body\?\.description \?\? '', 'details', 2000\)/);
});
