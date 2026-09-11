import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePiAuth } from './PiAuthContext';
import { piService } from '../services/piService';
import { cloudSyncService } from '../services/cloudSyncService';
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

  // 1. Platform Fee Configuration
  const [platformConfig, setPlatformConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'config_v9');
      return saved ? JSON.parse(saved) : { platformFeePercentage: 5, minFeePi: 0.0001 };
    } catch (e) {
      return { platformFeePercentage: 5, minFeePi: 0.0001 };
    }
  });

  // 2. Marketplace Items Catalog State
  const [items, setItems] = useState(() => {
    return cloudSyncService.getCachedItems();
  });

  // 3. User Favorites State
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'favorites_v8');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // 4. Rentals Ledger State
  const [rentals, setRentals] = useState(() => {
    return cloudSyncService.getCachedRentals();
  });

  // 5. Blockchain Transactions Ledger
  const [transactions, setTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'transactions_v8');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // 6. Ratings and Reviews
  const [reviews, setReviews] = useState(() => {
    return cloudSyncService.getCachedReviews();
  });

  // 7. Violation Reports State
  const [reports, setReports] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'reports_v8');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // 8. In-App User Messages / Chats State (Synced with Cloud)
  const [chats, setChats] = useState(() => {
    return cloudSyncService.getCachedChats();
  });

  // 9. Real-Time New Message Notification State
  const [latestNotification, setLatestNotification] = useState(null);
  const knownMsgIdsRef = useRef(new Set());
  const isInitialLoadDoneRef = useRef(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize known message IDs from cache on first mount
  useEffect(() => {
    const cached = cloudSyncService.getCachedChats();
    cached.forEach(c => {
      (c.messages || []).forEach(m => {
        if (m.id) knownMsgIdsRef.current.add(m.id);
      });
    });
    // Enable live notification after initial cache population
    setTimeout(() => {
      isInitialLoadDoneRef.current = true;
    }, 1200);
  }, []);

  const handleIncomingChats = useCallback((newChatsList) => {
    if (!Array.isArray(newChatsList)) return;
    setChats([...newChatsList]);

    const myName = (currentUser?.username || '').toLowerCase();

    // Check for newly arrived incoming messages
    newChatsList.forEach(c => {
      (c.messages || []).forEach(m => {
        if (m && m.id) {
          if (!knownMsgIdsRef.current.has(m.id)) {
            knownMsgIdsRef.current.add(m.id);

            const sender = (m.senderUsername || '').toLowerCase();
            // Trigger notification only if sender is the other Pioneer and initial boot is done
            if (isInitialLoadDoneRef.current && sender && (sender !== myName || !myName)) {
              const notif = {
                id: m.id,
                senderUsername: m.senderUsername,
                text: m.text,
                itemTitle: c.itemTitle || 'گفتگوی رنتورا',
                itemId: c.itemId,
                threadId: c.id,
                recipientUsername: m.senderUsername
              };
              setLatestNotification(notif);
              playNotificationChime();
              triggerVibration();
              showNativeNotification(`Rentora - @${m.senderUsername}`, m.text);
            }
          }
        }
      });
    });
  }, [currentUser]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_PREFIX + 'config_v9', JSON.stringify(platformConfig)); } catch (e) {}
  }, [platformConfig]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_PREFIX + 'favorites_v8', JSON.stringify(favorites)); } catch (e) {}
  }, [favorites]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_PREFIX + 'transactions_v8', JSON.stringify(transactions)); } catch (e) {}
  }, [transactions]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_PREFIX + 'reports_v8', JSON.stringify(reports)); } catch (e) {}
  }, [reports]);

  useEffect(() => {
    try { 
      localStorage.setItem(STORAGE_PREFIX + 'chats_v2', JSON.stringify(chats)); 
      cloudSyncService.saveCachedChats(chats);
    } catch (e) {}
  }, [chats]);

  // Subscribe to Multi-Device Cloud Sync with change detection to prevent lag
  useEffect(() => {
    const unsubscribe = cloudSyncService.subscribe((event, data) => {
      if (event === 'CHAT_DELETED' && data?.threadId) {
        setChats(prev => prev.filter(c => c.id !== data.threadId));
      } else if (event === 'CHAT_POLL_SYNC' && data?.chats) {
        handleIncomingChats(data.chats);
      } else if (event === 'CHAT_SYNC' && data?.chats) {
        handleIncomingChats(data.chats);
      } else if (data) {
        if (Array.isArray(data.items)) {
          setItems(prev => JSON.stringify(prev) === JSON.stringify(data.items) ? prev : data.items);
        }
        if (Array.isArray(data.rentals)) {
          setRentals(prev => JSON.stringify(prev) === JSON.stringify(data.rentals) ? prev : data.rentals);
        }
        if (Array.isArray(data.reviews)) {
          setReviews(prev => JSON.stringify(prev) === JSON.stringify(data.reviews) ? prev : data.reviews);
        }
        if (Array.isArray(data.chats)) {
          handleIncomingChats(data.chats);
        }
      }
    });

    return () => unsubscribe();
  }, [handleIncomingChats]);

  // Global background sync every 1.5 seconds for instant chat notification across all screens
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pollInterval = setInterval(async () => {
      try {
        const result = await cloudSyncService.fetchSharedData(true);
        if (result && Array.isArray(result.chats)) {
          handleIncomingChats(result.chats);
        }
      } catch (e) {}
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [handleIncomingChats]);

  const toggleFavorite = (itemId) => {
    setFavorites(prev => {
      const updated = prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId];
      return updated;
    });
  };

  // In-App Cloud Refresh & Sync Function
  const refreshApp = async () => {
    setIsRefreshing(true);
    try {
      const data = await cloudSyncService.fetchSharedData();
      if (data) {
        if (Array.isArray(data.items)) setItems(data.items);
        if (Array.isArray(data.rentals)) setRentals(data.rentals);
        if (Array.isArray(data.reviews)) setReviews(data.reviews);
        if (Array.isArray(data.chats)) setChats(data.chats);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Admin Internal Database Purge / Reset Function
  const purgeDatabase = () => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('rentora_db_') || key.startsWith('rentora_live_'))) {
          localStorage.removeItem(key);
        }
      }

      setItems([]);
      setRentals([]);
      setTransactions([]);
      setFavorites([]);
      setReviews([]);
      setReports([]);
      setChats([]);

      cloudSyncService.saveCachedItems([]);
      cloudSyncService.saveCachedRentals([]);
      cloudSyncService.saveCachedReviews([]);
      cloudSyncService.saveCachedChats([]);

      return { success: true };
    } catch (err) {
      throw new Error('خطا در پاکسازی دیتابیس داخلی.');
    }
  };

  // Safe helper returning false for backwards compatibility
  const isUserPro = () => false;

  // Unified Dynamic Pricing Calculation using integer micro-units FinancialEngine
  const calculatePricing = (arg1, arg2 = 1) => {
    let dailyRate = 0;
    let securityDeposit = 0;
    let startDate = null;
    let endDate = null;
    let daysCount = 1;

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

  // Robust Item Listing Creation (Unlimited for all Pioneers)
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

    const finalImage = (itemData.images && itemData.images.length > 0) 
      ? itemData.images 
      : [defaultImages[itemData.category] || defaultImages.tools];

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
      status: "active",
      deliveryAvailable: !!itemData.instantBook,
      instantBooking: !!itemData.instantBook,
      createdAt: new Date().toISOString()
    };

    setItems(prev => {
      const updated = [newItem, ...prev.filter(i => i.id !== newItem.id)];
      cloudSyncService.saveCachedItems(updated);
      return updated;
    });

    // Synchronously Broadcast item to remote Cloudflare Backend & other devices
    await cloudSyncService.broadcastNewItem(newItem);
    cloudSyncService.notifySubscribers('ITEM_ADDED', { items: [newItem, ...items], item: newItem });
    return newItem;
  };

  const updateItem = async (itemId, fields) => {
    let updatedItem = null;
    setItems(prev => {
      const updated = prev.map(i => {
        if (i.id === itemId) {
          updatedItem = { 
            ...i, 
            ...fields, 
            updatedAt: new Date().toISOString() 
          };
          return updatedItem;
        }
        return i;
      });
      cloudSyncService.saveCachedItems(updated);
      return updated;
    });

    if (updatedItem) {
      await cloudSyncService.broadcastNewItem(updatedItem);
      cloudSyncService.notifySubscribers('ITEM_UPDATED', { items: [updatedItem, ...items], item: updatedItem });
    }
    return updatedItem;
  };

  const toggleItemStatus = async (itemId) => {
    let targetItem = null;
    setItems(prev => {
      const updated = prev.map(item => {
        if (item.id === itemId) {
          const currentStatus = item.status || 'active';
          const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
          targetItem = { ...item, status: nextStatus };
          return targetItem;
        }
        return item;
      });
      cloudSyncService.saveCachedItems(updated);
      return updated;
    });
    if (targetItem) {
      await cloudSyncService.broadcastNewItem(targetItem);
    }
  };

  const deleteItem = async (itemId) => {
    setItems(prev => {
      const updated = prev.filter(i => i.id !== itemId);
      cloudSyncService.saveCachedItems(updated);
      return updated;
    });
    const itemToDelete = items.find(i => i.id === itemId);
    if (itemToDelete) {
      await cloudSyncService.broadcastNewItem({ ...itemToDelete, status: 'deleted' });
    }
  };

  // Create Rental Booking Draft (P2P Model with Rentora Platform Fee)
  const createRentalBooking = async (bookingData) => {
    if (!currentUser) throw new Error("لطفاً ابتدا وارد حساب پای خود شوید.");

    const item = bookingData.item || items.find(i => i.id === bookingData.itemId);
    if (!item) throw new Error("کالای مورد نظر یافت نشد.");

    const myName = (currentUser.username || '').toLowerCase().replace('@', '').trim();
    const ownerName = (item.ownerUsername || '').toLowerCase().replace('@', '').trim();
    if ((myName && ownerName && myName === ownerName) || (item.ownerUid && currentUser.uid && item.ownerUid === currentUser.uid)) {
      throw new Error("شما مالک این کالا هستید و نمی‌توانید آگهی خود را اجاره کنید.");
    }

    const startDate = bookingData.startDate;
    const endDate = bookingData.endDate;
    let daysCount = bookingData.daysCount;
    if (!daysCount && startDate && endDate) {
      daysCount = FinancialEngine.calculateDays(startDate, endDate);
    }
    daysCount = Math.max(1, parseInt(daysCount, 10) || 1);

    const financials = calculatePricing({
      pricePerDay: item.pricePerDay,
      dailyRate: item.pricePerDay,
      startDate,
      endDate,
      daysCount,
      securityDeposit: item.deposit || 0
    });

    const agreementId = `RNT-${Math.floor(10000 + Math.random() * 90000)}`;

    const draftRental = {
      id: "rnt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      bookingNumber: agreementId,
      itemId: item.id,
      itemTitle: item.title,
      itemImage: item.images?.[0] || '',
      itemCategory: item.category,
      ownerUsername: item.ownerUsername,
      ownerUid: item.ownerUid,
      renterUsername: currentUser.username,
      renterUid: currentUser.uid,
      startDate,
      endDate,
      daysCount: financials.daysCount,
      pricePerDay: financials.dailyRate,

      // P2P direct settlement values (settled at pickup, NOT held by Rentora)
      rentalTotal: financials.rentalTotal,
      baseAmount: financials.rentalTotal,
      deposit: financials.deposit,
      securityDeposit: financials.deposit,
      totalRentalObligation: financials.totalRentalObligation,
      ownerDirectRentalAmount: financials.ownerDirectRentalAmount,
      ownerDirectDeposit: financials.ownerDirectDeposit,
      ownerDirectPayAtPickup: financials.ownerDirectRentalAmount,

      // Rentora Platform Fee (The ONLY amount processed via Pi SDK)
      rentoraFee: financials.rentoraFee,
      totalPlatformFee: financials.rentoraFee,
      renterCommissionShare: financials.rentoraFee,
      paymentDueToRentora: financials.rentoraFee,
      ownerCommissionShare: 0,
      renterCommissionPaid: false,

      // State Machine & Agreement
      status: RENTAL_STATES.PAYMENT_PENDING,
      paymentStatus: "pending",
      settlementType: "direct_p2p_with_pi_platform_fee",
      isEscrowApplied: false,

      // Formal Rental Agreement / Booking Summary
      rentalAgreement: {
        agreementId,
        itemTitle: item.title,
        ownerUsername: item.ownerUsername,
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

    return draftRental;
  };

  // Payment Execution via Official Pi SDK (Charges Rentora Fee Only)
  const executePiPaymentForRental = async (rentalId, draftRental) => {
    if (!draftRental) throw new Error("اطلاعات رزرو نامعتبر است.");

    const feeAmount = Math.max(0, draftRental.rentoraFee !== undefined ? draftRental.rentoraFee : (draftRental.totalPlatformFee || 0));
    let paymentResult = { paymentId: 'pi_pay_direct', txid: '0x00000000', status: 'completed' };

    if (feeAmount > 0) {
      paymentResult = await piService.createPayment({
        paymentData: {
          amount: feeAmount,
          memo: `Rentora Fee #${draftRental.bookingNumber || draftRental.id.substring(0, 10)}`,
          metadata: {
            type: 'rentora_platform_fee',
            rentalId: draftRental.id,
            bookingNumber: draftRental.bookingNumber,
            itemId: draftRental.itemId,
            renterUid: draftRental.renterUid,
            ownerUid: draftRental.ownerUid,
            feeAmount
          }
        },
        rentalData: draftRental
      });
    }

    const txid = paymentResult.txid || ('0x' + Math.random().toString(16).substring(2, 10));
    const paymentId = paymentResult.paymentId || ('pi_pay_' + Date.now().toString(36));

    const confirmedRental = {
      ...draftRental,
      status: RENTAL_STATES.CONFIRMED,
      renterCommissionPaid: true,
      paymentStatus: "paid_confirmed",
      piPaymentId: paymentId,
      piTxRef: txid,
      paidAt: new Date().toISOString(),
      rentalAgreement: {
        ...(draftRental.rentalAgreement || {}),
        piFeePaymentStatus: "✓ Confirmed (Pi Payment)",
        piTxRef: txid,
        piPaymentId: paymentId
      }
    };

    if (feeAmount > 0) {
      const newTx = {
        id: "tx_" + Date.now(),
        rentalId: draftRental.id,
        bookingNumber: draftRental.bookingNumber,
        piPaymentId: paymentId,
        itemTitle: draftRental.itemTitle,
        renterUsername: draftRental.renterUsername,
        ownerUsername: draftRental.ownerUsername,
        grossAmount: draftRental.rentalTotal || draftRental.baseAmount,
        amount: feeAmount,
        platformFee: feeAmount,
        type: 'rentora_platform_fee',
        payerRole: 'renter',
        totalCharged: feeAmount,
        status: "completed",
        piTxRef: txid,
        blockchainVerified: true,
        timestamp: new Date().toISOString()
      };

      setTransactions(prev => [newTx, ...prev]);
    }

    setRentals(prev => {
      const updated = [confirmedRental, ...prev.filter(r => r.id !== confirmedRental.id)];
      cloudSyncService.saveCachedRentals(updated);
      return updated;
    });

    cloudSyncService.broadcastNewRental(confirmedRental);
    return paymentResult;
  };

  // Handover & Return Actions
  const confirmHandoverOneTap = async (rentalId) => {
    const rental = rentals.find(r => r.id === rentalId);
    if (!rental) return { success: false, error: "سفارش یافت نشد." };

    const updatedRental = {
      ...rental,
      status: RENTAL_STATES.ACTIVE,
      isHandoverConfirmed: true,
      handoverTimestamp: new Date().toISOString()
    };

    setRentals(prev => {
      const updated = prev.map(r => r.id === rentalId ? updatedRental : r);
      cloudSyncService.saveCachedRentals(updated);
      return updated;
    });

    cloudSyncService.broadcastRentalUpdate(updatedRental);
    return { success: true };
  };

  const confirmReturnOneTap = async (rentalId) => {
    const rental = rentals.find(r => r.id === rentalId);
    if (!rental) return { success: false, error: "سفارش یافت نشد." };

    const updatedRental = {
      ...rental,
      status: RENTAL_STATES.COMPLETED,
      isReturnConfirmed: true,
      returnTimestamp: new Date().toISOString()
    };

    setRentals(prev => {
      const updated = prev.map(r => r.id === rentalId ? updatedRental : r);
      cloudSyncService.saveCachedRentals(updated);
      return updated;
    });

    cloudSyncService.broadcastRentalUpdate(updatedRental);
    return { success: true };
  };

  // In-App Chat Messaging System with Synchronous Cloud Sync & Anti-Bypass Filter
  const sendChatMessage = async (arg1, arg2) => {
    if (!currentUser) return;

    let targetChatId = null;
    let messageText = '';
    let recipientUsername = null;
    let itemId = null;
    let itemTitle = 'گفتگوی رنتورا';

    if (typeof arg1 === 'object' && arg1 !== null) {
      messageText = (arg1.text || '').trim();
      recipientUsername = arg1.recipientUsername;
      itemId = arg1.itemId;
      itemTitle = arg1.itemTitle || itemTitle;
    } else {
      targetChatId = arg1;
      messageText = String(arg2 || '').trim();
    }

    if (!messageText) return;

    // Strict Anti-Bypass Security Check
    const safety = inspectMessageSafety(messageText);
    if (safety.isViolating) {
      throw new Error(safety.message);
    }

    const now = new Date().toISOString();
    const newMsg = {
      id: "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      senderUsername: currentUser.username,
      senderUid: currentUser.uid || 'usr',
      text: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: true
    };

    // Calculate synchronously from current cached chats to avoid React batching delays
    const currentChats = cloudSyncService.getCachedChats();
    const myName = (currentUser.username || '').toLowerCase();
    const targetName = (recipientUsername || '').toLowerCase();

    let targetThreadToBroadcast = null;
    let matched = false;

    const updated = currentChats.map(c => {
      if (targetChatId && c.id === targetChatId) {
        matched = true;
        const uThread = { ...c, lastMessageAt: now, messages: [...(c.messages || []), newMsg] };
        targetThreadToBroadcast = uThread;
        return uThread;
      }
      if (recipientUsername) {
        const u1 = (c.ownerUsername || '').toLowerCase();
        const u2 = (c.renterUsername || '').toLowerCase();
        if ((u1 === targetName && u2 === myName) || (u2 === targetName && u1 === myName)) {
          matched = true;
          const uThread = { ...c, lastMessageAt: now, messages: [...(c.messages || []), newMsg] };
          targetThreadToBroadcast = uThread;
          return uThread;
        }
      }
      return c;
    });

    if (!matched) {
      const newChat = {
        id: targetChatId || ("chat_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6)),
        itemId: itemId || 'general',
        itemTitle: itemTitle,
        ownerUsername: recipientUsername || 'pioneer',
        renterUsername: currentUser.username,
        messages: [newMsg],
        lastMessageAt: now,
        unreadCount: 0
      };
      targetThreadToBroadcast = newChat;
      updated.unshift(newChat);
    }

    // 1. Immediately update React State
    setChats([...updated]);
    // 2. Immediately persist to localStorage
    cloudSyncService.saveCachedChats(updated);

    // 3. Dispatch to all active open UI components (ChatModal)
    if (targetThreadToBroadcast) {
      cloudSyncService.notifySubscribers('CHAT_SYNC', { chats: updated, chat: targetThreadToBroadcast });
      cloudSyncService.notifySubscribers('CHAT_POLL_SYNC', { chats: updated });
      // 4. Send directly to Cloudflare KV / Pages backend
      await cloudSyncService.broadcastChatMessage(targetThreadToBroadcast);
    }

    return newMsg;
  };

  const deleteChatThread = async (target) => {
    if (!target) return { success: false };
    const targetId = typeof target === 'object' ? target.id : target;
    const targetRecipient = typeof target === 'object' ? (target.recipientUsername || target.ownerUsername || target.renterUsername) : (typeof target === 'string' ? target : null);

    const currentChats = cloudSyncService.getCachedChats();
    const updated = currentChats.filter(c => {
      if (targetId && c.id === targetId) return false;
      if (targetRecipient) {
        const u1 = (c.ownerUsername || '').toLowerCase();
        const u2 = (c.renterUsername || '').toLowerCase();
        const tr = targetRecipient.toLowerCase();
        if (u1 === tr || u2 === tr || c.id?.toLowerCase() === tr) return false;
      }
      return true;
    });

    setChats([...updated]);
    cloudSyncService.saveCachedChats(updated);
    cloudSyncService.notifySubscribers('CHAT_DELETED', { chats: updated, threadId: targetId });
    cloudSyncService.notifySubscribers('CHAT_POLL_SYNC', { chats: updated });

    try {
      if (targetId) {
        await cloudSyncService.deleteChatThread(targetId);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const deleteChatMessage = async (messageId) => {
    if (!messageId) return { success: false };
    const currentChats = cloudSyncService.getCachedChats();
    let targetThreadToBroadcast = null;

    const updated = currentChats.map(c => {
      const hasMsg = (c.messages || []).some(m => m.id === messageId);
      if (hasMsg) {
        const filtered = (c.messages || []).filter(m => m.id !== messageId);
        const uThread = { ...c, messages: filtered };
        targetThreadToBroadcast = uThread;
        return uThread;
      }
      return c;
    });

    setChats([...updated]);
    cloudSyncService.saveCachedChats(updated);

    if (targetThreadToBroadcast) {
      cloudSyncService.notifySubscribers('CHAT_SYNC', { chats: updated, chat: targetThreadToBroadcast });
      cloudSyncService.notifySubscribers('CHAT_POLL_SYNC', { chats: updated });
      await cloudSyncService.broadcastChatMessage(targetThreadToBroadcast);
    }
    return { success: true };
  };

  const clearAllChats = async () => {
    const prevChats = [...chats];
    setChats([]);
    cloudSyncService.saveCachedChats([]);
    cloudSyncService.notifySubscribers('CHAT_DELETED', { chats: [], threadId: 'ALL' });
    cloudSyncService.notifySubscribers('CHAT_POLL_SYNC', { chats: [] });

    for (const c of prevChats) {
      if (c.id) {
        try { await cloudSyncService.deleteChatThread(c.id); } catch (e) {}
      }
    }
    return { success: true };
  };

  const addReport = (reportData) => {
    const newReport = {
      id: "rep_" + Date.now(),
      reporterUsername: currentUser?.username || 'anonymous',
      createdAt: new Date().toISOString(),
      ...reportData
    };
    setReports(prev => [newReport, ...prev]);
    return newReport;
  };

  const resolveReport = (reportId) => {
    setReports(prev => prev.filter(r => r.id !== reportId));
  };

  const addReview = (reviewData) => {
    const newReview = {
      id: "rev_" + Date.now(),
      reviewerUsername: currentUser?.username || 'pioneer',
      createdAt: new Date().toISOString(),
      ...reviewData
    };
    setReviews(prev => {
      const updated = [newReview, ...prev];
      cloudSyncService.saveCachedReviews(updated);
      return updated;
    });
    cloudSyncService.broadcastReview(newReview);
    return newReview;
  };

  const updatePlatformConfig = (newConfig) => {
    if (!isAdmin) return;
    setPlatformConfig(prev => ({ ...prev, ...newConfig }));
  };

  return (
    <RentoraContext.Provider
      value={{
        items,
        rentals,
        transactions,
        favorites,
        reviews,
        reports,
        chats,
        chatThreads: chats,
        latestNotification,
        clearLatestNotification: () => setLatestNotification(null),
        platformConfig,
        isRefreshing,
        refreshApp,
        purgeDatabase,
        toggleFavorite,
        isUserPro,
        calculatePricing,
        addItem,
        createItemListing: addItem,
        updateItem,
        toggleItemStatus,
        deleteItem,
        createRentalBooking,
        executePiPaymentForRental,
        confirmHandoverOneTap,
        confirmReturnOneTap,
        sendChatMessage,
        deleteChatThread,
        deleteChat: deleteChatThread,
        deleteChatMessage,
        clearAllChats,
        addReport,
        resolveReport,
        addReview,
        updatePlatformConfig
      }}
    >
      {children}
    </RentoraContext.Provider>
  );
}

export function useRentora() {
  const context = useContext(RentoraContext);
  if (!context) {
    throw new Error('useRentora must be used within a RentoraProvider');
  }
  return context;
}
