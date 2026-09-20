/**
 * Universal Cloud Sync Service for Rentora Marketplace
 * Real-time synchronization across devices, tabs, and Pi Browser sessions.
 */
import { getApiBaseUrl } from './apiConfig.js';

const STORAGE_ITEMS_KEY = 'rentora_live_v1_items';
const STORAGE_RENTALS_KEY = 'rentora_live_v1_rentals';
const STORAGE_USERS_KEY = 'rentora_live_v1_users_dir';
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

    const cachedUsers = this.getCachedUsers();
    const updatedUsers = [userObj, ...cachedUsers.filter(u => u.username?.toLowerCase() !== userObj.username?.toLowerCase())];
    this.saveCachedUsers(updatedUsers);

    try {
      this.broadcastChannel?.postMessage({ type: 'USER_PROFILE', data: userObj });
    } catch (e) {}

    return userObj;
  }

  async broadcastNewItem(item) {
    if (!item || !item.id) throw new Error('Invalid item payload');

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

    const cached = this.getCachedItems();
    const updated = [item, ...cached.filter(i => i.id !== item.id)];
    this.saveCachedItems(updated);

    try {
      this.broadcastChannel?.postMessage({ type: 'NEW_ITEM', data: item });
    } catch (e) {}

    return item;
  }

  async createRentalQuote({ listingId, startDate, endDate }) {
    if (!listingId || !startDate || !endDate) throw new Error('listingId, startDate, and endDate are required');

    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('API Base URL is not configured');

    const res = await fetch(`${apiBase}/api/rentals/quote`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ listingId, startDate, endDate })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success !== true) {
      throw new Error(data?.error || 'خطا در دریافت پیش‌فاکتور از سرور');
    }
    return data.quote;
  }

  async createRental({ quoteId, listingId, startDate, endDate }) {
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('API Base URL is not configured');

    const body = quoteId ? { quoteId } : { listingId, startDate, endDate };
    const res = await fetch(`${apiBase}/api/rentals`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success !== true) {
      throw new Error(data?.error || 'خطا در ایجاد قرارداد اجاره در سرور');
    }
    return data.rental;
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

  // =========================================================================
  // AUTHORITATIVE ADMIN & MODERATION API CLIENT
  // =========================================================================

  async fetchAdminOverview() {
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('API Base URL is not configured');

    const res = await fetch(`${apiBase}/api/admin/overview?_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        ...this.getAuthHeaders(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const err = new Error(data?.error || 'دسترسی مدیریتی غیرمجاز است.');
      err.status = res.status;
      throw err;
    }
    return data.overview;
  }

  async requestAdminPayout(amount, memo, walletAddress) {
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('API Base URL is not configured');

    const res = await fetch(`${apiBase}/api/admin/payout`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Number(amount),
        memo: memo || undefined,
        walletAddress: walletAddress || undefined
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const err = new Error(data?.error || 'درخواست واریز به حساب پای ادمین ناموفق بود.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async fetchAdminUsers() {
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('API Base URL is not configured');

    const res = await fetch(`${apiBase}/api/admin/users?_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        ...this.getAuthHeaders(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const err = new Error(data?.error || 'دسترسی به لیست کاربران ممکن نیست.');
      err.status = res.status;
      throw err;
    }
    return data.users || [];
  }

  async setAdminUserStatus(userId, status) {
    if (!userId) throw new Error('userId is required');
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('API Base URL is not configured');

    const res = await fetch(`${apiBase}/api/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ status })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const err = new Error(data?.error || 'خطا در تغییر وضعیت کاربر');
      err.status = res.status;
      throw err;
    }
    return data.user;
  }

  async setAdminListingStatus(listingId, status) {
    if (!listingId) throw new Error('listingId is required');
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('API Base URL is not configured');

    const res = await fetch(`${apiBase}/api/admin/listings/${encodeURIComponent(listingId)}/status`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ status })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const err = new Error(data?.error || 'خطا در تغییر وضعیت آگهی');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // =========================================================================
  // AUTHORITATIVE REPORTS & DISPUTES API CLIENT
  // =========================================================================

  async submitReport(reportData) {
    if (!reportData) throw new Error('Invalid report payload');
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('API Base URL is not configured');

    const res = await fetch(`${apiBase}/api/reports`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(reportData)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const err = new Error(data?.error || 'خطا در ارسال گزارش تخلف');
      err.status = res.status;
      throw err;
    }
    return data.report;
  }

  async resolveReport(reportId, status = 'resolved') {
    if (!reportId) throw new Error('reportId is required');
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('API Base URL is not configured');

    const res = await fetch(`${apiBase}/api/reports/${encodeURIComponent(reportId)}/resolve`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ status })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const err = new Error(data?.error || 'خطا در به‌روزرسانی گزارش');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async cleanupDatabase() {
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('API Base URL is not configured');

    const res = await fetch(`${apiBase}/api/admin/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({})
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const err = new Error(data?.error || 'خطا در اجرای ابزار پاکسازی دیتابیس');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async purgeDatabase() {
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('API Base URL is not configured');

    const res = await fetch(`${apiBase}/api/sync/purge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const err = new Error(data?.error || 'خطا در بازنشانی پایگاه‌داده');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // =========================================================================
  // AUTHORITATIVE RENTAL REVIEWS API CLIENT
  // =========================================================================

  async fetchPublicUserProfile(usernameOrUid) {
    if (!usernameOrUid) return null;
    const apiBase = getApiBaseUrl();
    if (!apiBase) return null;
    try {
      const res = await fetch(`${apiBase}/api/users/${encodeURIComponent(usernameOrUid)}?_t=${Date.now()}`);
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      return data.user || null;
    } catch (_) {
      return null;
    }
  }

  async fetchRentalReviewStatus(rentalId) {
    if (!rentalId) throw new Error('rentalId is required');
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('API Base URL is not configured');

    const res = await fetch(`${apiBase}/api/rentals/${encodeURIComponent(rentalId)}/review-status?_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        ...this.getAuthHeaders(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const err = new Error(data?.error || 'خطا در دریافت وضعیت نظرسنجی');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async submitRentalReview(rentalId, { rating, reviewText }) {
    if (!rentalId) throw new Error('rentalId is required');
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('API Base URL is not configured');

    const res = await fetch(`${apiBase}/api/rentals/${encodeURIComponent(rentalId)}/reviews`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ rating, reviewText })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const err = new Error(data?.error || 'خطا در ثبت امتیاز و نظر');
      err.status = res.status;
      throw err;
    }
    return data.review;
  }

  async fetchUserReviews(userId) {
    if (!userId) throw new Error('userId is required');
    const apiBase = getApiBaseUrl();
    if (!apiBase) return { stats: { totalReviews: 0, averageRating: null, isNew: true }, reviews: [] };

    const res = await fetch(`${apiBase}/api/users/${encodeURIComponent(userId)}/reviews?_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const err = new Error(data?.error || 'خطا در دریافت نظرات کاربر');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async fetchListingReviews(listingId) {
    if (!listingId) throw new Error('listingId is required');
    const apiBase = getApiBaseUrl();
    if (!apiBase) return { stats: { totalReviews: 0, averageRating: null, isNew: true }, reviews: [] };

    const res = await fetch(`${apiBase}/api/listings/${encodeURIComponent(listingId)}/reviews?_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const err = new Error(data?.error || 'خطا در دریافت نظرات آگهی');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // =========================================================================
  // SECURE CONVERSATION & MESSAGING API CLIENT
  // =========================================================================

  async fetchConversations() {
    const apiBase = getApiBaseUrl();
    if (!apiBase) return [];

    const res = await fetch(`${apiBase}/api/conversations?_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        ...this.getAuthHeaders(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data?.error || 'خطا در دریافت لیست گفتگوها');
    }
    return data.conversations || [];
  }

  async getOrCreateConversation({ listingId, rentalId }) {
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('API Base URL is not configured');

    const res = await fetch(`${apiBase}/api/conversations`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ listingId, rentalId })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data?.error || 'خطا در ایجاد گفتگو');
    }
    return data;
  }

  async fetchConversationMessages(conversationId) {
    if (!conversationId) throw new Error('conversationId is required');
    const apiBase = getApiBaseUrl();
    if (!apiBase) return { messages: [] };

    const res = await fetch(`${apiBase}/api/conversations/${encodeURIComponent(conversationId)}/messages?_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        ...this.getAuthHeaders(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data?.error || 'خطا در دریافت پیام‌ها');
    }
    return data;
  }

  async sendConversationMessage(conversationId, { text, messageType = 'text' }) {
    if (!conversationId) throw new Error('conversationId is required');
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('API Base URL is not configured');

    const res = await fetch(`${apiBase}/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ text, messageType })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const err = new Error(data?.error || 'خطا در ارسال پیام');
      err.code = data?.code;
      err.status = res.status;
      throw err;
    }
    return data.message;
  }

  async archiveConversation(conversationId) {
    if (!conversationId) return false;
    const apiBase = getApiBaseUrl();
    if (!apiBase) return false;

    const res = await fetch(`${apiBase}/api/conversations/${encodeURIComponent(conversationId)}/archive`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({})
    });

    const data = await res.json().catch(() => ({}));
    return res.ok && data.success === true;
  }

  async fetchSharedData(forceNotify = false) {
    if (this._inFlightFetch) {
      return this._inFlightFetch;
    }
    this._inFlightFetch = this._doFetchSharedData(forceNotify).finally(() => {
      this._inFlightFetch = null;
    });
    return this._inFlightFetch;
  }

  async _doFetchSharedData(forceNotify = false) {
    const localItems = this.getCachedItems();
    const localRentals = this.getCachedRentals();
    const localUsers = this.getCachedUsers();

    const apiBase = getApiBaseUrl();
    if (!apiBase) {
      return {
        items: localItems,
        rentals: localRentals,
        users: localUsers,
        reviews: [],
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
        
        // 1. Authoritative items from server
        const remoteItems = Array.isArray(data.items) ? data.items : [];
        this.saveCachedItems(remoteItems);

        // 2. Authoritative rentals from server
        const remoteRentals = Array.isArray(data.rentals) ? data.rentals : [];
        this.saveCachedRentals(remoteRentals);

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

        const remoteTransactions = Array.isArray(data.transactions) ? data.transactions : [];
        const remoteReports = Array.isArray(data.reports) ? data.reports : [];

        const currentHash = JSON.stringify({
          items: remoteItems.map(i => [i.id, i.updatedAt || i.createdAt || '', i.status || '']),
          rentals: remoteRentals.map(r => [r.id, r.updatedAt || r.createdAt || '', r.status || '', r.paymentStatus || '']),
          users: mergedUsers.map(u => [u.id || u.uid || u.username || '', u.updatedAt || u.joinedDate || '']),
          transactions: remoteTransactions.map(t => [t.id, t.status, t.amount, t.piTxRef || t.txid || '']),
          reports: remoteReports.map(rp => [rp.id, rp.status])
        });

        const result = {
          items: remoteItems,
          rentals: remoteRentals,
          users: mergedUsers,
          reviews: [],
          transactions: remoteTransactions,
          reports: remoteReports
        };

        if (currentHash !== this.lastSyncedHash || forceNotify) {
          this.lastSyncedHash = currentHash;
          this.notifySubscribers('DATA_SYNC', result);
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
      reviews: [],
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
        if (Array.isArray(parsed)) {
          const dedupedMap = new Map();
          parsed.forEach(r => {
            if (r && r.id) dedupedMap.set(r.id, r);
          });
          return Array.from(dedupedMap.values());
        }
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  saveCachedRentals(rentals) {
    try {
      const list = Array.isArray(rentals) ? rentals : [];
      const dedupedMap = new Map();
      list.forEach(r => {
        if (r && r.id) dedupedMap.set(r.id, r);
      });
      localStorage.setItem(STORAGE_RENTALS_KEY, JSON.stringify(Array.from(dedupedMap.values())));
    } catch (e) {}
  }

  clearUserSessionCache() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_USER_KEY);
        localStorage.removeItem(STORAGE_RENTALS_KEY);
        localStorage.removeItem('rentora_db_transactions_v8');
        localStorage.removeItem('rentora_db_reports_v8');
        localStorage.removeItem('rentora_live_v1_session');
      }
    } catch (_) {}
    this.lastSyncedHash = '';
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
