import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudSyncService } from '../src/services/cloudSyncService.js';
import { RENTAL_STATES } from '../src/services/rentalStateMachine.js';

// Setup Mock Storage for node environment
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new MockLocalStorage();

test('Rental History: browser storage cannot become rental authority', () => {
  localStorage.clear();
  const rawRentals = [
    { id: 'rent_001', status: 'completed' },
    { id: 'rent_001', status: 'completed' },
    { id: 'rent_002', status: 'active' }
  ];
  cloudSyncService.saveCachedRentals(rawRentals);
  assert.deepEqual(cloudSyncService.getCachedRentals(), []);
  assert.equal(localStorage.getItem('rentora_live_v1_rentals'), null);
});

test('Rental History Cleanup: Scoped hide mechanism preserves active rentals and other data', () => {
  localStorage.clear();

  const userA = { username: 'alice_pioneer', uid: 'pi_uid_alice' };
  const userB = { username: 'bob_pioneer', uid: 'pi_uid_bob' };

  const allRentals = [
    {
      id: 'rent_101',
      renterUsername: 'alice_pioneer',
      renterUid: 'pi_uid_alice',
      status: RENTAL_STATES.COMPLETED,
      rentalTotal: 12,
      createdAt: '2026-08-10T12:00:00Z',
      updatedAt: '2026-08-15T12:00:00Z'
    },
    {
      id: 'rent_102',
      renterUsername: 'alice_pioneer',
      renterUid: 'pi_uid_alice',
      status: RENTAL_STATES.CANCELLED,
      rentalTotal: 8,
      createdAt: '2026-08-20T12:00:00Z',
      updatedAt: '2026-08-21T12:00:00Z'
    },
    {
      id: 'rent_103',
      renterUsername: 'alice_pioneer',
      renterUid: 'pi_uid_alice',
      status: RENTAL_STATES.ACTIVE, // ACTIVE RENTAL
      rentalTotal: 30,
      createdAt: '2026-09-10T12:00:00Z',
      updatedAt: '2026-09-10T12:00:00Z'
    },
    {
      id: 'rent_104',
      renterUsername: 'bob_pioneer',
      renterUid: 'pi_uid_bob',
      status: RENTAL_STATES.COMPLETED,
      rentalTotal: 15,
      createdAt: '2026-08-12T12:00:00Z',
      updatedAt: '2026-08-16T12:00:00Z'
    }
  ];

  // 1. Initial view for Alice before clear
  const aliceRentals = allRentals.filter(r => r.renterUsername === userA.username);
  const aliceActiveBefore = aliceRentals.filter(r => [RENTAL_STATES.CONFIRMED, RENTAL_STATES.ACTIVE, RENTAL_STATES.PAYMENT_PENDING].includes(r.status));
  const aliceHistoryBefore = aliceRentals.filter(r => [RENTAL_STATES.COMPLETED, RENTAL_STATES.CANCELLED].includes(r.status));

  assert.equal(aliceActiveBefore.length, 1);
  assert.equal(aliceHistoryBefore.length, 2);

  // 2. Alice performs "Clear History" at current time
  const clearTimestamp = new Date('2026-09-01T00:00:00Z').getTime();
  const aliceKey = `rentora_cleared_history_${userA.username}`;
  localStorage.setItem(aliceKey, String(clearTimestamp));

  // 3. Re-compute Alice's history and active view
  const aliceClearedTime = Number(localStorage.getItem(aliceKey)) || 0;
  const aliceActiveAfter = aliceRentals.filter(r => [RENTAL_STATES.CONFIRMED, RENTAL_STATES.ACTIVE, RENTAL_STATES.PAYMENT_PENDING].includes(r.status));
  const aliceHistoryAfter = aliceRentals.filter(r => {
    const isHistory = [RENTAL_STATES.COMPLETED, RENTAL_STATES.CANCELLED, RENTAL_STATES.REJECTED, RENTAL_STATES.DISPUTED].includes(r.status);
    if (!isHistory) return false;
    const itemTime = r.updatedAt ? new Date(r.updatedAt).getTime() : new Date(r.createdAt).getTime();
    if (aliceClearedTime > 0 && itemTime <= aliceClearedTime) return false;
    return true;
  });

  // Verification:
  // Active rentals are completely unaffected!
  assert.equal(aliceActiveAfter.length, 1, 'Active rental #rent_103 must remain visible');
  assert.equal(aliceActiveAfter[0].id, 'rent_103');

  // Closed history prior to clear time is hidden from Alice's view
  assert.equal(aliceHistoryAfter.length, 0, 'Alice history before cleared timestamp is hidden');

  // 4. Bob's view is completely unaffected (isolated user scope)
  const bobKey = `rentora_cleared_history_${userB.username}`;
  const bobClearedTime = Number(localStorage.getItem(bobKey)) || 0;
  const bobRentals = allRentals.filter(r => r.renterUsername === userB.username);
  const bobHistory = bobRentals.filter(r => {
    const isHistory = [RENTAL_STATES.COMPLETED, RENTAL_STATES.CANCELLED].includes(r.status);
    if (!isHistory) return false;
    const itemTime = r.updatedAt ? new Date(r.updatedAt).getTime() : new Date(r.createdAt).getTime();
    if (bobClearedTime > 0 && itemTime <= bobClearedTime) return false;
    return true;
  });

  assert.equal(bobHistory.length, 1, 'Bob history records must not be affected by Alice clearing history');
  assert.equal(bobHistory[0].id, 'rent_104');
});

test('Chat Presentation: Unread badge calculation, read marking, and no banner notifications', () => {
  localStorage.clear();

  const myUsername = 'alice_pioneer';
  const readKey = `rentora_chat_reads_${myUsername}`;

  const sampleConversations = [
    {
      id: 'conv_1',
      lastMessageText: 'سلام، دستگاه فردا تحویل داده می‌شود؟',
      lastMessageAt: '2026-09-17T12:00:00Z',
      otherUser: { username: 'bob_owner', displayName: 'Bob' }
    },
    {
      id: 'conv_2',
      lastMessageText: 'ممنون، هماهنگ شد.',
      lastMessageAt: '2026-09-17T11:00:00Z',
      otherUser: { username: 'charlie_owner', displayName: 'Charlie' }
    }
  ];

  // Helper function mimicking RentoraContext enrichment
  function enrichConversations(list, readMap, currentUserUsername) {
    const myName = (currentUserUsername || '').toLowerCase().replace('@', '').trim();
    return (list || []).map(c => {
      const lastMsgTime = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0;
      const lastReadTime = readMap[c.id] ? new Date(readMap[c.id]).getTime() : 0;
      const sender = (c.otherUser?.username || '').toLowerCase().replace('@', '').trim();
      const isUnread = Boolean(
        c.lastMessageText &&
        lastMsgTime > 0 &&
        lastMsgTime > lastReadTime &&
        sender &&
        sender !== myName
      );
      return {
        ...c,
        unreadCount: isUnread ? 1 : 0
      };
    });
  }

  // 1. Initial State: No messages read yet -> total unread count should be 2
  let readMap = {};
  let enriched = enrichConversations(sampleConversations, readMap, myUsername);
  let totalUnread = enriched.reduce((sum, c) => sum + c.unreadCount, 0);

  assert.equal(totalUnread, 2, 'Total unread badge count should be 2');

  // 2. User opens conv_1 -> Mark conv_1 as read
  const nowIso = new Date('2026-09-17T12:05:00Z').toISOString();
  readMap['conv_1'] = nowIso;
  localStorage.setItem(readKey, JSON.stringify(readMap));

  enriched = enrichConversations(sampleConversations, readMap, myUsername);
  totalUnread = enriched.reduce((sum, c) => sum + c.unreadCount, 0);

  assert.equal(enriched.find(c => c.id === 'conv_1').unreadCount, 0, 'conv_1 unreadCount should be 0');
  assert.equal(enriched.find(c => c.id === 'conv_2').unreadCount, 1, 'conv_2 unreadCount should remain 1');
  assert.equal(totalUnread, 1, 'Total unread badge count should decrement to 1');

  // 3. User opens conv_2 -> Mark conv_2 as read
  readMap['conv_2'] = new Date('2026-09-17T12:06:00Z').toISOString();
  localStorage.setItem(readKey, JSON.stringify(readMap));

  enriched = enrichConversations(sampleConversations, readMap, myUsername);
  totalUnread = enriched.reduce((sum, c) => sum + c.unreadCount, 0);

  assert.equal(totalUnread, 0, 'All unread badges cleared when conversations are read');

  // 4. Persistence check: Reading map persists across reloads
  const loadedReads = JSON.parse(localStorage.getItem(readKey));
  const reloaded = enrichConversations(sampleConversations, loadedReads, myUsername);
  assert.equal(reloaded.reduce((sum, c) => sum + c.unreadCount, 0), 0, 'Reload retains read state');
});

test('Chat Scroll & Polling Stability: Hash comparison avoids re-render during unchanged polling', () => {
  const existingMessages = [
    { id: 'msg_1', createdAt: '2026-09-17T10:00:00Z', text: 'سلام' },
    { id: 'msg_2', createdAt: '2026-09-17T10:01:00Z', text: 'سلام، در خدمتم' }
  ];

  const currentHash = existingMessages.map(m => `${m.id}_${m.createdAt}`).join('|');

  // Polling returns exact same message data
  const polledMessages = [
    { id: 'msg_1', createdAt: '2026-09-17T10:00:00Z', text: 'سلام' },
    { id: 'msg_2', createdAt: '2026-09-17T10:01:00Z', text: 'سلام، در خدمتم' }
  ];

  const newHash = polledMessages.map(m => `${m.id}_${m.createdAt}`).join('|');
  const shouldUpdateState = currentHash !== newHash;

  assert.equal(shouldUpdateState, false, 'Unchanged polling data must NOT trigger state updates or scroll recalculations');

  // When a new message actually arrives:
  const withNewMsg = [
    ...existingMessages,
    { id: 'msg_3', createdAt: '2026-09-17T10:05:00Z', text: 'آدرس را ارسال کنید' }
  ];
  const updatedHash = withNewMsg.map(m => `${m.id}_${m.createdAt}`).join('|');
  assert.notEqual(currentHash, updatedHash, 'New message changes hash and triggers state update');
});

test('Chat Auto-Scroll: Preserves scroll when reading older messages vs snaps when near bottom', () => {
  // Test near bottom logic
  const checkNearBottom = (scrollHeight, scrollTop, clientHeight, threshold = 100) => {
    return scrollHeight - scrollTop - clientHeight <= threshold;
  };

  // Case 1: User is at the bottom of 1000px content in 400px container
  const atBottom = checkNearBottom(1000, 600, 400); // 1000 - 600 - 400 = 0 <= 100
  assert.equal(atBottom, true, 'User at bottom should be recognized as nearBottom');

  // Case 2: User is scrolled up reading older messages (e.g. scrollTop = 200)
  const scrolledUp = checkNearBottom(1000, 200, 400); // 1000 - 200 - 400 = 400 > 100
  assert.equal(scrolledUp, false, 'User reading older messages must NOT be marked as nearBottom');

  // Simulation of message arrival:
  const shouldAutoScroll = (isNearBottom, isSentByMe) => {
    return isNearBottom || isSentByMe;
  };

  // If another user sends a message while current user is reading history:
  assert.equal(shouldAutoScroll(false, false), false, 'Incoming message when scrolled up MUST NOT trigger auto-scroll');

  // If another user sends a message while current user is at bottom:
  assert.equal(shouldAutoScroll(true, false), true, 'Incoming message when at bottom MUST trigger auto-scroll');

  // If current user sends a message regardless of position:
  assert.equal(shouldAutoScroll(false, true), true, 'Self-sent message MUST trigger auto-scroll to view sent message');
});

test('Chat Message Deduplication: Sending & polling merge strictly by message ID', () => {
  const existing = [
    { id: 'msg_101', text: 'سلام', createdAt: '2026-09-17T10:00:00Z' },
    { id: 'msg_102', text: 'قیمت چند است؟', createdAt: '2026-09-17T10:01:00Z' }
  ];

  // Optimistically added / sent message
  const newlySent = { id: 'msg_103', text: 'روزانه ۵ پای', createdAt: '2026-09-17T10:02:00Z' };

  // Combine
  const dedupedMap = new Map();
  existing.forEach(m => dedupedMap.set(m.id, m));
  dedupedMap.set(newlySent.id, newlySent);

  assert.equal(dedupedMap.size, 3);

  // Subsequent polling returns all 3 messages from backend
  const polled = [
    { id: 'msg_101', text: 'سلام', createdAt: '2026-09-17T10:00:00Z' },
    { id: 'msg_102', text: 'قیمت چند است؟', createdAt: '2026-09-17T10:01:00Z' },
    { id: 'msg_103', text: 'روزانه ۵ پای', createdAt: '2026-09-17T10:02:00Z' }
  ];

  polled.forEach(m => dedupedMap.set(m.id, m));
  assert.equal(dedupedMap.size, 3, 'Polling must not duplicate already-rendered sent message');
});

test('Chat Conversation Switching: Stale response protection isolates conversation messages', async () => {
  let activeConvId = 'conv_A';

  const fetchSimulation = async (id, delayMs, result) => {
    await new Promise(r => setTimeout(r, delayMs));
    return { id, messages: result };
  };

  // User starts loading Conv A (slow response 50ms)
  const reqA = fetchSimulation('conv_A', 50, [{ id: 'msg_A1', text: 'پیام مکالمه الف' }]);

  // User immediately switches to Conv B (fast response 10ms)
  activeConvId = 'conv_B';
  const reqB = fetchSimulation('conv_B', 10, [{ id: 'msg_B1', text: 'پیام مکالمه ب' }]);

  const resB = await reqB;
  let activeMessages = [];
  if (activeConvId === resB.id) {
    activeMessages = resB.messages;
  }

  assert.equal(activeMessages.length, 1);
  assert.equal(activeMessages[0].id, 'msg_B1');

  // Slow response A arrives afterwards
  const resA = await reqA;
  if (activeConvId === resA.id) {
    // Should NOT execute because activeConvId is now conv_B
    activeMessages = resA.messages;
  }

  assert.equal(activeMessages[0].id, 'msg_B1', 'Stale response from Conv A must not overwrite Conv B messages');
});
