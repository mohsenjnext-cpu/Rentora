import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const entrypoint = fs.readFileSync(new URL('../worker-gateway2.js', import.meta.url), 'utf8');

test('gateway2 admin authorization is configuration-only', () => {
  assert.match(entrypoint, /function adminAllowed\(value, env\)/);
  assert.match(entrypoint, /ADMIN_PI_UIDS/);
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


test('gateway2 requires both configured Pi UID and persisted admin role', () => {
  assert.match(entrypoint, /user\.role === 'admin' && adminAllowed\(user\.pi_uid, env\)/);
  assert.match(entrypoint, /adminAllowed\(row\.pi_uid, env\) && row\.role === 'admin'/);
  assert.doesNotMatch(entrypoint, /adminAllowed\(user\.username, env\)/);
  assert.doesNotMatch(entrypoint, /adminAllowed\(row\.username, env\)/);
});


const legacyWorker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');

test('legacy worker does not derive admin privilege from username', () => {
  assert.match(legacyWorker, /const isAdm = env \? \(row\.role === 'admin' && isAdmin\(row\.pi_uid, env\)\)/);
  assert.match(legacyWorker, /const isAdminUser = user \? \(user\.role === 'admin' && isAdmin\(user\.pi_uid, env\)\) : false;/);
  assert.doesNotMatch(legacyWorker, /isAdmin\(row\.username, env\)/);
  assert.doesNotMatch(legacyWorker, /isAdmin\(user\.username, env\)/);
  assert.doesNotMatch(legacyWorker, /isAdmin\(username, env\)/);
});


test('legacy worker never trusts client-supplied KYC status during Pi login', () => {
  assert.match(legacyWorker, /KYC is server-authoritative/);
  assert.doesNotMatch(legacyWorker, /body\\?\.user\\?\.kyc_status/);
  assert.doesNotMatch(legacyWorker, /body\\?\.kycStatus/);
  assert.doesNotMatch(legacyWorker, /body\\?\.user\\?\.roles/);
});
