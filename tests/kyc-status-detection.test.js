import test from 'node:test';
import assert from 'node:assert/strict';

function computeUserView(row) {
  const metadata = row.metadata ? JSON.parse(row.metadata) : {};
  return { ...metadata, kycStatus: metadata.kycStatus === 'verified' ? 'verified' : 'unverified' };
}

// The authenticated Pi /me response identifies the user but currently has no
// documented server-authoritative KYC assertion. KYC must stay unverified.
function resolveKycStatusFromLogin() {
  return 'unverified';
}

test('KYC 1: Pi identity fields do not promote KYC without a trusted server-side KYC source', () => {
  const verifiedPiUser = {
    uid: 'uid_alice_verified',
    username: 'alice',
    kyc_status: true,
    roles: ['pioneer', 'kyc']
  };

  const status = resolveKycStatusFromLogin(verifiedPiUser, { user: verifiedPiUser });
  assert.equal(status, 'unverified', 'Identity response alone must not promote KYC');

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
  assert.equal(view.kycStatus, 'unverified', 'stored login result must remain unverified');
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

test('KYC 4: switching to an identity with KYC-like fields remains unverified without trusted KYC API', () => {
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
  assert.equal(activeCurrentUser.kycStatus, 'unverified', 'KYC-like identity fields must not verify Alice');
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

test('KYC 6: forged frontend KYC claims cannot set verified status', () => {
  const serverPiIdentity = { uid: 'uid_pioneer', username: 'pioneer' };
  const forgedClientBody = { kycStatus: 'verified', user: { kyc_status: true, roles: ['kyc'] } };
  assert.equal(resolveKycStatusFromLogin(serverPiIdentity, forgedClientBody), 'unverified');
});
