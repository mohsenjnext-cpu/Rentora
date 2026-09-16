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
  const [rentals, setRentals] = useState(() => cloudSyncService.getCachedRentals());
  const [transactions, setTransactions] = useState(() => { try { const saved = localStorage.getItem(STORAGE_PREFIX + 'transactions_v8'); return saved ? JSON.parse(saved) : []; } catch (e) { return []; } });
  const [reports, setReports] = useState(() => { try { const saved = localStorage.getItem(STORAGE_PREFIX + 'reports_v8'); return saved ? JSON.parse(saved) : []; } catch (e) { return []; } });
  const [conversations, setConversations] = useState([]);
  const [latestNotification, setLatestNotification] = useState(null);
  const knownMsgIdsRef = useRef(new Set());
  const isInitialLoadDoneRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load conversations from server when authenticated
  const refreshConversations = useCallback(async () => {
    if (!currentUser) {
      setConversations([]);
      return [];
    }
    try {
      const list = await cloudSyncService.fetchConversations();
      setConversations(list);

      // Check for incoming new messages to trigger chime / notifications
      const myName = (currentUser?.username || '').toLowerCase();
      list.forEach(c => {
        if (c.lastMessageText && c.lastMessageAt && c.otherUser) {
          const msgKey = `${c.id}_${c.lastMessageAt}`;
          if (!knownMsgIdsRef.current.has(msgKey)) {
            knownMsgIdsRef.current.add(msgKey);
            const sender = (c.otherUser?.username || '').toLowerCase();
            if (isInitialLoadDoneRef.current && sender && sender !== myName) {
              const notif = {
                id: msgKey,
                senderUsername: c.otherUser.username,
                text: c.lastMessageText,
                itemTitle: c.listing?.title || 'گفتگوی رنتورا',
                itemId: c.listingId,
                threadId: c.id,
                recipientUsername: c.otherUser.username
              };
              setLatestNotification(notif);
              playNotificationChime();
              triggerVibration();
              showNativeNotification(`Rentora - @${c.otherUser.username}`, c.lastMessageText);
            }
          }
        }
      });
      return list;
    } catch (e) {
      return [];
    }
  }, [currentUser]);

  useEffect(() => {
    refreshConversations().finally(() => {
      setTimeout(() => { isInitialLoadDoneRef.current = true; }, 1200);
    });
  }, [refreshConversations]);

  useEffect(() => { try { localStorage.setItem(STORAGE_PREFIX + 'config_v9', JSON.stringify(platformConfig)); } catch (e) {} }, [platformConfig]);
  useEffect(() => { try { localStorage.setItem(STORAGE_PREFIX + 'favorites_v8', JSON.stringify(favorites)); } catch (e) {} }, [favorites]);
  useEffect(() => { try { localStorage.setItem(STORAGE_PREFIX + 'transactions_v8', JSON.stringify(transactions)); } catch (e) {} }, [transactions]);
  useEffect(() => { try { localStorage.setItem(STORAGE_PREFIX + 'reports_v8', JSON.stringify(reports)); } catch (e) {} }, [reports]);

  useEffect(() => {
    const unsubscribe = cloudSyncService.subscribe((event, data) => {
      if (data) {
        if (Array.isArray(data.items)) setItems(prev => JSON.stringify(prev) === JSON.stringify(data.items) ? prev : data.items);
        if (Array.isArray(data.rentals)) setRentals(prev => JSON.stringify(prev) === JSON.stringify(data.rentals) ? prev : data.rentals);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    cloudSyncService.fetchSharedData(true).catch(() => {});
  }, [currentUser]);

  // Background polling for conversations and marketplace data
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pollInterval = setInterval(() => {
      if (currentUser) {
        refreshConversations().catch(() => {});
      }
    }, 4000);
    return () => clearInterval(pollInterval);
  }, [currentUser, refreshConversations]);

  const toggleFavorite = (itemId) => setFavorites(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);

  const refreshApp = async () => {
    setIsRefreshing(true);
    try {
      const data = await cloudSyncService.fetchSharedData();
      if (data) {
        if (Array.isArray(data.items)) setItems(data.items);
        if (Array.isArray(data.rentals)) setRentals(data.rentals);
      }
      if (currentUser) await refreshConversations();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const purgeDatabase = () => {
    if (!isAdmin) throw new Error('پاکسازی دیتابیس فقط برای مدیر مجاز است.');
    throw new Error('پاکسازی دیتابیس باید از API مدیریتی سرور انجام شود.');
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
    const headers = { 'Content-Type': 'application/json' };
    try {
      const raw = localStorage.getItem('rentora_live_v1_session');
      const session = raw ? JSON.parse(raw) : null;
      if (session?.sessionToken) headers.Authorization = `Bearer ${session.sessionToken}`;
    } catch (_) {}
    const res = await fetch(`${apiBase}/api/rentals/${encodeURIComponent(rentalId)}/contact`, {
      method: 'GET',
      headers
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'دسترسی به اطلاعات تماس امکان‌پذیر نیست.');
    return data.contact;
  };

  const fetchListingContact = async (listingId) => {
    if (!listingId) throw new Error('شناسه آگهی برای دریافت اطلاعات تماس الزامی است.');
    const apiBase = getApiBaseUrl();
    const headers = { 'Content-Type': 'application/json' };
    try {
      const raw = localStorage.getItem('rentora_live_v1_session');
      const session = raw ? JSON.parse(raw) : null;
      if (session?.sessionToken) headers.Authorization = `Bearer ${session.sessionToken}`;
    } catch (_) {}
    const res = await fetch(`${apiBase}/api/listings/${encodeURIComponent(listingId)}/contact`, {
      method: 'GET',
      headers
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'دسترسی به اطلاعات تماس آگهی امکان‌پذیر نیست.');
    return data.contact;
  };

  const createRentalBooking = (arg1, arg2) => {
    if (!currentUser) throw new Error("برای ثبت رزرو ابتدا وارد حساب پای خود شوید.");
    
    let item, bookingData;
    if (arg2 && typeof arg2 === 'object') {
      item = arg1;
      bookingData = arg2;
    } else if (arg1 && arg1.item) {
      item = arg1.item;
      bookingData = arg1;
    } else {
      item = arg1;
      bookingData = arg1 || {};
    }

    if (!item) throw new Error("اطلاعات کالای مورد نظر برای رزرو یافت نشد.");

    const myName = (currentUser?.username || '').toLowerCase().replace('@', '').trim();
    const ownerName = (item?.ownerUsername || item?.owner_username || '').toLowerCase().replace('@', '').trim();
    if ((myName && ownerName && myName === ownerName) || (item?.ownerUid && currentUser?.uid && item.ownerUid === currentUser.uid)) {
      throw new Error("شما مالک این کالا هستید و نمی‌توانید آگهی خودتان را اجاره کنید.");
    }

    const startDate = bookingData.startDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const endDate = bookingData.endDate || new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0];
    const deliveryRequired = !!bookingData.deliveryRequired;
    const deliveryAddress = bookingData.deliveryAddress || '';
    const rawPrice = item.pricePerDay ?? item.price_per_day ?? item.dailyRate ?? item.price ?? 0;
    const rawDeposit = item.deposit ?? item.deposit_amount ?? item.securityDeposit ?? 0;

    const financials = calculatePricing({
      dailyRate: Number(rawPrice) || 0,
      pricePerDay: Number(rawPrice) || 0,
      startDate,
      endDate,
      daysCount: bookingData.daysCount,
      securityDeposit: Number(rawDeposit) || 0
    });

    const bookingNumber = 'RN-' + Math.floor(100000 + Math.random() * 900000);
    const agreementId = 'AGR-' + Math.floor(100000 + Math.random() * 900000);

    return {
      id: "rental_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      bookingNumber,
      itemId: item.id,
      itemTitle: item.title,
      itemCategory: item.category,
      itemImage: Array.isArray(item.images) ? item.images[0] : (item.images || item.image),
      itemLocation: item.location,
      renterUid: currentUser.uid,
      renterUsername: currentUser.username,
      renterAvatar: currentUser.avatar,
      ownerUid: item.ownerUid || item.owner_uid,
      ownerUsername: item.ownerUsername || item.owner_username,
      ownerAvatar: item.ownerAvatar || item.owner_avatar,
      startDate,
      endDate,
      daysCount: financials.daysCount,
      pricePerDay: financials.dailyRate,
      rentalTotal: financials.rentalTotal,
      baseAmount: financials.rentalTotal,
      deposit: financials.deposit,
      securityDeposit: financials.deposit,
      rentoraFee: financials.rentoraFee,
      totalPlatformFee: financials.rentoraFee,
      platformFeeRate: financials.platformFeeRate,
      totalAmount: financials.rentoraFee,
      paymentDueToRentora: financials.rentoraFee,
      deliveryRequired: !!deliveryRequired,
      deliveryAddress: deliveryAddress || '',
      paymentIntentId: null,
      piPaymentId: null,
      piTxRef: null,
      ownerCommissionShare: 0,
      renterCommissionShare: 0,
      renterCommissionPaid: false,
      status: RENTAL_STATES.PAYMENT_PENDING,
      paymentStatus: "pending",
      settlementType: "direct_p2p_with_pi_platform_fee",
      isEscrowApplied: false,
      rentalAgreement: {
        agreementId,
        itemTitle: item.title,
        ownerUsername: item.ownerUsername || item.owner_username,
        renterUsername: currentUser.username,
        rentalPeriodDays: financials.daysCount,
        startDate,
        endDate,
        rentalTotal: financials.rentalTotal,
        deposit: financials.deposit,
        rentoraFee: financials.rentoraFee,
        piFeePaymentStatus: "Pending Pi Payment",
        rentalPaymentMethod: "Direct P2P",
        depositPaymentMethod: "Direct P2P",
        terms: "Direct P2P settlement — rental fee and deposit are not processed or held by Rentora."
      },
      isHandoverConfirmed: false,
      isReturnConfirmed: false,
      notes: bookingData.notes || '',
      createdAt: new Date().toISOString()
    };
  };

  const executePiPaymentForRental = async (rentalId, draftRental) => {
    if (!draftRental) throw new Error("اطلاعات رزرو نامعتبر است.");
    const paymentResult = await piService.createPayment({
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
      paymentIntentId: draftRental.paymentIntentId
    });
    const txid = paymentResult.txid, paymentId = paymentResult.paymentId;
    const confirmedRental = {
      ...draftRental,
      status: RENTAL_STATES.CONFIRMED,
      renterCommissionPaid: true,
      paymentStatus: "paid_confirmed",
      piPaymentId: paymentId,
      piTxRef: txid,
      paidAt: new Date().toISOString()
    };
    setRentals(prev => {
      const updated = [confirmedRental, ...prev.filter(r => r.id !== confirmedRental.id)];
      cloudSyncService.saveCachedRentals(updated);
      return updated;
    });
    await cloudSyncService.broadcastNewRental(confirmedRental);
    return paymentResult;
  };

  const transitionRentalStatus = async (rentalId, action) => {
    const apiBase = getApiBaseUrl();
    const headers = { 'Content-Type': 'application/json' };
    try {
      const raw = localStorage.getItem('rentora_live_v1_session');
      const session = raw ? JSON.parse(raw) : null;
      if (session?.sessionToken) headers.Authorization = `Bearer ${session.sessionToken}`;
    } catch (_) {}
    const response = await fetch(`${apiBase}/api/sync/rental/status`, {
      method: 'POST',
      headers,
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
      getOrCreateConversation,
      fetchConversationMessages,
      sendConversationMessage,
      archiveConversation,
      latestNotification,
      clearLatestNotification: () => setLatestNotification(null),
      platformConfig,
      isRefreshing,
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
