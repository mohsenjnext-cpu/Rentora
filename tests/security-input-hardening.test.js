import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const rentoraContext = fs.readFileSync(new URL('../src/context/RentoraContext.jsx', import.meta.url), 'utf8');
const piAuthContext = fs.readFileSync(new URL('../src/context/PiAuthContext.jsx', import.meta.url), 'utf8');
const cloudSync = fs.readFileSync(new URL('../src/services/cloudSyncService.js', import.meta.url), 'utf8');
const gateway = fs.readFileSync(new URL('../worker-gateway2.js', import.meta.url), 'utf8');

function section(start, end) {
  const from = worker.indexOf(start);
  assert.notEqual(from, -1, `missing section: ${start}`);
  const to = end ? worker.indexOf(end, from) : worker.length;
  return worker.slice(from, to === -1 ? worker.length : to);
}

test('profile updates enforce server-side field types and bounds', () => {
  const route = section("path === '/api/sync/user'", "path === '/api/upload'");
  assert.match(route, /requireString\(body\.displayName, 'displayName', 120\)/);
  assert.match(route, /requireString\(body\.avatar, 'avatar', 4096\)/);
  assert.match(route, /requireString\(body\.bio, 'bio', 1000\)/);
  assert.match(route, /requireString\(body\.location, 'location', 200\)/);
  assert.match(route, /requireString\(body\.phoneMasked, 'phoneMasked', 64\)/);
  assert.doesNotMatch(route, /String\(body\.avatar\)/);
});

test('conversation messages use a constrained server-side message type', () => {
  const route = section("path.startsWith('/api/conversations/') && path.endsWith('/messages')", "path.startsWith('/api/conversations/') && path.endsWith('/read')");
  assert.match(route, /requireString\(body\?\.text, 'text', 2000, \{ required: true \}\)/);
  assert.match(route, /requireEnum\(body\?\.messageType \|\| 'text', 'messageType', \['text'\]\)/);
  assert.match(route, /\.bind\(msgId, convId, user\.id, rawText, finalType, now\(\)\)/);
});

test('review text is type-checked and bounded', () => {
  const route = section("path.startsWith('/api/rentals/') && path.endsWith('/reviews')", "path === '/api/support/tickets'");
  assert.match(route, /requireString\(body\?\.reviewText \?\? body\?\.comment \?\? '', 'reviewText', 1000\)/);
});

test('admin target identifiers have bounded path lengths', () => {
  assert.match(worker, /const targetUserId = path\.slice\('\/api\/admin\/users\/'\.length, -'\/status'\.length\)\.trim\(\);\s*if \(!targetUserId \|\| targetUserId\.length > 128\)/);
  assert.match(worker, /const targetUserId = path\.slice\('\/api\/admin\/users\/'\.length, -'\/kyc'\.length\)\.trim\(\);\s*if \(!targetUserId \|\| targetUserId\.length > 128\)/);
  assert.match(worker, /const listingId = path\.slice\('\/api\/admin\/listings\/'\.length, -'\/status'\.length\)\.trim\(\);\s*if \(!listingId \|\| listingId\.length > 128\)/);
});

test('client UI never fabricates third-party listing placeholders', () => {
  assert.doesNotMatch(rentoraContext, /images\.unsplash\.com/);
  assert.doesNotMatch(rentoraContext, /api\.dicebear\.com/);
  assert.match(rentoraContext, /const finalImage = Array\.isArray\(itemData\.images\)/);
});

test('client platform config and favorites are not persisted in browser storage', () => {
  assert.doesNotMatch(rentoraContext, /localStorage\.(getItem|setItem).*config_v9/);
  assert.doesNotMatch(rentoraContext, /localStorage\.(getItem|setItem).*favorites_v8/);
});

test('session bridge keeps API detection variables in scope and admin UI requires server verification', () => {
  assert.match(piAuthContext, /const isApiRequest = \(apiBase && url\.startsWith\(apiBase\)\) \|\| url\.startsWith\('\/api\/'\)/);
  assert.match(piAuthContext, /const isPiLogin = url\.includes\('\/api\/auth\/pi-login'\)/);
  assert.match(piAuthContext, /const isActuallyAdmin = Boolean\(currentUser\?\.uid && isServerVerifiedAdmin\)/);
});

test('offline sync path uses the memory user cache instead of an undefined variable', () => {
  assert.doesNotMatch(cloudSync, /users:\s*localUsers/);
  assert.match(cloudSync, /users: this\.getCachedUsers\(\)/);
});


test('logout clears marketplace memory and private client state', () => {
  assert.match(rentoraContext, /setItems\(\[\]\);/);
  assert.match(rentoraContext, /setFavorites\(\[\]\);/);
  assert.match(rentoraContext, /setRentals\(\[\]\);/);
  assert.match(rentoraContext, /cloudSyncService\.clearUserSessionCache\(\);/);
});


test('listing numeric inputs reject booleans and blank prices', () => {
  assert.match(worker, /const priceRaw = item\.pricePerDay/);
  assert.match(worker, /typeof priceRaw === 'boolean'/);
  assert.match(worker, /typeof priceRaw === 'string' && !priceRaw\.trim\(\)/);
  assert.match(worker, /typeof depositRaw === 'boolean'/);
});


test('listing text fields reject non-string values', () => {
  assert.match(worker, /typeof item\?\.title !== 'string'/);
  assert.match(worker, /typeof item\.description !== 'string'/);
  assert.match(worker, /typeof item\.category !== 'string'/);
  assert.match(worker, /typeof item\.location !== 'string'/);
});
test('cross-tab broadcasts are invalidation signals, not client-side data authority', () => {
  const handler = cloudSync.slice(
    cloudSync.indexOf('handleIncomingBroadcast(payload)'),
    cloudSync.indexOf('getAuthHeaders()', cloudSync.indexOf('handleIncomingBroadcast(payload)'))
  );
  assert.match(handler, /fetchSharedData\(true\)\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(handler, /saveCachedItems\(updated\)/);
  assert.doesNotMatch(handler, /saveCachedUsers\(updated\)/);
  assert.doesNotMatch(handler, /notifySubscribers\('ITEM_ADDED'/);
  assert.doesNotMatch(handler, /notifySubscribers\('USER_SYNC'/);
  assert.doesNotMatch(handler, /notifySubscribers\('RENTAL_SYNC'/);
});


test('admin identity is server-authoritative and never client-role authoritative', () => {
  const requireAdminSection = worker.slice(worker.indexOf('async function requireAdmin'), worker.indexOf('async function recordAdminAuditLog'));
  assert.match(requireAdminSection, /isAdmin\(auth\.user\.pi_uid, env\)/);
  assert.match(requireAdminSection, /auth\.user\.role !== 'admin'/);
  assert.match(worker, /function isAdmin\(uid, env\)/);
  assert.match(worker, /allowed\.includes\(id\)/);
});

test('admin status and KYC mutations use strict enums', () => {
  const statusRoute = section("path.startsWith('/api/admin/users/') && path.endsWith('/status')", "path.startsWith('/api/admin/users/') && path.endsWith('/kyc')");
  const kycRoute = section("path.startsWith('/api/admin/users/') && path.endsWith('/kyc')", "path.startsWith('/api/admin/reports/')");
  assert.match(statusRoute, /\['active', 'suspended'\]\.includes\(newStatus\)/);
  assert.match(kycRoute, /\['verified', 'unverified', 'unknown'\]\.includes\(newKycStatus\)/);
});

test('session cookie uses server TTL and explicit logout invalidation', () => {
  assert.match(worker, /Max-Age=\$\{SESSION_TTL\}/);
  assert.match(worker, /rentora_session=; Max-Age=0; Path=\/; HttpOnly; Secure; SameSite=None/);
  assert.match(worker, /RENTORA_KV\.delete\(.*session:/);
});

test('rental creation requires a server-issued quote when quoteId is supplied', () => {
  const route = section("method === 'POST' && path === '/api/rentals'", "method === 'GET' && path.startsWith('/api/rentals/')");
  assert.match(route, /RENTORA_KV\.get\(.*quote:/);
  assert.match(route, /Quote does not belong to the authenticated user/);
  assert.match(route, /quote\.expiresAt/);
});


test('listing contact input rejects object/array coercion and enforces bounded contact fields', () => {
  assert.match(worker, /Invalid listing contact info/);
  assert.match(worker, /Invalid listing contact field type/);
  assert.match(worker, /Listing contact field is too long/);
  assert.match(worker, /\['phone', 'whatsapp', 'in_app'\]\.includes\(methodValue\)/);
});


test('rental quote rejects non-text listing IDs and invalid date values before financial calculation', () => {
  assert.match(worker, /requireString\(body\?\.listingId, 'listingId', 128, \{ required: true \}\)/);
  assert.match(worker, /requireString\(body\?\.startDate, 'startDate', 64, \{ required: true \}\)/);
  assert.match(worker, /requireString\(body\?\.endDate, 'endDate', 64, \{ required: true \}\)/);
  assert.match(worker, /Number\.isNaN\(Date\.parse\(startDate\)\)/);
});


test('payout and quote identifiers reject coercive or malformed sensitive inputs', () => {
  assert.match(worker, /typeof key !== 'string'/);
  assert.match(worker, /Invalid payout amount/);
  assert.match(worker, /Invalid payout memo/);
  assert.match(worker, /Invalid quoteId/);
  assert.match(worker, /qt_\[A-Za-z0-9_-\]/);
});

test('payment intents and conversation/report route identifiers are type-checked and bounded', () => {
  assert.match(worker, /const rentalId = requireString\(body\?\.rentalId, 'rentalId', 128, \{ required: true \}\)/);
  assert.match(worker, /\.bind\(rentalId, user\.id\)/);
  assert.match(worker, /Invalid conversation ID/);
  assert.match(worker, /Invalid report ID/);
  assert.match(worker, /requireEnum\(body\?\.status \|\| 'resolved', 'status', \['resolved', 'dismissed', 'reviewing'\]\)/);
});

test('gateway incomplete payment rejects non-text or oversized payment identifiers', () => {
  assert.match(gateway, /paymentIdRaw = body\?\.paymentId/);
  assert.match(gateway, /paymentIntentIdRaw = body\?\.paymentIntentId/);
  assert.match(gateway, /paymentId\.length > 128/);
});

test('gateway payment completion requires bounded text identifiers', () => {
  assert.match(gateway, /body\?\.paymentId !== 'string'/);
  assert.match(gateway, /body\?\.txid !== 'string'/);
  assert.match(gateway, /paymentIntentId\.length > 128/);
});


test('gateway payment approval requires bounded text identifiers', () => {
  const route = gateway.slice(gateway.indexOf('async function approvePayment'), gateway.indexOf('async function completePayment'));
  assert.match(route, /paymentIdRaw = body\?\.paymentId/);
  assert.match(route, /paymentIntentIdRaw = body\?\.paymentIntentId/);
  assert.match(route, /paymentId\.length > 128/);
  assert.match(route, /paymentIntentId\.length > 128/);
});

test('gateway payout idempotency rejects non-text and oversized keys', () => {
  const helper = gateway.slice(gateway.indexOf('function payoutIdempotencyKey'), gateway.indexOf('function parsePaymentMetadata'));
  assert.match(helper, /bodyKey != null && typeof bodyKey !== 'string'/);
  assert.match(helper, /normalized\.length <= 200/);
  assert.doesNotMatch(helper, /String\(key\)\.trim\(\)/);
});
