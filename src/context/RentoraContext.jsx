import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePiAuth } from './PiAuthContext';
import { piService } from '../services/piService';
import { cloudSyncService } from '../services/cloudSyncService';
import { getApiBaseUrl } from '../services/apiConfig';
import { inspectMessageSafety } from '../services/contactFilterService';
import { FinancialEngine } from '../services/financialEngine';
import { RENTAL_STATES, RentalStateMachine } from '../services/rentalStateMachine';
import {
  playNotificationChime,
  triggerVibration,
  showNativeNotification
} from '../services/notificationService';

const RentoraContext = createContext();
const STORAGE_PREFIX = 'rentora_db_';

export function RentoraProvider({ children }) {
  const { currentUser, isAdmin } = usePiAuth();
  const [platformConfig, setPlatformConfig] = useState(() => {
    try { const saved = localStorage.getItem(STORAGE_PREFIX + 'config_v9'); return saved ? JSON.parse(saved) : { platformFeePercentage: 5, minFeePi: 0.0001 }; }
    catch (e) { return { platformFeePercentage: 5, minFeePi: 0.0001 }; }
  });
  const [items, setItems] = useState(() => cloudSyncService.getCachedItems());
  const [favorites, setFavorites] = useState(() => { try { const saved = localStorage.getItem(STORAGE_PREFIX + 'favorites_v8'); return saved ? JSON.parse(saved) : []; } catch (e) { return []; } });
  const [rentals, setRentals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [reports, setReports] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [latestNotification, setLatestNotification] = useState(null);
  const knownMsgIdsRef = useRef(new Set());
  const isInitialLoadDoneRef = useRef(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const userIdentifier = currentUser?.uid || currentUser?.id || null;
  const usernameIdentifier = (currentUser?.username || '').toLowerCase().replace('@', '').trim();

  // Hard-clear private client state immediately when the authenticated session disappears.
  // This prevents a logout/offline transition from leaving another user's rental/payment data visible.
  useEffect(() => {
    if (currentUser) return;
    setRentals([]);
    setTransactions([]);
    setReports([]);
    setConversations([]);
    knownMsgIdsRef.current.clear();
    cloudSyncService.clearUserSessionCache();
  }, [currentUser]);

  const getReadTimestampsKey = useCallback(() => {
    return usernameIdentifier || userIdentifier ? `rentora_chat_reads_${usernameIdentifier || userIdentifier}` : null;
  }, [usernameIdentifier, userIdentifier]);

  const getReadTimestamps = useCallback(() => {
    const key = getReadTimestampsKey();
    if (!key) return {};
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }, [getReadTimestampsKey]);

  const markConversationAsRead = useCallback((convId) => {
    if (!convId || !userIdentifier) return;
    const key = getReadTimestampsKey();
    const nowIso = new Date().toISOString();
    if (key) {
      try {
        const reads = getReadTimestamps();
        reads[convId] = nowIso;
        localStorage.setItem(key, JSON.stringify(reads));
      } catch (_) {}
    }

    setConversations(prev => prev.map(c => {
      if (c.id === convId) {
        return { ...c, unreadCount: 0 };
      }
      return c;
    }));
  }, [userIdentifier, getReadTimestampsKey, getReadTimestamps]);

  // Load conversations from server when authenticated
  const refreshConversations = useCallback(async () => {
    if (!userIdentifier) {
      setConversations([]);
      return [];
    }
    try {
      const list = await cloudSyncService.fetchConversations();
      const readMap = getReadTimestamps();
      const myName = usernameIdentifier;

      const enrichedList = (list || []).map(c => {
        const lastMsgTime = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : (c.createdAt ? new Date(c.createdAt).getTime() : 0);
        const lastReadTime = readMap[c.id] ? new Date(readMap[c.id]).getTime() : 0;
        const sender = (c.otherUser?.username || '').toLowerCase().replace('@', '').trim();
        // Unread if message exists, sent by other user, and created after last read timestamp
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

      setConversations(enrichedList);
      return enrichedList;
    } catch (e) {
      return [];
    }
  }, [userIdentifier, usernameIdentifier, getReadTimestamps]);

  useEffect(() => {
    let cancelled = false;
    const loadInitialData = async () => {
      try {
        await Promise.all([
          cloudSyncService.fetchSharedData(true),
          refreshConversations()
        ]);
      } finally {
        if (!cancelled) {
          isInitialLoadDoneRef.current = true;
          setIsInitialLoadDone(true);
        }
      }
    };
    loadInitialData().catch(() => {});
    return () => { cancelled = true; };
  }, [refreshConversations]);

  useEffect(() => { try { localStorage.setItem(STORAGE_PREFIX + 'config_v9', JSON.stringify(platformConfig)); } catch (e) {} }, [platformConfig]);
  useEffect(() => { try { localStorage.setItem(STORAGE_PREFIX + 'favorites_v8', JSON.stringify(favorites)); } catch (e) {} }, [favorites]);

  useEffect(() => {
    const unsubscribe = cloudSyncService.subscribe((event, data) => {
      if (data) {
        if (Array.isArray(data.items)) setItems(prev => JSON.stringify(prev) === JSON.stringify(data.items) ? prev : data.items);
        if (Array.isArray(data.rentals)) setRentals(prev => JSON.stringify(prev) === JSON.stringify(data.rentals) ? prev : data.rentals);
        if (Array.isArray(data.transactions)) setTransactions(prev => JSON.stringify(prev) === JSON.stringify(data.transactions) ? prev : data.transactions);
        if (Array.isArray(data.reports)) setReports(prev => JSON.stringify(prev) === JSON.stringify(data.reports) ? prev : data.reports);
      }
    });
    return () => unsubscribe();
  }, []);

  // Background polling for conversations and marketplace data
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pollInterval = setInterval(() => {
      if (userIdentifier) {
        refreshConversations().catch(() => {});
      }
    }, 4000);
    return () => clearInterval(pollInterval);
  }, [userIdentifier, refreshConversations]);

  const toggleFavorite = (itemId) => setFavorites(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);

  const refreshApp = async () => {
    setIsRefreshing(true);
    try {
      const data = await cloudSyncService.fetchSharedData(true);
      if (data) {
        if (Array.isArray(data.items)) setItems(data.items);
        if (Array.isArray(data.rentals)) setRentals(data.rentals);
        if (Array.isArray(data.transactions)) setTransactions(data.transactions);
        if (Array.isArray(data.reports)) setReports(data.reports);
      }
      if (currentUser) await refreshConversations();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const purgeDatabase = async () => {
    if (!isAdmin) throw new Error('پاکسازی دیتابیس فقط برای مدیر مجاز است.');
    const result = await cloudSyncService.purgeDatabase();
    await refreshApp();
    return result;
  };

  const calculatePricing = (arg1, arg2 = 1) => {
    let dailyRate = 0, securityDeposit = 0, startDate = null, endDate = null, daysCount = 1;
    if (arg1 && typeof arg1 === 'object') {
      dailyRate = arg1.dailyRate !== undefined ? arg1.dailyRate : (arg1.pricePerDay !== undefined ? arg1.pricePerDay : 0);
      securityDeposit = arg1.securityDeposit !== undefined ? arg1.securityDeposit : (arg1.deposit !== undefined ? arg1.deposit : 0);
      startDate = arg1.startDate;
      endDate = arg1.endDate;
      daysCount = arg1.daysCount;
    } else {
      dailyRate = parseFloat(arg1) || 0;
      daysCount = parseInt(arg2, 10) || 1;
    }
    const configuredFeePercentage = platformConfig?.platformFeePercentage !== undefined ? platformConfig.platformFeePercentage : 5;
    return FinancialEngine.calculateBookingFinancials({
      dailyRate,
      startDate,
      endDate,
      daysCount,
      securityDeposit,
      platformFeePercentage: configuredFeePercentage
    });
  };

  const addItem = async (itemData) => {
    if (!currentUser) throw new Error("برای ثبت آگهی ابتدا وارد حساب پای خود شوید.");
    const defaultImages = {
      tools: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=900&auto=format&fit=crop&q=80",
      cameras: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=900&auto=format&fit=crop&q=80",
      camping: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=900&auto=format&fit=crop&q=80",
      sports: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=900&auto=format&fit=crop&q=80",
      vehicles: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=900&auto=format&fit=crop&q=80",
      events: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=900&auto=format&fit=crop&q=80",
      home: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900&auto=format&fit=crop&q=80"
    };
    const finalImage = itemData.images?.length ? itemData.images : [defaultImages[itemData.category] || defaultImages.tools];
    const newItem = {
      id: "item_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      title: itemData.title.trim(),
      category: itemData.category || 'tools',
      description: itemData.description || '',
      pricePerDay: parseFloat(itemData.pricePerDay),
      deposit: parseFloat(itemData.deposit) || 0,
      location: itemData.location || 'ایران',
      city: itemData.location?.split('،')?.[0]?.trim() || itemData.location || 'ایران',
      images: Array.isArray(finalImage) ? finalImage : [finalImage],
      ownerUid: currentUser.uid,
      ownerUsername: currentUser.username,
      ownerAvatar: currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`,
      ownerBio: currentUser.bio || 'کاربر شبکه پای در رنتورا',
      ownerKYC: currentUser?.kycStatus === 'verified' && !!currentUser?.isOfficialSdk,
      ownerReputation: null,
      rating: null,
      ratingCount: 0,
      reviewsCount: 0,
      phoneContact: itemData.phoneContact || currentUser.phoneMasked || '',
      contactInfo: itemData.contactInfo || null,
      status: "active",
      deliveryAvailable: !!itemData.instantBook,
      instantBooking: !!itemData.instantBook,
      createdAt: new Date().toISOString()
    };
    const confirmed = await cloudSyncService.broadcastNewItem(newItem);
    setItems(prev => {
      const updated = [confirmed || newItem, ...prev.filter(i => i.id !== newItem.id)];
      cloudSyncService.saveCachedItems(updated);
      return updated;
    });
    return confirmed || newItem;
  };

  const updateItem = async (itemId, fields) => {
    const current = items.find(i => i.id === itemId);
    if (!current) return null;
    const updatedItem = { ...current, ...fields, updatedAt: new Date().toISOString() };
    const confirmed = await cloudSyncService.broadcastNewItem(updatedItem);
    setItems(prev => {
      const updated = prev.map(i => i.id === itemId ? (confirmed || updatedItem) : i);
      cloudSyncService.saveCachedItems(updated);
      return updated;
    });
    return confirmed || updatedItem;
  };

  const toggleItemStatus = (itemId) => {
    const current = items.find(i => i.id === itemId);
    if (!current) return;
    const newStatus = current.status === "active" ? "paused" : "active";
    updateItem(itemId, { status: newStatus });
  };

  const deleteItem = async (itemId) => {
    const current = items.find(i => i.id === itemId);
    if (!current) return;
    const deletedItem = { ...current, status: 'deleted', updatedAt: new Date().toISOString() };
    await cloudSyncService.broadcastNewItem(deletedItem);
    setItems(prev => {
      const updated = prev.filter(i => i.id !== itemId);
      cloudSyncService.saveCachedItems(updated);
      return updated;
    });
  };

  const fetchRentalContact = async (rentalId) => {
    if (!rentalId) throw new Error('شناسه رزرو برای دریافت اطلاعات تماس الزامی است.');
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/api/rentals/${encodeURIComponent(rentalId)}/contact`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'دسترسی به اطلاعات تماس امکان‌پذیر نیست.');
    return data.contact;
  };

  const fetchListingContact = async (listingId) => {
    if (!listingId) throw new Error('شناسه آگهی برای دریافت اطلاعات تماس الزامی است.');
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/api/listings/${encodeURIComponent(listingId)}/contact`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'دسترسی به اطلاعات تماس آگهی امکان‌پذیر نیست.');
    return data.contact;
  };

  const createRentalBooking = useCallback(async (arg1, arg2) => {
    if (!currentUser) throw new Error("برای ثبت رزرو ابتدا وارد حساب پای خود شوید.");

    const bookingData = (arg2 && typeof arg2 === 'object')
      ? arg2
      : (arg1 && typeof arg1 === 'object' && !arg1.quoteId && arg1.item ? arg1 : arg1);

    const quoteId = bookingData?.quoteId;
    if (!quoteId) {
      throw new Error("برای ثبت رزرو باید پیش‌فاکتور معتبر سرور (quoteId) ارائه شود.");
    }

    return cloudSyncService.createRental({ quoteId });
  }, [currentUser]);

  const executePiPaymentForRental = async (rentalId, draftRental) => {
    if (!draftRental?.id || draftRental.id !== rentalId) {
      throw new Error("اطلاعات رزرو برای پرداخت نامعتبر است.");
    }

    // Pi payment is authoritative only after the server-side intent/approve/complete flow.
    // Do not synthesize or persist a confirmed rental in browser state.
    return piService.createPayment({
      paymentData: {
        amount: draftRental.rentoraFee,
        memo: `Rentora Fee #${draftRental.bookingNumber || draftRental.id.substring(0, 10)}`,
        metadata: {
          type: 'rentora_platform_fee',
          rentalId: draftRental.id,
          bookingNumber: draftRental.bookingNumber,
          itemId: draftRental.itemId,
          renterUid: draftRental.renterUid,
          ownerUid: draftRental.ownerUid,
          feeAmount: draftRental.rentoraFee
        }
      },
      paymentIntentId: draftRental.paymentIntentId,
      callbacks: {
        onCancel: async (paymentId) => {
          await piService.cancelPaymentOnServer(paymentId, draftRental.paymentIntentId);
        }
      }
    });
  };

  const transitionRentalStatus = async (rentalId, action) => {
    const apiBase = getApiBaseUrl();
    const response = await fetch(`${apiBase}/api/sync/rental/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rentalId, action })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.rental) return { success: false, error: data?.error || 'تغییر وضعیت رزرو ناموفق بود.' };
    const updatedRental = data.rental;
    setRentals(prev => {
      const updated = prev.map(r => r.id === rentalId ? updatedRental : r);
      cloudSyncService.saveCachedRentals(updated);
      return updated;
    });
    cloudSyncService.notifySubscribers('RENTAL_STATUS_UPDATED', { rental: updatedRental });
    return { success: true, rental: updatedRental, idempotent: !!data.idempotent };
  };

  const confirmHandoverOneTap = async (rentalId) => transitionRentalStatus(rentalId, 'handover');
  const confirmReturnOneTap = async (rentalId) => transitionRentalStatus(rentalId, 'return');

  // =========================================================================
  // SECURE CONVERSATION & MESSAGING WRAPPERS
  // =========================================================================

  const getOrCreateConversation = async ({ listingId, rentalId }) => {
    return cloudSyncService.getOrCreateConversation({ listingId, rentalId });
  };

  const fetchConversationMessages = async (conversationId) => {
    return cloudSyncService.fetchConversationMessages(conversationId);
  };

  const sendConversationMessage = async (conversationId, { text, messageType }) => {
    const safety = inspectMessageSafety(text);
    if (safety.isViolating) throw new Error(safety.message);
    const msg = await cloudSyncService.sendConversationMessage(conversationId, { text, messageType });
    await refreshConversations();
    return msg;
  };

  const archiveConversation = async (conversationId) => {
    const success = await cloudSyncService.archiveConversation(conversationId);
    if (success) {
      setConversations(prev => prev.filter(c => c.id !== conversationId));
    }
    return success;
  };

  // Backward compatibility alias for any existing caller
  const sendChatMessage = async (arg1, arg2) => {
    if (!currentUser) return;
    let text = '', listingId = null, rentalId = null;
    if (typeof arg1 === 'object' && arg1 !== null) {
      text = (arg1.text || '').trim();
      listingId = arg1.itemId || arg1.listingId;
      rentalId = arg1.rentalId || null;
    } else {
      listingId = arg1;
      text = String(arg2 || '').trim();
    }
    if (!text) return;
    const safety = inspectMessageSafety(text);
    if (safety.isViolating) throw new Error(safety.message);

    const convRes = await getOrCreateConversation({ listingId, rentalId });
    if (!convRes?.conversationId) throw new Error('خطا در یافتن گفتگو');
    return sendConversationMessage(convRes.conversationId, { text });
  };

  const deleteChatThread = async (target) => {
    const convId = typeof target === 'object' ? target.id : target;
    if (!convId) return { success: false };
    const ok = await archiveConversation(convId);
    return { success: ok };
  };

  const clearAllChats = async () => {
    for (const c of conversations) {
      if (c.id) {
        try { await archiveConversation(c.id); } catch (_) {}
      }
    }
    setConversations([]);
    return { success: true };
  };

  const submitReport = async (reportData) => {
    const saved = await cloudSyncService.submitReport(reportData);
    const rep = saved || { id: "rep_" + Date.now(), reporterUsername: currentUser?.username || 'anonymous', createdAt: new Date().toISOString(), ...reportData };
    setReports(prev => [rep, ...prev]);
    return rep;
  };

  const addReport = submitReport;

  const resolveReport = async (reportId) => {
    try {
      await cloudSyncService.resolveReport(reportId, 'resolved');
    } catch (_) {}
    setReports(prev => prev.filter(r => r.id !== reportId));
    return { success: true };
  };

  // =========================================================================
  // AUTHORITATIVE RENTAL REVIEWS WRAPPERS
  // =========================================================================

  const fetchRentalReviewStatus = async (rentalId) => {
    return cloudSyncService.fetchRentalReviewStatus(rentalId);
  };

  const submitRentalReview = async (rentalId, payload) => {
    return cloudSyncService.submitRentalReview(rentalId, payload);
  };

  const fetchUserReviews = async (userId) => {
    return cloudSyncService.fetchUserReviews(userId);
  };

  const fetchListingReviews = async (listingId) => {
    return cloudSyncService.fetchListingReviews(listingId);
  };

  const updatePlatformConfig = (newConfig) => {
    if (isAdmin) setPlatformConfig(prev => ({ ...prev, ...newConfig }));
  };

  return (
    <RentoraContext.Provider value={{
      items,
      rentals,
      transactions,
      favorites,
      reports,
      conversations,
      chats: conversations,
      chatThreads: conversations,
      refreshConversations,
      markConversationAsRead,
      getOrCreateConversation,
      fetchConversationMessages,
      sendConversationMessage,
      archiveConversation,
      latestNotification,
      clearLatestNotification: () => setLatestNotification(null),
      platformConfig,
      isRefreshing,
      isInitialLoadDone,
      refreshApp,
      purgeDatabase,
      toggleFavorite,
      calculatePricing,
      addItem,
      createItemListing: addItem,
      updateItem,
      toggleItemStatus,
      deleteItem,
      createRentalBooking,
      executePiPaymentForRental,
      fetchRentalContact,
      fetchListingContact,
      confirmHandoverOneTap,
      confirmReturnOneTap,
      sendChatMessage,
      deleteChatThread,
      deleteChat: deleteChatThread,
      deleteChatMessage: () => {},
      clearAllChats,
      submitReport,
      addReport,
      resolveReport,
      fetchRentalReviewStatus,
      submitRentalReview,
      fetchUserReviews,
      fetchListingReviews,
      updatePlatformConfig
    }}>
      {children}
    </RentoraContext.Provider>
  );
}

export function useRentora() {
  const context = useContext(RentoraContext);
  if (!context) throw new Error('useRentora must be used within a RentoraProvider');
  return context;
}
