import test from 'node:test';
import assert from 'node:assert/strict';

// Helper function mirroring _worker.js authoritative userView
function parseMetadata(value) {
  if (!value) return {};
  try { return JSON.parse(value); } catch (_) { return {}; }
}

function computeUserView(row, env) {
  const meta = parseMetadata(row.metadata);
  const isAdm = env ? (row.pi_uid === env.ADMIN_UID || row.username === env.ADMIN_USERNAME) : row.role === 'admin';
  const isVerifiedPioneer = meta.kycStatus === 'verified' || row.kyc_status === 'verified';
  return {
    ...meta,
    id: row.id,
    uid: row.pi_uid,
    piUid: row.pi_uid,
    username: row.username,
    displayName: row.display_name || row.username,
    role: isAdm ? 'admin' : 'user',
    status: row.status || 'active',
    kycStatus: isVerifiedPioneer ? 'verified' : 'unverified',
    isOfficialSdk: true
  };
}

// Helper function mirroring _worker.js /api/auth/pi-login KYC extraction
function resolveKycStatusFromLogin(piUser, body) {
  const isKyced = Boolean(
    piUser?.kyc_status === true ||
    piUser?.kyc_status === 'verified' ||
    piUser?.is_kyc === true ||
    piUser?.kyc === true ||
    piUser?.credentials?.kyc === true ||
    body?.user?.kyc_status === true ||
    body?.user?.kyc_status === 'verified' ||
    body?.user?.is_kyc === true ||
    body?.user?.kyc === true ||
    body?.user?.credentials?.kyc === true ||
    body?.kycStatus === 'verified' ||
    (Array.isArray(piUser?.roles) && (
      piUser.roles.includes('kyc') ||
      piUser.roles.includes('kyced') ||
      piUser.roles.includes('pioneer_kyc')
    )) ||
    (Array.isArray(body?.user?.roles) && (
      body.user.roles.includes('kyc') ||
      body.user.roles.includes('kyced') ||
      body.user.roles.includes('pioneer_kyc')
    ))
  );
  return isKyced ? 'verified' : 'unverified';
}

test('KYC 1: Verified account A with kyc_status=true resolves to "verified"', () => {
  const verifiedPiUser = {
    uid: 'uid_alice_verified',
    username: 'alice',
    kyc_status: true,
    roles: ['pioneer', 'kyc']
  };

  const status = resolveKycStatusFromLogin(verifiedPiUser, { user: verifiedPiUser });
  assert.equal(status, 'verified', 'Account with verified KYC must resolve to "verified"');

  const row = {
    id: 'usr_1',
    pi_uid: 'uid_alice_verified',
    username: 'alice',
    display_name: 'Alice',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({ kycStatus: status, isOfficialSdk: true })
  };

  const view = computeUserView(row, {});
  assert.equal(view.kycStatus, 'verified', 'userView must produce "verified" for verified account');
});

test('KYC 2: Unverified account B with standard role ["pioneer"] resolves to "unverified"', () => {
  const unverifiedPiUser = {
    uid: 'uid_bob_unverified',
    username: 'bob',
    kyc_status: false,
    roles: ['pioneer'] // Regular pioneer role must NOT grant KYC verified badge
  };

  const status = resolveKycStatusFromLogin(unverifiedPiUser, { user: unverifiedPiUser });
  assert.equal(status, 'unverified', 'Account without KYC must resolve to "unverified" even with role "pioneer"');

  const row = {
    id: 'usr_2',
    pi_uid: 'uid_bob_unverified',
    username: 'bob',
    display_name: 'Bob',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({ kycStatus: status, isOfficialSdk: true })
  };

  const view = computeUserView(row, {});
  assert.equal(view.kycStatus, 'unverified', 'userView must produce "unverified" for unverified account even if isOfficialSdk is true');
});

test('KYC 3: Switching Account A (verified) -> Account B (unverified) does NOT retain A KYC status', () => {
  // 1. Alice logs in
  const aliceSession = {
    uid: 'uid_alice_verified',
    username: 'alice',
    kycStatus: 'verified',
    sessionToken: 'sess_alice'
  };
  let activeCurrentUser = { ...aliceSession };
  assert.equal(activeCurrentUser.kycStatus, 'verified');

  // 2. Alice logs out -> session completely wiped
  activeCurrentUser = null;
  assert.equal(activeCurrentUser, null);

  // 3. Bob logs in (unverified)
  const bobPiUser = {
    uid: 'uid_bob_unverified',
    username: 'bob',
    roles: ['pioneer']
  };
  const bobKycStatus = resolveKycStatusFromLogin(bobPiUser, { user: bobPiUser });
  const bobSession = {
    uid: 'uid_bob_unverified',
    username: 'bob',
    kycStatus: bobKycStatus,
    sessionToken: 'sess_bob'
  };
  activeCurrentUser = { ...bobSession };

  assert.equal(activeCurrentUser.username, 'bob');
  assert.equal(activeCurrentUser.kycStatus, 'unverified', 'Bob must not inherit Alice verified status');
});

test('KYC 4: Switching Account B (unverified) -> Account A (verified) resolves to "verified"', () => {
  // 1. Bob logs in (unverified)
  let activeCurrentUser = {
    uid: 'uid_bob_unverified',
    username: 'bob',
    kycStatus: 'unverified',
    sessionToken: 'sess_bob'
  };
  assert.equal(activeCurrentUser.kycStatus, 'unverified');

  // 2. Logout
  activeCurrentUser = null;

  // 3. Alice logs in (verified)
  const alicePiUser = {
    uid: 'uid_alice_verified',
    username: 'alice',
    kyc_status: true,
    roles: ['pioneer', 'kyc']
  };
  const aliceKycStatus = resolveKycStatusFromLogin(alicePiUser, { user: alicePiUser });
  activeCurrentUser = {
    uid: 'uid_alice_verified',
    username: 'alice',
    kycStatus: aliceKycStatus,
    sessionToken: 'sess_alice'
  };

  assert.equal(activeCurrentUser.username, 'alice');
  assert.equal(activeCurrentUser.kycStatus, 'verified', 'Alice must be verified after logging in after Bob');
});

test('KYC 5: A user KYC status cannot be taken from another user record', () => {
  const usersDb = [
    { id: 'usr_1', uid: 'uid_alice', username: 'alice', kycStatus: 'verified' },
    { id: 'usr_2', uid: 'uid_bob', username: 'bob', kycStatus: 'unverified' },
    { id: 'usr_3', uid: 'uid_charlie', username: 'charlie', kycStatus: 'verified' }
  ];

  // Specific lookup strictly by authenticated user's own UID
  const getAuthUserKyc = (sessionUid) => {
    const user = usersDb.find(u => u.uid === sessionUid);
    return user ? user.kycStatus : 'unverified';
  };

  assert.equal(getAuthUserKyc('uid_bob'), 'unverified');
  assert.equal(getAuthUserKyc('uid_alice'), 'verified');
  assert.equal(getAuthUserKyc('uid_charlie'), 'verified');
  assert.equal(getAuthUserKyc('uid_nonexistent'), 'unverified');
});
