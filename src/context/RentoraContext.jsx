import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePiAuth } from './PiAuthContext';
import { piService } from '../services/piService';
import { cloudSyncService } from '../services/cloudSyncService';
import { inspectMessageSafety } from '../services/contactFilterService';
import { 
  playNotificationChime, 
  triggerVibration, 
  showNativeNotification 
} from '../services/notificationService';

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

  // 9. In-App User Messages / Chats State (Synced with Cloud)
  const [chats, setChats] = useState(() => {
    return cloudSyncService.getCachedChats();
  });

  // 10. Real-Time New Message Notification State
  const [latestNotification, setLatestNotification] = useState(null);
  const knownMsgIdsRef = useRef(new Set());
  const isInitialLoadDoneRef = useRef(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize known message IDs from cache so we only notify for truly new incoming messages
  useEffect(() => {
    const cached = cloudSyncService.getCachedChats();
    cached.forEach(c => {
      (c.messages || []).forEach(m => {
        if (m.id) knownMsgIdsRef.current.add(m.id);
      });
    });
    isInitialLoadDoneRef.current = true;
  }, []);

  const handleIncomingChats = useCallback((newChatsList) => {
    if (!Array.isArray(newChatsList)) return;
    setChats(newChatsList);

    if (!isInitialLoadDoneRef.current || !currentUser?.username) return;
    const myName = currentUser.username.toLowerCase();

    newChatsList.forEach(c => {
      (c.messages || []).forEach(m => {
        if (m.id && !knownMsgIdsRef.current.has(m.id)) {
          knownMsgIdsRef.current.add(m.id);

          const sender = (m.senderUsername || '').toLowerCase();
          // Trigger notification only if sender is the OTHER Pioneer
          if (sender && sender !== myName) {
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
    try { localStorage.setItem(STORAGE_PREFIX + 'pro_subs_v10', JSON.stringify(proSubscriptions)); } catch (e) {}
  }, [proSubscriptions]);

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

  // Global background sync every 2.5 seconds for instant chat notification
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pollInterval = setInterval(async () => {
      try {
        const freshChats = await cloudSyncService.pollChatsFast();
        if (freshChats) {
          handleIncomingChats(freshChats);
        }
      } catch (e) {}
    }, 2500);

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
      setProSubscriptions({});

      cloudSyncService.saveCachedItems([]);
      cloudSyncService.saveCachedRentals([]);
      cloudSyncService.saveCachedReviews([]);
      cloudSyncService.saveCachedChats([]);

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

  // Activate Pro directly for admin / testing
  const activateProImmediately = (planId = 'plan_monthly') => {
    if (!currentUser) throw new Error("ابتدا وارد حساب کاربری شوید.");
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId) || SUBSCRIPTION_PLANS[1];
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
        paymentId: 'dev_instant_' + Date.now(),
        txid: '0x' + Math.random().toString(16).substring(2, 10)
      }
    };

    setProSubscriptions(updatedSubs);
    return { success: true, plan };
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

  // Unified Dynamic Pricing Calculation (Supports item object or params object)
  const calculatePricing = (arg1, arg2 = 1) => {
    let item = null;
    let daysCount = 1;
    let customDailyRate = null;
    let customDeposit = null;
    let customOwner = null;

    if (arg1 && typeof arg1 === 'object') {
      if (arg1.dailyRate !== undefined || arg1.startDate || arg1.pricePerDay !== undefined) {
        customDailyRate = parseFloat(arg1.dailyRate !== undefined ? arg1.dailyRate : arg1.pricePerDay) || 0;
        customDeposit = parseFloat(arg1.securityDeposit !== undefined ? arg1.securityDeposit : (arg1.deposit || 0));
        customOwner = arg1.ownerUsername;
        
        if (arg1.startDate && arg1.endDate) {
          const d1 = new Date(arg1.startDate);
          const d2 = new Date(arg1.endDate);
          const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
          daysCount = Math.max(1, isNaN(diff) ? 1 : diff);
        } else {
          daysCount = Math.max(1, parseInt(arg1.daysCount) || 1);
        }
      } else {
        item = arg1;
        daysCount = Math.max(1, parseInt(arg2) || 1);
      }
    }

    const days = Math.max(1, daysCount);
    const dailyRate = customDailyRate !== null ? customDailyRate : (parseFloat(item?.pricePerDay) || 0);
    const baseRentalAmount = parseFloat((dailyRate * days).toFixed(4));
    const depositAmount = customDeposit !== null ? customDeposit : (parseFloat(item?.deposit) || 0);
    const ownerName = customOwner || item?.ownerUsername;

    const ownerIsProPlan = isUserPro(ownerName);
    const feePercentage = ownerIsProPlan 
      ? (platformConfig?.proFeePercentage || 0) 
      : (platformConfig?.platformFeePercentage || 5);

    let fee = parseFloat(((baseRentalAmount * feePercentage) / 100).toFixed(4));
    const minFee = platformConfig?.minFeePi || 0.0001;

    if (fee > 0 && fee < minFee) {
      fee = minFee;
    }

    return {
      daysCount: days,
      dailyRate,
      baseRentalAmount,
      platformFeePercentage: feePercentage,
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

  // Create Rental Booking Draft (Supports item object or itemId)
  const createRentalBooking = async (bookingData) => {
    if (!currentUser) throw new Error("لطفاً ابتدا وارد حساب پای خود شوید.");

    const item = bookingData.item || items.find(i => i.id === bookingData.itemId);
    if (!item) throw new Error("کالای مورد نظر یافت نشد.");

    const startDate = bookingData.startDate;
    const endDate = bookingData.endDate;
    let daysCount = bookingData.daysCount;
    if (!daysCount && startDate && endDate) {
      const d1 = new Date(startDate);
      const d2 = new Date(endDate);
      const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      daysCount = Math.max(1, isNaN(diff) ? 1 : diff);
    }
    daysCount = Math.max(1, parseInt(daysCount) || 1);

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
      daysCount,
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
      notes: bookingData.notes || '',
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

  // In-App Chat Messaging System with Cloud Sync & Anti-Bypass Filter
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

    let targetThreadToBroadcast = null;

    setChats(prev => {
      let matched = false;
      const updated = prev.map(c => {
        if (targetChatId && c.id === targetChatId) {
          matched = true;
          const updatedThread = { ...c, lastMessageAt: now, messages: [...(c.messages || []), newMsg] };
          targetThreadToBroadcast = updatedThread;
          return updatedThread;
        }
        if (recipientUsername && (
          (c.ownerUsername?.toLowerCase() === recipientUsername.toLowerCase() && c.renterUsername?.toLowerCase() === currentUser.username.toLowerCase()) ||
          (c.renterUsername?.toLowerCase() === recipientUsername.toLowerCase() && c.ownerUsername?.toLowerCase() === currentUser.username.toLowerCase())
        )) {
          matched = true;
          const updatedThread = { ...c, lastMessageAt: now, messages: [...(c.messages || []), newMsg] };
          targetThreadToBroadcast = updatedThread;
          return updatedThread;
        }
        return c;
      });

      if (!matched) {
        const newChat = {
          id: "chat_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          itemId: itemId || 'general',
          itemTitle: itemTitle,
          ownerUsername: recipientUsername || 'pioneer',
          renterUsername: currentUser.username,
          messages: [newMsg],
          lastMessageAt: now,
          unreadCount: 0
        };
        targetThreadToBroadcast = newChat;
        return [newChat, ...updated];
      }

      return updated;
    });

    if (targetThreadToBroadcast) {
      cloudSyncService.broadcastChatMessage(targetThreadToBroadcast);
    }

    return newMsg;
  };

  const deleteChatThread = async (target) => {
    if (!target) return { success: false };
    const targetId = typeof target === 'object' ? target.id : target;
    const targetRecipient = typeof target === 'object' ? (target.recipientUsername || target.ownerUsername || target.renterUsername) : (typeof target === 'string' ? target : null);

    setChats(prev => {
      const updated = prev.filter(c => {
        if (targetId && c.id === targetId) return false;
        if (targetRecipient) {
          const u1 = (c.ownerUsername || '').toLowerCase();
          const u2 = (c.renterUsername || '').toLowerCase();
          const tr = targetRecipient.toLowerCase();
          if (u1 === tr || u2 === tr || c.id?.toLowerCase() === tr) return false;
        }
        return true;
      });
      cloudSyncService.saveCachedChats(updated);
      return updated;
    });

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
    let targetThreadToBroadcast = null;
    setChats(prev => {
      const updated = prev.map(c => {
        const hasMsg = (c.messages || []).some(m => m.id === messageId);
        if (hasMsg) {
          const filtered = (c.messages || []).filter(m => m.id !== messageId);
          const uThread = { ...c, messages: filtered };
          targetThreadToBroadcast = uThread;
          return uThread;
        }
        return c;
      });
      cloudSyncService.saveCachedChats(updated);
      return updated;
    });

    if (targetThreadToBroadcast) {
      cloudSyncService.broadcastChatMessage(targetThreadToBroadcast);
    }
    return { success: true };
  };

  const clearAllChats = async () => {
    const prevChats = [...chats];
    setChats([]);
    cloudSyncService.saveCachedChats([]);
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
        proSubscriptions,
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
        purchaseProSubscription,
        activateProImmediately,
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
