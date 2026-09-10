import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePiAuth } from './PiAuthContext';
import { piService } from '../services/piService';
import { cloudSyncService } from '../services/cloudSyncService';
import { inspectMessageSafety } from '../services/contactFilterService';

const RentoraContext = createContext();
const STORAGE_PREFIX = 'rentora_db_';

export const RENTAL_STATES = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  CONFIRMED: 'CONFIRMED',
  ACTIVE: 'ACTIVE',
  RETURNED: 'RETURNED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  DISPUTED: 'DISPUTED'
};

export const SUBSCRIPTION_PLANS = [
  {
    id: 'plan_weekly',
    nameFa: 'اشتراک هفتگی Pro',
    nameEn: 'Weekly Pro',
    durationDays: 7,
    pricePi: 1.0,
    badge: 'هفتگی',
    features: [
      'ثبت نامحدود آگهی',
      'صفر درصد کارمزد معاملات',
      'بج طلایی فروشگاه معتبر Pro',
      'نمایش در بالای نتایج جستجو'
    ]
  },
  {
    id: 'plan_monthly',
    nameFa: 'اشتراک ماهانه Pro (ویژه)',
    nameEn: 'Monthly Pro (Popular)',
    durationDays: 30,
    pricePi: 3.5,
    popular: true,
    badge: 'محبوب‌ترین',
    features: [
      'ثبت نامحدود آگهی در تمام دسته‌ها',
      'صفر درصد کارمزد پلتفرم',
      'بج طلایی اختصاصی Pro Verified',
      'نردبان خودکار و نمایش در صدر دسته‌بندی‌ها',
      'پشتیبانی اختصاصی و ممیزی سریع'
    ]
  },
  {
    id: 'plan_annual',
    nameFa: 'اشتراک سالانه طلایی',
    nameEn: 'Annual VIP Pro',
    durationDays: 365,
    pricePi: 30.0,
    badge: 'به‌صرفه‌ترین',
    features: [
      'تمامی امکانات پلن ماهانه',
      '۳۰٪ تخفیف نسبت به پرداخت ماهانه',
      'نشان فروشگاه ویژه طلایی اکوسیستم پای',
      'بنر اختصاصی در صفحه اصلی'
    ]
  }
];

export function RentoraProvider({ children }) {
  const { currentUser, isAdmin } = usePiAuth();

  // 1. Platform Fee Configuration
  const [platformConfig, setPlatformConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'config_v9');
      return saved ? JSON.parse(saved) : { platformFeePercentage: 5, proFeePercentage: 0, minFeePi: 0.0001 };
    } catch (e) {
      return { platformFeePercentage: 5, proFeePercentage: 0, minFeePi: 0.0001 };
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

  // 8. Active Pro Subscriptions Directory
  const [proSubscriptions, setProSubscriptions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'pro_subs_v10');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // 9. In-App User Messages / Chats State
  const [chats, setChats] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + 'chats_v2');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initial cleanup of old test keys
  useEffect(() => {
    try {
      localStorage.removeItem('rentora_db_pro_subs_v8');
      localStorage.removeItem('rentora_db_chats_v1');
    } catch (e) {}
  }, []);
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
    try { localStorage.setItem(STORAGE_PREFIX + 'pro_subs_v10', JSON.stringify(proSubscriptions)); } catch (e) {}
  }, [proSubscriptions]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_PREFIX + 'chats_v2', JSON.stringify(chats)); } catch (e) {}
  }, [chats]);

  // Subscribe to Multi-Device Cloud Sync with change detection to prevent lag
  useEffect(() => {
    const unsubscribe = cloudSyncService.subscribe((event, data) => {
      if (data) {
        if (Array.isArray(data.items)) {
          setItems(prev => JSON.stringify(prev) === JSON.stringify(data.items) ? prev : data.items);
        }
        if (Array.isArray(data.rentals)) {
          setRentals(prev => JSON.stringify(prev) === JSON.stringify(data.rentals) ? prev : data.rentals);
        }
        if (Array.isArray(data.reviews)) {
          setReviews(prev => JSON.stringify(prev) === JSON.stringify(data.reviews) ? prev : data.reviews);
        }
      }
    });

    return () => unsubscribe();
  }, []);

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
      setProSubscriptions({});

      cloudSyncService.saveCachedItems([]);
      cloudSyncService.saveCachedRentals([]);
      cloudSyncService.saveCachedReviews([]);

      return { success: true };
    } catch (err) {
      throw new Error('خطا در پاکسازی دیتابیس داخلی.');
    }
  };

  // Check if username has active Pro subscription
  const isUserPro = (username) => {
    if (!username) return false;
    const clean = String(username).toLowerCase().replace('@', '').trim();
    const sub = proSubscriptions[clean];
    if (!sub) return false;
    if (sub.isPro && new Date(sub.activeUntil) > new Date()) return true;
    return false;
  };

  // Subscribe to Pro Plan with Pi SDK Payment
  const purchaseProSubscription = async (planId) => {
    if (!currentUser) throw new Error("برای فعال‌سازی اشتراک، ابتدا با حساب پای وارد شوید.");

    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId) || SUBSCRIPTION_PLANS[1];

    // Execute Pi Payment
    const paymentResult = await piService.createPayment({
      paymentData: {
        amount: plan.pricePi,
        memo: `Rentora Pro Subscription (${plan.nameEn})`,
        metadata: {
          type: 'pro_subscription',
          planId: plan.id,
          username: currentUser.username,
          uid: currentUser.uid,
          amount: plan.pricePi
        }
      }
    });

    if (!paymentResult || paymentResult.status !== 'completed') {
      throw new Error("تراکنش پرداخت توسط کاربر تایید نشد.");
    }

    const now = new Date();
    const expiryDate = new Date(now.getTime() + (plan.durationDays * 24 * 60 * 60 * 1000));

    const updatedSubs = {
      ...proSubscriptions,
      [currentUser.username.toLowerCase()]: {
        planId: plan.id,
        planName: plan.nameFa,
        activeUntil: expiryDate.toISOString(),
        isPro: true,
        purchasedAt: now.toISOString(),
        paymentId: paymentResult.paymentId,
        txid: paymentResult.txid
      }
    };

    setProSubscriptions(updatedSubs);

    const subTx = {
      id: "tx_sub_" + Date.now(),
      itemTitle: `خرید ${plan.nameFa}`,
      renterUsername: currentUser.username,
      ownerUsername: 'rentora_foundation',
      grossAmount: plan.pricePi,
      platformFee: plan.pricePi,
      payerRole: 'owner_pro',
      totalCharged: plan.pricePi,
      status: "completed",
      piTxRef: paymentResult.txid || ('0x' + Math.random().toString(16).substring(2, 10)),
      blockchainVerified: true,
      timestamp: now.toISOString()
    };

    setTransactions(prev => [subTx, ...prev]);
    return { success: true, plan };
  };

  // Dynamic Pricing Calculation
  const calculatePricing = (item, daysCount = 1) => {
    if (!item) return { baseRentalAmount: 0, renterCommissionShare: 0, totalPlatformFee: 0, securityDeposit: 0, totalPaidByRenter: 0 };

    const days = Math.max(1, parseInt(daysCount) || 1);
    const dailyRate = parseFloat(item.pricePerDay) || 0;
    const baseRentalAmount = parseFloat((dailyRate * days).toFixed(4));
    const depositAmount = parseFloat(item.deposit) || 0;

    const ownerIsProPlan = isUserPro(item.ownerUsername);
    const feePercentage = ownerIsProPlan 
      ? (platformConfig?.proFeePercentage || 0) 
      : (platformConfig?.platformFeePercentage || 5);

    let fee = parseFloat(((baseRentalAmount * feePercentage) / 100).toFixed(4));
    const minFee = platformConfig?.minFeePi || 0.0001;

    if (fee > 0 && fee < minFee) {
      fee = minFee;
    }

    return {
      baseRentalAmount,
      renterCommissionShare: fee,
      totalPlatformFee: fee,
      securityDeposit: depositAmount,
      totalPaidByRenter: fee,
      isProPlanApplied: ownerIsProPlan
    };
  };

  // Robust Item Listing Creation
  const addItem = async (itemData) => {
    if (!currentUser) throw new Error("برای ثبت آگهی ابتدا وارد حساب پای خود شوید.");

    const userIsPro = isUserPro(currentUser.username);
    const userActiveListingsCount = items.filter(i => i.ownerUsername?.toLowerCase() === currentUser.username?.toLowerCase()).length;

    if (!userIsPro && userActiveListingsCount >= 3) {
      throw new Error("سقف ثبت آگهی رایگان (۳ عدد) پر شده است. برای ثبت آگهی نامحدود، اشتراک Pro را فعال کنید.");
    }

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
      ownerIsPro: userIsPro,
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
      const updated = [newItem, ...prev];
      cloudSyncService.saveCachedItems(updated);
      return updated;
    });

    // Broadcast item to other devices & backend
    cloudSyncService.broadcastNewItem(newItem);
    return newItem;
  };

  const updateItem = (itemId, fields) => {
    setItems(prev => {
      const updated = prev.map(i => i.id === itemId ? { ...i, ...fields } : i);
      cloudSyncService.saveCachedItems(updated);
      return updated;
    });
  };

  const toggleItemStatus = (itemId) => {
    setItems(prev => {
      const updated = prev.map(item => {
        if (item.id === itemId) {
          const currentStatus = item.status || 'active';
          const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
          return { ...item, status: nextStatus };
        }
        return item;
      });
      cloudSyncService.saveCachedItems(updated);
      return updated;
    });
  };

  const deleteItem = (itemId) => {
    setItems(prev => {
      const updated = prev.filter(i => i.id !== itemId);
      cloudSyncService.saveCachedItems(updated);
      return updated;
    });
  };

  // Create Rental Booking Draft
  const createRentalBooking = async (bookingData) => {
    if (!currentUser) throw new Error("لطفاً ابتدا وارد حساب پای خود شوید.");

    const { itemId, startDate, endDate, daysCount, notes } = bookingData;
    const item = items.find(i => i.id === itemId);
    if (!item) throw new Error("کالای مورد نظر یافت نشد.");

    const financials = calculatePricing(item, daysCount);

    const draftRental = {
      id: "rnt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
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
      daysCount: parseInt(daysCount) || 1,
      pricePerDay: item.pricePerDay,
      baseAmount: financials.baseRentalAmount,
      totalPlatformFee: financials.totalPlatformFee,
      renterCommissionShare: financials.renterCommissionShare,
      ownerCommissionShare: 0,
      renterCommissionPaid: financials.totalPlatformFee === 0,
      ownerPayout: financials.baseRentalAmount,
      deposit: financials.securityDeposit,
      totalPaidByRenter: financials.renterCommissionShare,
      status: financials.totalPlatformFee === 0 ? RENTAL_STATES.CONFIRMED : RENTAL_STATES.PENDING_PAYMENT,
      paymentStatus: financials.totalPlatformFee === 0 ? "pro_free" : "pending",
      isHandoverConfirmed: false,
      isReturnConfirmed: false,
      notes,
      createdAt: new Date().toISOString()
    };

    return draftRental;
  };

  // Payment Execution via Official Pi SDK
  const executePiPaymentForRental = async (rentalId, draftRental) => {
    if (!draftRental) throw new Error("اطلاعات رزرو نامعتبر است.");

    const feeAmount = Math.max(0, draftRental.totalPlatformFee || 0);
    let paymentResult = { paymentId: 'pro_free', txid: '0x00000000', status: 'completed' };

    if (feeAmount > 0) {
      paymentResult = await piService.createPayment({
        paymentData: {
          amount: feeAmount,
          memo: `Rentora Booking: ${draftRental.itemTitle.substring(0, 25)}`,
          metadata: {
            rentalId: draftRental.id,
            itemId: draftRental.itemId,
            renterUid: draftRental.renterUid,
            ownerUid: draftRental.ownerUid,
            feeAmount
          }
        },
        rentalData: draftRental
      });
    }

    const confirmedRental = {
      ...draftRental,
      status: RENTAL_STATES.CONFIRMED,
      renterCommissionPaid: true,
      paymentStatus: feeAmount > 0 ? "paid_confirmed" : "pro_free_confirmed",
      piPaymentId: paymentResult.paymentId || ('pi_pay_' + Date.now().toString(36)),
      piTxRef: paymentResult.txid || ('0x' + Math.random().toString(16).substring(2, 10)),
      paidAt: new Date().toISOString()
    };

    if (feeAmount > 0) {
      const newTx = {
        id: "tx_" + Date.now(),
        rentalId: draftRental.id,
        piPaymentId: confirmedRental.piPaymentId,
        itemTitle: draftRental.itemTitle,
        renterUsername: draftRental.renterUsername,
        ownerUsername: draftRental.ownerUsername,
        grossAmount: draftRental.baseAmount,
        platformFee: feeAmount,
        payerRole: 'renter',
        totalCharged: feeAmount,
        status: "completed",
        piTxRef: confirmedRental.piTxRef,
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

  // In-App Chat Messaging System
  const sendChatMessage = (arg1, arg2) => {
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

    const safety = inspectMessageSafety(messageText);
    if (safety.isViolating) {
      throw new Error(safety.message);
    }

    const now = new Date().toISOString();
    const newMsg = {
      id: "msg_" + Date.now(),
      senderUsername: currentUser.username,
      senderUid: currentUser.uid || 'usr',
      text: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: true
    };

    setChats(prev => {
      let matched = false;
      const updated = prev.map(c => {
        if (targetChatId && c.id === targetChatId) {
          matched = true;
          return { ...c, lastMessageAt: now, messages: [...(c.messages || []), newMsg] };
        }
        if (recipientUsername && (
          (c.ownerUsername?.toLowerCase() === recipientUsername.toLowerCase() && c.renterUsername?.toLowerCase() === currentUser.username.toLowerCase()) ||
          (c.renterUsername?.toLowerCase() === recipientUsername.toLowerCase() && c.ownerUsername?.toLowerCase() === currentUser.username.toLowerCase())
        )) {
          matched = true;
          return { ...c, lastMessageAt: now, messages: [...(c.messages || []), newMsg] };
        }
        return c;
      });

      if (!matched) {
        const newChat = {
          id: "chat_" + Date.now(),
          itemId: itemId || 'general',
          itemTitle: itemTitle,
          ownerUsername: recipientUsername || 'pioneer',
          renterUsername: currentUser.username,
          messages: [newMsg],
          lastMessageAt: now,
          unreadCount: 0
        };
        return [newChat, ...updated];
      }

      return updated;
    });

    return newMsg;
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
        proSubscriptions,
        chats,
        chatThreads: chats,
        platformConfig,
        isRefreshing,
        refreshApp,
        purgeDatabase,
        toggleFavorite,
        isUserPro,
        purchaseProSubscription,
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
