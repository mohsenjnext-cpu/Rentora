import test from 'node:test';
import assert from 'node:assert/strict';

function parseMetadata(value) {
  if (!value) return {};
  try { return JSON.parse(value); } catch (_) { return {}; }
}

// Mirrors the current server-authoritative userView contract:
// only the admin-reviewed KYC state is exposed as public verification.
function computeUserView(row) {
  const meta = parseMetadata(row.metadata);
  const adminKycStatus = ['verified', 'unverified', 'unknown'].includes(meta.adminKycStatus)
    ? meta.adminKycStatus
    : 'unknown';
  return {
    ...meta,
    id: row.id,
    uid: row.pi_uid,
    username: row.username,
    kycStatus: adminKycStatus
  };
}

test('KYC 1: admin-reviewed verified status is exposed as verified', () => {
  const view = computeUserView({
    id: 'usr_1',
    pi_uid: 'uid_alice',
    username: 'alice',
    metadata: JSON.stringify({
      adminKycStatus: 'verified',
      kycStatus: 'unverified'
    })
  });
  assert.equal(view.kycStatus, 'verified');
});

test('KYC 2: client/legacy kycStatus cannot grant verification', () => {
  const view = computeUserView({
    id: 'usr_2',
    pi_uid: 'uid_bob',
    username: 'bob',
    metadata: JSON.stringify({ kycStatus: 'verified' })
  });
  assert.equal(view.kycStatus, 'unknown');
});

test('KYC 3: admin-reviewed unverified status overrides legacy verified metadata', () => {
  const view = computeUserView({
    id: 'usr_3',
    pi_uid: 'uid_charlie',
    username: 'charlie',
    metadata: JSON.stringify({
      adminKycStatus: 'unverified',
      kycStatus: 'verified'
    })
  });
  assert.equal(view.kycStatus, 'unverified');
});

test('KYC 4: malformed or unsupported KYC state resolves to unknown', () => {
  assert.equal(computeUserView({
    id: 'usr_4',
    pi_uid: 'uid_dana',
    username: 'dana',
    metadata: JSON.stringify({ adminKycStatus: 'approved' })
  }).kycStatus, 'unknown');

  assert.equal(computeUserView({
    id: 'usr_5',
    pi_uid: 'uid_eve',
    username: 'eve',
    metadata: '{}'
  }).kycStatus, 'unknown');
});

test('KYC 5: each user resolves only its own database record', () => {
  const usersDb = [
    { pi_uid: 'uid_alice', metadata: JSON.stringify({ adminKycStatus: 'verified' }) },
    { pi_uid: 'uid_bob', metadata: JSON.stringify({ adminKycStatus: 'unverified' }) }
  ];
  const getKyc = (uid) => {
    const row = usersDb.find(user => user.pi_uid === uid);
    return row ? computeUserView(row).kycStatus : 'unknown';
  };
  assert.equal(getKyc('uid_alice'), 'verified');
  assert.equal(getKyc('uid_bob'), 'unverified');
  assert.equal(getKyc('uid_missing'), 'unknown');
});
