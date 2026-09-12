/**
 * Universal Cloud Sync Service for Rentora Marketplace
 * Real-time synchronization across devices, tabs, and Pi Browser sessions.
 */
import { getApiBaseUrl } from './apiConfig.js';

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
    if (typeof window !== 'undefined') {
      if ('BroadcastChannel' in window) {
        try {
          this.broadcastChannel = new BroadcastChannel('rentora_cross_device_bus');
          this.broadcastChannel.onmessage = (event) => {
            if (event.data && event.data.type) {
              this.handleIncomingBroadcast(event.data);
            }
          };
        } catch (e) {}
      }

      // Android Emulator & Mobile App Focus / Visibility Handlers:
      // When switching back from emulator or background tab, trigger immediate instant sync
      try {
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            this.fetchSharedData(true).catch(() => {});
          }
        });
        window.addEventListener('focus', () => {
          this.fetchSharedData(true).catch(() => {});
        });
        window.addEventListener('pageshow', () => {
          this.fetchSharedData(true).catch(() => {});
        });
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
      const p1 = (data.ownerUsername || '').toLowerCase();
      const p2 = (data.renterUsername || '').toLowerCase();

      const existingIdx = chats.findIndex(c => {
        if (c.id === data.id) return true;
        const u1 = (c.ownerUsername || '').toLowerCase();
        const u2 = (c.renterUsername || '').toLowerCase();
        if (p1 && p2 && u1 && u2) {
          return (u1 === p1 && u2 === p2) || (u1 === p2 && u2 === p1);
        }
        return false;
      });

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
          if (u.sessionToken) {
            headers['Authorization'] = `Bearer ${u.sessionToken}`;
          }
        }
      }
    } catch (e) {}
    return headers;
  }

  async compressImage(file, maxWidth = 800, quality = 0.7) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type?.toLowerCase())) {
      throw new Error('فقط فرمت‌های تصویری JPEG، PNG و WebP مجاز هستند.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('حجم تصویر نباید بیشتر از ۱۰ مگابایت باشد.');
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        };
        img.onerror = () => reject(new Error('خطا در پردازش تصویر.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('خطا در خواندن فایل تصویر.'));
      reader.readAsDataURL(file);
    });

    const apiBase = getApiBaseUrl();
    if (apiBase) {
      try {
        const res = await fetch(`${apiBase}/api/upload`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ data: dataUrl, mimeType: 'image/jpeg' })
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.url) {
          return json.url;
        }
      } catch (_) {}
    }
    return dataUrl;
  }

  async broadcastUserProfile(userObj) {
    if (!userObj || !userObj.username) return false;
    
    // 1. Remote Cloudflare backend
    const apiBase = getApiBaseUrl();
    if (apiBase) {
      const res = await fetch(`${apiBase}/api/sync/user`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(userObj)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success !== true) {
        throw new Error(data?.error || 'خطا در ذخیره پروفایل کاربر در سرور');
      }
      if (data.user) userObj = data.user;
    }

    // 2. Save to local cache
    const cachedUsers = this.getCachedUsers();
    const updatedUsers = [userObj, ...cachedUsers.filter(u => u.username?.toLowerCase() !== userObj.username?.toLowerCase())];
    this.saveCachedUsers(updatedUsers);

    // 3. Broadcast via BroadcastChannel
    try {
      this.broadcastChannel?.postMessage({ type: 'USER_PROFILE', data: userObj });
    } catch (e) {}

    return userObj;
  }

  async broadcastNewItem(item) {
    if (!item || !item.id) throw new Error('Invalid item payload');

    // 1. Broadcast to Cloudflare Backend
    const apiBase = getApiBaseUrl();
    if (apiBase) {
      const res = await fetch(`${apiBase}/api/sync/item`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(item)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success !== true) {
        throw new Error(data?.error || 'خطا در ثبت آگهی در سرور');
      }
      if (data.item) item = data.item;
    }

    // 2. Save to local cache on success
    const cached = this.getCachedItems();
    const updated = [item, ...cached.filter(i => i.id !== item.id)];
    this.saveCachedItems(updated);

    // 3. Broadcast via BroadcastChannel
    try {
      this.broadcastChannel?.postMessage({ type: 'NEW_ITEM', data: item });
    } catch (e) {}

    return item;
  }

  async broadcastNewRental(rental) {
    if (!rental || !rental.id) throw new Error('Invalid rental payload');

    const apiBase = getApiBaseUrl();
    if (apiBase) {
      const res = await fetch(`${apiBase}/api/sync/rental`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(rental)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success !== true) {
        throw new Error(data?.error || 'خطا در ثبت رزرو در سرور');
      }
      if (data.rental) rental = data.rental;
    }

    const cached = this.getCachedRentals();
    const updated = [rental, ...cached.filter(r => r.id !== rental.id)];
    this.saveCachedRentals(updated);

    try {
      this.broadcastChannel?.postMessage({ type: 'RENTAL_UPDATE', data: rental });
    } catch (e) {}

    return rental;
  }

  async broadcastRentalUpdate(rental) {
    return this.broadcastNewRental(rental);
  }

  async broadcastReview(review) {
    if (!review || !review.id) throw new Error('Invalid review payload');

    const apiBase = getApiBaseUrl();
    if (apiBase) {
      const res = await fetch(`${apiBase}/api/sync/review`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(review)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success !== true) {
        throw new Error(data?.error || 'خطا در ثبت نظر در سرور');
      }
      if (data.review) review = data.review;
    }

    const cached = this.getCachedReviews();
    const updated = [review, ...cached.filter(r => r.id !== review.id)];
    this.saveCachedReviews(updated);

    try {
      this.broadcastChannel?.postMessage({ type: 'REVIEW_ADDED', data: review });
    } catch (e) {}

    return review;
  }

  async broadcastChatMessage(chatThread) {
    if (!chatThread || !chatThread.id) throw new Error('Invalid chat payload');

    const apiBase = getApiBaseUrl();
    if (apiBase) {
      const res = await fetch(`${apiBase}/api/sync/chat?_t=${Date.now()}`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(chatThread),
        cache: 'no-store'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success !== true) {
        throw new Error(data?.error || 'خطا در ارسال پیام به سرور');
      }
    }

    const cached = this.getCachedChats();
    const p1 = (chatThread.ownerUsername || '').toLowerCase();
    const p2 = (chatThread.renterUsername || '').toLowerCase();

    const existingIdx = cached.findIndex(c => {
      if (c.id === chatThread.id) return true;
      const u1 = (c.ownerUsername || '').toLowerCase();
      const u2 = (c.renterUsername || '').toLowerCase();
      if (p1 && p2 && u1 && u2) {
        return (u1 === p1 && u2 === p2) || (u1 === p2 && u2 === p1);
      }
      return false;
    });

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

    return chatThread;
  }

  async deleteChatThread(threadId) {
    if (!threadId) return false;

    const apiBase = getApiBaseUrl();
    if (apiBase) {
      const res = await fetch(`${apiBase}/api/sync/chat/delete?_t=${Date.now()}`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ id: threadId }),
        cache: 'no-store'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success !== true) {
        throw new Error(data?.error || 'خطا در حذف گفتگو از سرور');
      }
    }

    const cached = this.getCachedChats();
    const updated = cached.filter(c => c.id !== threadId);
    this.saveCachedChats(updated);

    try {
      this.broadcastChannel?.postMessage({ type: 'CHAT_DELETED', data: { id: threadId } });
    } catch (e) {}

    return true;
  }

  /**
   * Fast polling specifically for chat messages while chat window is active
   */
  async pollChatsFast() {
    try {
      const data = await this.fetchSharedData(true);
      return data && Array.isArray(data.chats) ? data.chats : this.getCachedChats();
    } catch (e) {
      return this.getCachedChats();
    }
  }

  async fetchSharedData(forceNotify = false) {
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
      const url = `${apiBase}/api/sync/all?_t=${Date.now()}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.getAuthHeaders(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
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
        const mergedChats = [...localChats];

        remoteChats.forEach(rc => {
          const rP1 = (rc.ownerUsername || '').toLowerCase();
          const rP2 = (rc.renterUsername || '').toLowerCase();

          const localIdx = mergedChats.findIndex(lc => {
            if (lc.id === rc.id) return true;
            const lP1 = (lc.ownerUsername || '').toLowerCase();
            const lP2 = (lc.renterUsername || '').toLowerCase();
            if (rP1 && rP2 && lP1 && lP2) {
              return (lP1 === rP1 && lP2 === rP2) || (lP1 === rP2 && lP2 === rP1);
            }
            return false;
          });

          if (localIdx === -1) {
            mergedChats.unshift(rc);
          } else {
            const local = mergedChats[localIdx];
            const combinedMap = new Map();
            (local.messages || []).forEach(m => combinedMap.set(m.id || (m.text + '_' + m.timestamp), m));
            (rc.messages || []).forEach(m => combinedMap.set(m.id || (m.text + '_' + m.timestamp), m));
            mergedChats[localIdx] = {
              ...local,
              ...rc,
              messages: Array.from(combinedMap.values()),
              lastMessageAt: rc.lastMessageAt || local.lastMessageAt
            };
          }
        });
        this.saveCachedChats(mergedChats);

        const totalMsgs = mergedChats.reduce((sum, c) => sum + (c.messages?.length || 0), 0);
        const latestMsgTs = mergedChats.map(c => c.lastMessageAt || '').sort().reverse()[0] || '';
        const currentHash = `${mergedItems.length}_${mergedRentals.length}_${mergedUsers.length}_${mergedReviews.length}_${mergedChats.length}_${totalMsgs}_${latestMsgTs}`;

        const result = {
          items: mergedItems,
          rentals: mergedRentals,
          users: mergedUsers,
          reviews: mergedReviews,
          chats: mergedChats,
          transactions: data.transactions || []
        };

        if (currentHash !== this.lastSyncedHash || forceNotify) {
          this.lastSyncedHash = currentHash;
          this.notifySubscribers('DATA_SYNC', result);
          this.notifySubscribers('CHAT_POLL_SYNC', { chats: [...mergedChats] });
        }

        return result;
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

    // Polling every 8s for active background sync
    this.pollInterval = setInterval(async () => {
      const apiBase = getApiBaseUrl();
      if (!apiBase) return;

      try {
        await this.fetchSharedData();
      } catch (e) {}
    }, 8000);
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
