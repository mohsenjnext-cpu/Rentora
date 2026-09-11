/**
 * Universal Cloud Sync Service for Rentora Marketplace
 * Real-time synchronization across devices, tabs, and Pi Browser sessions.
 */
import { getApiBaseUrl } from './apiConfig';

const STORAGE_ITEMS_KEY = 'rentora_live_v1_items';
const STORAGE_RENTALS_KEY = 'rentora_live_v1_rentals';
const STORAGE_USERS_KEY = 'rentora_live_v1_users_dir';
const STORAGE_REVIEWS_KEY = 'rentora_live_v1_reviews';
const STORAGE_CHATS_KEY = 'rentora_live_v1_chats';
const STORAGE_USER_KEY = 'rentora_live_v1_session';

export class CloudSyncService {
  constructor() {
    this.subscribers = [];
    this.pollInterval = null;
    this.broadcastChannel = null;
    this.lastSyncedHash = '';

    // Initialize cross-tab BroadcastChannel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('rentora_cross_device_bus');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type) {
            this.handleIncomingBroadcast(event.data);
          }
        };
      } catch (e) {}
    }

    this.initInternalPolling();
  }

  handleIncomingBroadcast(payload) {
    const { type, data } = payload;
    if (type === 'NEW_ITEM' && data) {
      const items = this.getCachedItems();
      const updated = [data, ...items.filter(i => i.id !== data.id)];
      this.saveCachedItems(updated);
      this.notifySubscribers('ITEM_ADDED', { items: updated, item: data });
    } else if (type === 'USER_PROFILE' && data) {
      const users = this.getCachedUsers();
      const updated = [data, ...users.filter(u => u.username?.toLowerCase() !== data.username?.toLowerCase())];
      this.saveCachedUsers(updated);
      this.notifySubscribers('USER_SYNC', { users: updated, user: data });
    } else if (type === 'RENTAL_UPDATE' && data) {
      const rentals = this.getCachedRentals();
      const updated = [data, ...rentals.filter(r => r.id !== data.id)];
      this.saveCachedRentals(updated);
      this.notifySubscribers('RENTAL_SYNC', { rentals: updated, rental: data });
    } else if (type === 'REVIEW_ADDED' && data) {
      const reviews = this.getCachedReviews();
      const updated = [data, ...reviews.filter(r => r.id !== data.id)];
      this.saveCachedReviews(updated);
      this.notifySubscribers('REVIEW_SYNC', { reviews: updated, review: data });
    } else if (type === 'CHAT_UPDATE' && data) {
      const chats = this.getCachedChats();
      const existingIdx = chats.findIndex(c => c.id === data.id);
      let updated;
      if (existingIdx !== -1) {
        updated = [...chats];
        updated[existingIdx] = data;
      } else {
        updated = [data, ...chats];
      }
      this.saveCachedChats(updated);
      this.notifySubscribers('CHAT_SYNC', { chats: updated, chat: data });
    } else if (type === 'CHAT_DELETED' && data && data.id) {
      const chats = this.getCachedChats();
      const updated = chats.filter(c => c.id !== data.id);
      this.saveCachedChats(updated);
      this.notifySubscribers('CHAT_DELETED', { chats: updated, threadId: data.id });
    }
  }

  getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
      if (typeof localStorage !== 'undefined') {
        const userRaw = localStorage.getItem(STORAGE_USER_KEY);
        if (userRaw) {
          const u = JSON.parse(userRaw);
          if (u.uid) headers['x-pi-uid'] = u.uid;
          if (u.username) headers['x-pi-username'] = u.username;
        }
      }
    } catch (e) {}
    return headers;
  }

  async broadcastUserProfile(userObj) {
    if (!userObj || !userObj.username) return false;
    
    // 1. Save to local cache
    const cachedUsers = this.getCachedUsers();
    const updatedUsers = [userObj, ...cachedUsers.filter(u => u.username?.toLowerCase() !== userObj.username?.toLowerCase())];
    this.saveCachedUsers(updatedUsers);

    // 2. Broadcast via BroadcastChannel
    try {
      this.broadcastChannel?.postMessage({ type: 'USER_PROFILE', data: userObj });
    } catch (e) {}

    // 3. Broadcast to remote Cloudflare backend
    const apiBase = getApiBaseUrl();
    if (apiBase) {
      try {
        const res = await fetch(`${apiBase}/api/sync/user`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(userObj)
        });
        return res.ok;
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  async broadcastNewItem(item) {
    if (!item || !item.id) return false;

    // 1. Save to local cache
    const cached = this.getCachedItems();
    const updated = [item, ...cached.filter(i => i.id !== item.id)];
    this.saveCachedItems(updated);

    // 2. Broadcast via BroadcastChannel
    try {
      this.broadcastChannel?.postMessage({ type: 'NEW_ITEM', data: item });
    } catch (e) {}

    // 3. Broadcast to Cloudflare Backend
    const apiBase = getApiBaseUrl();
    if (apiBase) {
      try {
        const res = await fetch(`${apiBase}/api/sync/item`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(item)
        });
        return res.ok;
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  async broadcastNewRental(rental) {
    if (!rental || !rental.id) return false;

    const cached = this.getCachedRentals();
    const updated = [rental, ...cached.filter(r => r.id !== rental.id)];
    this.saveCachedRentals(updated);

    try {
      this.broadcastChannel?.postMessage({ type: 'RENTAL_UPDATE', data: rental });
    } catch (e) {}

    const apiBase = getApiBaseUrl();
    if (apiBase) {
      try {
        const res = await fetch(`${apiBase}/api/sync/rental`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(rental)
        });
        return res.ok;
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  async broadcastRentalUpdate(rental) {
    return this.broadcastNewRental(rental);
  }

  async broadcastReview(review) {
    if (!review || !review.id) return false;

    const cached = this.getCachedReviews();
    const updated = [review, ...cached.filter(r => r.id !== review.id)];
    this.saveCachedReviews(updated);

    try {
      this.broadcastChannel?.postMessage({ type: 'REVIEW_ADDED', data: review });
    } catch (e) {}

    const apiBase = getApiBaseUrl();
    if (apiBase) {
      try {
        const res = await fetch(`${apiBase}/api/sync/review`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(review)
        });
        return res.ok;
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  async broadcastChatMessage(chatThread) {
    if (!chatThread || !chatThread.id) return false;

    const cached = this.getCachedChats();
    const existingIdx = cached.findIndex(c => c.id === chatThread.id);
    let updated;
    if (existingIdx !== -1) {
      updated = [...cached];
      updated[existingIdx] = chatThread;
    } else {
      updated = [chatThread, ...cached];
    }
    this.saveCachedChats(updated);

    try {
      this.broadcastChannel?.postMessage({ type: 'CHAT_UPDATE', data: chatThread });
    } catch (e) {}

    const apiBase = getApiBaseUrl();
    if (apiBase) {
      try {
        const res = await fetch(`${apiBase}/api/sync/chat`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(chatThread)
        });
        return res.ok;
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  async deleteChatThread(threadId) {
    if (!threadId) return false;

    const cached = this.getCachedChats();
    const updated = cached.filter(c => c.id !== threadId);
    this.saveCachedChats(updated);

    try {
      this.broadcastChannel?.postMessage({ type: 'CHAT_DELETED', data: { id: threadId } });
    } catch (e) {}

    const apiBase = getApiBaseUrl();
    if (apiBase) {
      try {
        const res = await fetch(`${apiBase}/api/sync/chat/delete`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ id: threadId })
        });
        return res.ok;
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  async fetchSharedData() {
    const localItems = this.getCachedItems();
    const localRentals = this.getCachedRentals();
    const localUsers = this.getCachedUsers();
    const localReviews = this.getCachedReviews();
    const localChats = this.getCachedChats();

    const apiBase = getApiBaseUrl();
    if (!apiBase) {
      return {
        items: localItems,
        rentals: localRentals,
        users: localUsers,
        reviews: localReviews,
        chats: localChats,
        transactions: []
      };
    }

    try {
      const res = await fetch(`${apiBase}/api/sync/all`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        
        // 1. Merge items
        const remoteItems = Array.isArray(data.items) ? data.items : [];
        const mergedItemsMap = new Map();
        localItems.forEach(i => mergedItemsMap.set(i.id, i));
        remoteItems.forEach(i => mergedItemsMap.set(i.id, i));
        const mergedItems = Array.from(mergedItemsMap.values());
        this.saveCachedItems(mergedItems);

        // 2. Merge rentals
        const remoteRentals = Array.isArray(data.rentals) ? data.rentals : [];
        const mergedRentalsMap = new Map();
        localRentals.forEach(r => mergedRentalsMap.set(r.id, r));
        remoteRentals.forEach(r => mergedRentalsMap.set(r.id, r));
        const mergedRentals = Array.from(mergedRentalsMap.values());
        this.saveCachedRentals(mergedRentals);

        // 3. Merge users
        const remoteUsers = Array.isArray(data.users) ? data.users : [];
        const mergedUsersMap = new Map();
        localUsers.forEach(u => {
          if (u.username) mergedUsersMap.set(u.username.toLowerCase(), u);
        });
        remoteUsers.forEach(u => {
          if (u.username) {
            const existing = mergedUsersMap.get(u.username.toLowerCase());
            mergedUsersMap.set(u.username.toLowerCase(), { ...existing, ...u });
          }
        });
        const mergedUsers = Array.from(mergedUsersMap.values());
        this.saveCachedUsers(mergedUsers);

        // 4. Merge reviews
        const remoteReviews = Array.isArray(data.reviews) ? data.reviews : [];
        const mergedReviewsMap = new Map();
        localReviews.forEach(r => mergedReviewsMap.set(r.id, r));
        remoteReviews.forEach(r => mergedReviewsMap.set(r.id, r));
        const mergedReviews = Array.from(mergedReviewsMap.values());
        this.saveCachedReviews(mergedReviews);

        // 5. Merge chats (Cross-Phone Real-Time Chat sync)
        const remoteChats = Array.isArray(data.chats) ? data.chats : [];
        const mergedChatsMap = new Map();
        localChats.forEach(c => mergedChatsMap.set(c.id, c));
        remoteChats.forEach(rc => {
          const local = mergedChatsMap.get(rc.id);
          if (!local) {
            mergedChatsMap.set(rc.id, rc);
          } else {
            // Merge messages if remote has newer or more messages
            const combinedMsgs = [...(local.messages || [])];
            (rc.messages || []).forEach(rm => {
              if (!combinedMsgs.some(m => m.id === rm.id)) {
                combinedMsgs.push(rm);
              }
            });
            mergedChatsMap.set(rc.id, {
              ...local,
              ...rc,
              messages: combinedMsgs
            });
          }
        });
        const mergedChats = Array.from(mergedChatsMap.values());
        this.saveCachedChats(mergedChats);

        return {
          items: mergedItems,
          rentals: mergedRentals,
          users: mergedUsers,
          reviews: mergedReviews,
          chats: mergedChats,
          transactions: data.transactions || []
        };
      }
    } catch (e) {
      console.warn('[Sync Error]', e.message);
    }

    return {
      items: localItems,
      rentals: localRentals,
      users: localUsers,
      reviews: localReviews,
      chats: localChats,
      transactions: []
    };
  }

  initInternalPolling() {
    if (typeof window === 'undefined') return;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    // Polling every 12s for active sync
    this.pollInterval = setInterval(async () => {
      const apiBase = getApiBaseUrl();
      if (!apiBase) return;

      try {
        const data = await this.fetchSharedData();
        const currentHash = `${data.items.length}_${data.users.length}_${data.rentals.length}_${data.reviews.length}_${data.chats.length}`;
        if (currentHash !== this.lastSyncedHash) {
          this.lastSyncedHash = currentHash;
          this.notifySubscribers('DATA_SYNC', data);
        }
      } catch (e) {}
    }, 12000);
  }

  getCachedItems() {
    try {
      const saved = localStorage.getItem(STORAGE_ITEMS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  saveCachedItems(items) {
    try {
      localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(items || []));
    } catch (e) {}
  }

  getCachedRentals() {
    try {
      const saved = localStorage.getItem(STORAGE_RENTALS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  saveCachedRentals(rentals) {
    try {
      localStorage.setItem(STORAGE_RENTALS_KEY, JSON.stringify(rentals || []));
    } catch (e) {}
  }

  getCachedUsers() {
    try {
      const saved = localStorage.getItem(STORAGE_USERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  saveCachedUsers(users) {
    try {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users || []));
    } catch (e) {}
  }

  getCachedReviews() {
    try {
      const saved = localStorage.getItem(STORAGE_REVIEWS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  saveCachedReviews(reviews) {
    try {
      localStorage.setItem(STORAGE_REVIEWS_KEY, JSON.stringify(reviews || []));
    } catch (e) {}
  }

  getCachedChats() {
    try {
      const saved = localStorage.getItem(STORAGE_CHATS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  saveCachedChats(chats) {
    try {
      localStorage.setItem(STORAGE_CHATS_KEY, JSON.stringify(chats || []));
    } catch (e) {}
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  notifySubscribers(type, payload) {
    this.subscribers.forEach(cb => {
      try { cb(type, payload); } catch (e) {}
    });
  }
}

export const cloudSync = new CloudSyncService();
export const cloudSyncService = cloudSync;
