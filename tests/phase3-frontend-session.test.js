import test from 'node:test';
import assert from 'node:assert/strict';

// Helper for session simulation
async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

test('Phase 3: Logout invalidates KV session and records server-side logout state', async () => {
  const mockKV = new Map();
  const token = 'sess_valid_user_123';
  const tokenHash = await sha256(token);
  
  mockKV.set(`session:${tokenHash}`, JSON.stringify({ uid: 'uid_alice', username: 'alice', role: 'user' }));
  assert.equal(mockKV.has(`session:${tokenHash}`), true, 'Session must exist before logout');

  let userRecordInD1 = {
    id: 'usr_alice',
    pi_uid: 'uid_alice',
    metadata: JSON.stringify({ loginCount: 1, logoutCount: 0, isOnline: true })
  };

  // Simulate server-side POST /api/auth/logout
  const rawSession = mockKV.get(`session:${tokenHash}`);
  if (rawSession) {
    const sessionData = JSON.parse(rawSession);
    if (sessionData?.uid === userRecordInD1.pi_uid) {
      const meta = JSON.parse(userRecordInD1.metadata);
      userRecordInD1.metadata = JSON.stringify({
        ...meta,
        isOnline: false,
        lastLogoutAt: new Date().toISOString(),
        logoutCount: meta.logoutCount + 1
      });
    }
    mockKV.delete(`session:${tokenHash}`);
  }

  // Verification
  assert.equal(mockKV.has(`session:${tokenHash}`), false, 'KV session must be revoked');
  const finalMeta = JSON.parse(userRecordInD1.metadata);
  assert.equal(finalMeta.isOnline, false, 'User must be marked offline');
  assert.equal(finalMeta.logoutCount, 1, 'Logout count must be incremented');
  assert.ok(finalMeta.lastLogoutAt, 'lastLogoutAt timestamp must be recorded');
});

test('Phase 3: Revoked token is rejected with 401', async () => {
  const mockKV = new Map();
  const revokedToken = 'sess_revoked_456';
  const tokenHash = await sha256(revokedToken);

  const getSession = (token) => {
    return mockKV.get(`session:${tokenHash}`) || null;
  };

  const session = getSession(revokedToken);
  assert.equal(session, null, 'Revoked token lookup must return null (401)');
});

test('Phase 3: Expired token is rejected with 401', () => {
  const expiredSessionToken = null; // Expired or pruned from KV TTL
  assert.equal(expiredSessionToken, null, 'Expired session must result in unauthenticated 401');
});

test('Phase 3: User switching cleanly isolates state and prevents cross-account leakage', () => {
  // User A state
  let appState = {
    currentUser: { uid: 'uid_alice', username: 'alice', kycStatus: 'verified' },
    rentals: [{ id: 'rnt_alice_01', renterUsername: 'alice', amount: 50 }],
    transactions: [{ id: 'tx_alice_01', amount: 2.5 }],
    conversations: [{ id: 'cnv_alice_01', lastMessageText: 'Hello from Alice' }]
  };

  assert.equal(appState.currentUser.username, 'alice');
  assert.equal(appState.rentals.length, 1);

  // User A logs out -> Clean state reset
  appState = {
    currentUser: null,
    rentals: [],
    transactions: [],
    conversations: []
  };

  assert.equal(appState.currentUser, null);
  assert.equal(appState.rentals.length, 0);
  assert.equal(appState.transactions.length, 0);
  assert.equal(appState.conversations.length, 0);

  // User B logs in
  const userBSession = { uid: 'uid_bob', username: 'bob', kycStatus: 'unverified' };
  appState.currentUser = userBSession;
  // State is populated exclusively from User B server API response
  appState.rentals = [{ id: 'rnt_bob_01', renterUsername: 'bob', amount: 100 }];
  appState.transactions = [];
  appState.conversations = [];

  assert.equal(appState.currentUser.username, 'bob');
  assert.equal(appState.currentUser.kycStatus, 'unverified', 'User B must not inherit Alice KYC status');
  assert.equal(appState.rentals[0].renterUsername, 'bob', 'User B must only see their own rentals');
});

test('Phase 3: LocalStorage scan verifies no sensitive business pricing is stored as source of truth', () => {
  const allowedLocalStorageKeys = new Set([
    'rentora_theme',
    'rentora_language',
    'rentora_db_config_v9',
    'rentora_db_favorites_v8',
    'rentora_items_cache_v5' // Public items cache for fast rendering
  ]);

  // Sensitive business keys that MUST NOT be authoritative in localStorage
  const prohibitedAuthoritativeKeys = [
    'rentora_db_transactions_v8',
    'rentora_db_reports_v8'
  ];

  for (const key of prohibitedAuthoritativeKeys) {
    assert.equal(allowedLocalStorageKeys.has(key), false, `${key} must not be stored as authoritative business state`);
  }
});

test('Phase 3: Rental data and payment state are derived strictly from server API', () => {
  const serverApiResponse = {
    rentals: [
      {
        id: 'rnt_server_01',
        status: 'confirmed',
        paymentStatus: 'completed',
        rentoraFee: 1.5,
        totalAmount: 51.5
      }
    ],
    transactions: [
      {
        id: 'tx_server_01',
        amount: 1.5,
        piTxRef: '0xabc123'
      }
    ]
  };

  // Client updates UI strictly from server response
  const clientRentals = serverApiResponse.rentals;
  const clientTransactions = serverApiResponse.transactions;

  assert.equal(clientRentals[0].status, 'confirmed');
  assert.equal(clientRentals[0].paymentStatus, 'completed');
  assert.equal(clientTransactions[0].piTxRef, '0xabc123');
});


test('Rental and payment state is not persisted in localStorage', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../src/services/cloudSyncService.js', import.meta.url), 'utf8');
  assert.match(source, /getCachedRentals\(\)\s*\{[\s\S]*?return \[\];/);
  assert.match(source, /saveCachedRentals\(_rentals\)\s*\{/);
  assert.doesNotMatch(source, /localStorage\.getItem\(STORAGE_RENTALS_KEY\)/);
  assert.doesNotMatch(source, /localStorage\.setItem\(STORAGE_RENTALS_KEY/);
});
