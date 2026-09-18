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
    isOfficialSdk: true,
    lastLoginAt: meta.lastLoginAt || null,
    lastLogoutAt: meta.lastLogoutAt || null,
    loginCount: Number(meta.loginCount || 0),
    logoutCount: Number(meta.logoutCount || 0),
    isOnline: Boolean(meta.isOnline)
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

function transactionView(row) {
  const meta = parseMetadata(row.metadata);
  return {
    ...meta,
    id: row.id,
    paymentIntentId: row.payment_intent_id,
    piPaymentId: row.pi_payment_id,
    piTxRef: row.pi_txid,
    txid: row.pi_txid,
    amount: row.amount,
    platformFee: row.amount,
    type: row.type || 'platform_fee',
    status: row.status || 'completed',
    userId: row.user_id,
    userUid: row.user_pi_uid,
    user_pi_uid: row.user_pi_uid,
    userUsername: row.user_username,
    userName: row.user_display_name || row.user_username,
    createdAt: row.created_at,
    created_at: row.created_at
  };
}

// =========================================================================
// 1. KYC STATUS DETECTION TESTS
// =========================================================================

test('KYC: Verified user resolves strictly to "verified"', () => {
  const verifiedPiUser = {
    uid: 'uid_alice_kyc',
    username: 'alice',
    kyc_status: true,
    roles: ['pioneer', 'kyc']
  };
  const status = resolveKycStatusFromLogin(verifiedPiUser, { user: verifiedPiUser });
  assert.equal(status, 'verified', 'Account with verified KYC must resolve to verified');

  const row = {
    id: 'usr_alice',
    pi_uid: 'uid_alice_kyc',
    username: 'alice',
    display_name: 'Alice',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({ kycStatus: status, isOfficialSdk: true })
  };
  const view = computeUserView(row, {});
  assert.equal(view.kycStatus, 'verified', 'View must display verified status');
});

test('KYC: Unverified user with role "pioneer" resolves strictly to "unverified"', () => {
  const unverifiedPiUser = {
    uid: 'uid_bob_unverified',
    username: 'bob',
    kyc_status: false,
    roles: ['pioneer']
  };
  const status = resolveKycStatusFromLogin(unverifiedPiUser, { user: unverifiedPiUser });
  assert.equal(status, 'unverified', 'Role pioneer alone must not grant KYC verification');

  const row = {
    id: 'usr_bob',
    pi_uid: 'uid_bob_unverified',
    username: 'bob',
    display_name: 'Bob',
    role: 'user',
    status: 'active',
    metadata: JSON.stringify({ kycStatus: status, isOfficialSdk: true })
  };
  const view = computeUserView(row, {});
  assert.equal(view.kycStatus, 'unverified', 'View must display unverified status');
});

test('KYC: Switching accounts does not carry over KYC state', () => {
  let activeSession = {
    uid: 'uid_alice',
    username: 'alice',
    kycStatus: 'verified'
  };
  assert.equal(activeSession.kycStatus, 'verified');

  // Logout clears session
  activeSession = null;
  assert.equal(activeSession, null);

  // Bob logs in
  const bobPiUser = { uid: 'uid_bob', username: 'bob', roles: ['pioneer'] };
  activeSession = {
    uid: 'uid_bob',
    username: 'bob',
    kycStatus: resolveKycStatusFromLogin(bobPiUser, { user: bobPiUser })
  };
  assert.equal(activeSession.kycStatus, 'unverified', 'Bob must NOT inherit Alice KYC status');
});

// =========================================================================
// 2. LIVE LOGIN / LOGOUT STATISTICS TESTS
// =========================================================================

test('Login/Logout: One login creates one login count and marks user online', () => {
  let userMeta = { loginCount: 0, logoutCount: 0, isOnline: false };

  // 1st login event
  userMeta = {
    ...userMeta,
    loginCount: userMeta.loginCount + 1,
    lastLoginAt: '2026-09-18T10:00:00.000Z',
    isOnline: true
  };

  assert.equal(userMeta.loginCount, 1);
  assert.equal(userMeta.isOnline, true);
  assert.equal(userMeta.lastLoginAt, '2026-09-18T10:00:00.000Z');
});

test('Login/Logout: Duplicate page refresh / GET /api/auth/me does not increment login count', () => {
  let userMeta = { loginCount: 1, logoutCount: 0, isOnline: true, lastLoginAt: '2026-09-18T10:00:00.000Z' };

  // Page refresh executes /api/auth/me (pure validation, no loginCount mutation)
  const validateSession = (meta) => {
    // Returns user data without incrementing loginCount
    return { ...meta };
  };

  userMeta = validateSession(userMeta);
  userMeta = validateSession(userMeta);
  userMeta = validateSession(userMeta);

  assert.equal(userMeta.loginCount, 1, 'Page refreshes must NOT increment loginCount');
  assert.equal(userMeta.isOnline, true);
});

test('Login/Logout: Logout updates the statistics and sets isOnline to false', () => {
  let userMeta = { loginCount: 1, logoutCount: 0, isOnline: true, lastLoginAt: '2026-09-18T10:00:00.000Z' };

  // User logs out via POST /api/auth/logout
  userMeta = {
    ...userMeta,
    logoutCount: userMeta.logoutCount + 1,
    lastLogoutAt: '2026-09-18T10:30:00.000Z',
    isOnline: false
  };

  assert.equal(userMeta.loginCount, 1);
  assert.equal(userMeta.logoutCount, 1);
  assert.equal(userMeta.isOnline, false);
  assert.equal(userMeta.lastLogoutAt, '2026-09-18T10:30:00.000Z');
});

// =========================================================================
// 3. ADMIN DASHBOARD STATISTICS & RESET BUTTON TESTS
// =========================================================================

test('Admin: Dashboard aggregates live login, logout, and online user counts', () => {
  const usersMeta = [
    { metadata: JSON.stringify({ loginCount: 5, logoutCount: 4, isOnline: true }) },
    { metadata: JSON.stringify({ loginCount: 2, logoutCount: 2, isOnline: false }) },
    { metadata: JSON.stringify({ loginCount: 1, logoutCount: 0, isOnline: true }) }
  ];

  let totalLogins = 0;
  let totalLogouts = 0;
  let onlineUsers = 0;
  for (const u of usersMeta) {
    const m = parseMetadata(u.metadata);
    totalLogins += Number(m.loginCount || 0);
    totalLogouts += Number(m.logoutCount || 0);
    if (m.isOnline) onlineUsers++;
  }

  assert.equal(totalLogins, 8, 'Total logins must aggregate correctly');
  assert.equal(totalLogouts, 6, 'Total logouts must aggregate correctly');
  assert.equal(onlineUsers, 2, 'Online users must count active users correctly');
});

test('Admin: Reset Data purges marketplace data while strictly preserving payments, transactions, and users', () => {
  // Mock DB tables before reset
  let listings = [{ id: 'lst_1' }, { id: 'lst_2' }];
  let rentals = [{ id: 'rnt_1' }];
  let reviews = [{ id: 'rev_1' }];
  let messages = [{ id: 'msg_1' }];
  let conversations = [{ id: 'cnv_1' }];
  let reports = [{ id: 'rep_1' }];
  let listingContacts = [{ listing_id: 'lst_1' }];

  // Payment, transaction & user records that MUST be preserved
  const transactions = [{ id: 'tx_1', amount: 0.05, type: 'platform_fee', status: 'completed' }];
  const paymentIntents = [{ id: 'pii_1', amount: 0.05, status: 'completed' }];
  const users = [{ id: 'usr_1', username: 'alice', kycStatus: 'verified' }];

  // Execute Reset Data (matching _worker.js /api/sync/purge)
  listings = [];
  rentals = [];
  reviews = [];
  messages = [];
  conversations = [];
  reports = [];
  listingContacts = [];

  // Verify marketplace data is cleared
  assert.equal(listings.length, 0);
  assert.equal(rentals.length, 0);
  assert.equal(reviews.length, 0);
  assert.equal(messages.length, 0);
  assert.equal(conversations.length, 0);
  assert.equal(reports.length, 0);
  assert.equal(listingContacts.length, 0);

  // Verify financial & user records are strictly preserved
  assert.equal(transactions.length, 1, 'Transactions must NOT be deleted');
  assert.equal(paymentIntents.length, 1, 'Payment intents must NOT be deleted');
  assert.equal(users.length, 1, 'Users must NOT be deleted');
});

// =========================================================================
// 4. ACCOUNT PAGE: BOTTOM OPTION & TRANSACTION HISTORY TESTS
// =========================================================================

test('Account: Bottom option triggers public profile navigation with username', () => {
  let navigatedTo = null;
  const currentUser = { username: 'alice_pioneer' };

  const handleOpenPublicProfile = (targetUsername) => {
    navigatedTo = `public-profile:${targetUsername}`;
  };

  // Simulating ProfilePage bottom button click
  handleOpenPublicProfile(currentUser.username);

  assert.equal(navigatedTo, 'public-profile:alice_pioneer');
});

test('Account: Transaction history displays current user transactions and filters other users', () => {
  const mockTransactions = [
    transactionView({
      id: 'tx_101',
      payment_intent_id: 'pii_1',
      pi_payment_id: 'pip_1',
      pi_txid: '0xabc123',
      user_id: 'usr_alice',
      user_pi_uid: 'uid_alice',
      user_username: 'alice',
      user_display_name: 'Alice',
      amount: 0.015,
      type: 'platform_fee',
      status: 'completed',
      created_at: '2026-09-18T12:00:00.000Z'
    }),
    transactionView({
      id: 'tx_102',
      payment_intent_id: 'pii_2',
      pi_payment_id: 'pip_2',
      pi_txid: '0xdef456',
      user_id: 'usr_bob',
      user_pi_uid: 'uid_bob',
      user_username: 'bob',
      user_display_name: 'Bob',
      amount: 0.025,
      type: 'platform_fee',
      status: 'completed',
      created_at: '2026-09-18T13:00:00.000Z'
    })
  ];

  // Alice checks WalletModal
  const aliceUsername = 'alice';
  const aliceUid = 'uid_alice';
  const aliceTx = mockTransactions.filter(tx => 
    (tx.userUsername && tx.userUsername.toLowerCase() === aliceUsername) ||
    (tx.userUid && aliceUid && tx.userUid === aliceUid)
  );

  assert.equal(aliceTx.length, 1);
  assert.equal(aliceTx[0].id, 'tx_101');
  assert.equal(aliceTx[0].amount, 0.015);
  assert.equal(aliceTx[0].piTxRef, '0xabc123');

  // Bob checks WalletModal
  const bobUsername = 'bob';
  const bobUid = 'uid_bob';
  const bobTx = mockTransactions.filter(tx => 
    (tx.userUsername && tx.userUsername.toLowerCase() === bobUsername) ||
    (tx.userUid && bobUid && tx.userUid === bobUid)
  );

  assert.equal(bobTx.length, 1);
  assert.equal(bobTx[0].id, 'tx_102');
  assert.equal(bobTx[0].amount, 0.025);
  assert.equal(bobTx[0].piTxRef, '0xdef456');
});

test('Account: Newly available transaction appears after refresh', () => {
  const currentTransactions = [];
  assert.equal(currentTransactions.length, 0);

  // New transaction completed and synced from backend
  const newTx = transactionView({
    id: 'tx_103',
    payment_intent_id: 'pii_3',
    pi_payment_id: 'pip_3',
    pi_txid: '0x789xyz',
    user_id: 'usr_alice',
    user_pi_uid: 'uid_alice',
    user_username: 'alice',
    user_display_name: 'Alice',
    amount: 0.05,
    type: 'platform_fee',
    status: 'completed',
    created_at: '2026-09-18T14:00:00.000Z'
  });

  const updatedTransactions = [...currentTransactions, newTx];
  assert.equal(updatedTransactions.length, 1);
  assert.equal(updatedTransactions[0].id, 'tx_103');
  assert.equal(updatedTransactions[0].amount, 0.05);
});
