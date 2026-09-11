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
  const [reviews, setReviews] = useState(() => cloudSyncService.getCachedReviews());
  const [reports, setReports] = useState(() => { try { const saved = localStorage.getItem(STORAGE_PREFIX + 'reports_v8'); return saved ? JSON.parse(saved) : []; } catch (e) { return []; } });
  const [chats, setChats] = useState(() => cloudSyncService.getCachedChats());
  const [latestNotification, setLatestNotification] = useState(null);
  const knownMsgIdsRef = useRef(new Set());
  const isInitialLoadDoneRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const cached = cloudSyncService.getCachedChats();
    cached.forEach(c => (c.messages || []).forEach(m => { if (m.id) knownMsgIdsRef.current.add(m.id); }));
    setTimeout(() => { isInitialLoadDoneRef.current = true; }, 1200);
  }, []);

  const handleIncomingChats = useCallback((newChatsList) => {
    if (!Array.isArray(newChatsList)) return;
    setChats([...newChatsList]);
    const myName = (currentUser?.username || '').toLowerCase();
    newChatsList.forEach(c => (c.messages || []).forEach(m => {
      if (m && m.id && !knownMsgIdsRef.current.has(m.id)) {
        knownMsgIdsRef.current.add(m.id);
        const sender = (m.senderUsername || '').toLowerCase();
        if (isInitialLoadDoneRef.current && sender && (sender !== myName || !myName)) {
          const notif = { id: m.id, senderUsername: m.senderUsername, text: m.text, itemTitle: c.itemTitle || 'گفتگوی رنتورا', itemId: c.itemId, threadId: c.id, recipientUsername: m.senderUsername };
          setLatestNotification(notif); playNotificationChime(); triggerVibration(); showNativeNotification(`Rentora - @${m.senderUsername}`, m.text);
        }
      }
    }));
  }, [currentUser]);

  useEffect(() => { try { localStorage.setItem(STORAGE_PREFIX + 'config_v9', JSON.stringify(platformConfig)); } catch (e) {} }, [platformConfig]);
  useEffect(() => { try { localStorage.setItem(STORAGE_PREFIX + 'favorites_v8', JSON.stringify(favorites)); } catch (e) {} }, [favorites]);
  useEffect(() => { try { localStorage.setItem(STORAGE_PREFIX + 'transactions_v8', JSON.stringify(transactions)); } catch (e) {} }, [transactions]);
  useEffect(() => { try { localStorage.setItem(STORAGE_PREFIX + 'reports_v8', JSON.stringify(reports)); } catch (e) {} }, [reports]);
  useEffect(() => { try { localStorage.setItem(STORAGE_PREFIX + 'chats_v2', JSON.stringify(chats)); cloudSyncService.saveCachedChats(chats); } catch (e) {} }, [chats]);

  useEffect(() => {
    const unsubscribe = cloudSyncService.subscribe((event, data) => {
      if (event === 'CHAT_DELETED' && data?.threadId) setChats(prev => prev.filter(c => c.id !== data.threadId));
      else if ((event === 'CHAT_POLL_SYNC' || event === 'CHAT_SYNC') && data?.chats) handleIncomingChats(data.chats);
      else if (data) {
        if (Array.isArray(data.items)) setItems(prev => JSON.stringify(prev) === JSON.stringify(data.items) ? prev : data.items);
        if (Array.isArray(data.rentals)) setRentals(prev => JSON.stringify(prev) === JSON.stringify(data.rentals) ? prev : data.rentals);
        if (Array.isArray(data.reviews)) setReviews(prev => JSON.stringify(prev) === JSON.stringify(data.reviews) ? prev : data.reviews);
        if (Array.isArray(data.chats)) handleIncomingChats(data.chats);
      }
    });
    return () => unsubscribe();
  }, [handleIncomingChats]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pollInterval = setInterval(async () => { try { const result = await cloudSyncService.fetchSharedData(true); if (result && Array.isArray(result.chats)) handleIncomingChats(result.chats); } catch (e) {} }, 1500);
    return () => clearInterval(pollInterval);
  }, [handleIncomingChats]);

  const toggleFavorite = (itemId) => setFavorites(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);

  const refreshApp = async () => {
    setIsRefreshing(true);
    try { const data = await cloudSyncService.fetchSharedData(); if (data) { if (Array.isArray(data.items)) setItems(data.items); if (Array.isArray(data.rentals)) setRentals(data.rentals); if (Array.isArray(data.reviews)) setReviews(data.reviews); if (Array.isArray(data.chats)) setChats(data.chats); } return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
    finally { setTimeout(() => setIsRefreshing(false), 500); }
  };

  const purgeDatabase = () => {
    if (!isAdmin) throw new Error('پاکسازی دیتابیس فقط برای مدیر مجاز است.');
    throw new Error('پاکسازی دیتابیس باید از API مدیریتی سرور انجام شود.');
  };

  const calculatePricing = (arg1, arg2 = 1) => {
    let dailyRate = 0, securityDeposit = 0, startDate = null, endDate = null, daysCount = 1;
    if (arg1 && typeof arg1 === 'object') { dailyRate = arg1.dailyRate !== undefined ? arg1.dailyRate : (arg1.pricePerDay !== undefined ? arg1.pricePerDay : 0); securityDeposit = arg1.securityDeposit !== undefined ? arg1.securityDeposit : (arg1.deposit !== undefined ? arg1.deposit : 0); startDate = arg1.startDate; endDate = arg1.endDate; daysCount = arg1.daysCount; }
    else { dailyRate = parseFloat(arg1) || 0; daysCount = parseInt(arg2, 10) || 1; }
    const configuredFeePercentage = platformConfig?.platformFeePercentage !== undefined ? platformConfig.platformFeePercentage : 5;
    return FinancialEngine.calculateBookingFinancials({ dailyRate, startDate, endDate, daysCount, securityDeposit, platformFeePercentage: configuredFeePercentage });
  };

  const addItem = async (itemData) => {
    if (!currentUser) throw new Error("برای ثبت آگهی ابتدا وارد حساب پای خود شوید.");
    const defaultImages = { tools: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=900&auto=format&fit=crop&q=80", cameras: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=900&auto=format&fit=crop&q=80", camping: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=900&auto=format&fit=crop&q=80", sports: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=900&auto=format&fit=crop&q=80", vehicles: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=900&auto=format&fit=crop&q=80", events: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=900&auto=format&fit=crop&q=80", home: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900&auto=format&fit=crop&q=80" };
    const finalImage = itemData.images?.length ? itemData.images : [defaultImages[itemData.category] || defaultImages.tools];
    const newItem = { id: "item_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7), title: itemData.title.trim(), category: itemData.category || 'tools', description: itemData.description || '', pricePerDay: parseFloat(itemData.pricePerDay), deposit: parseFloat(itemData.deposit) || 0, location: itemData.location || 'ایران', city: itemData.location?.split('،')?.[0]?.trim() || itemData.location || 'ایران', images: Array.isArray(finalImage) ? finalImage : [finalImage], ownerUid: currentUser.uid, ownerUsername: currentUser.username, ownerAvatar: currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`, ownerBio: currentUser.bio || 'کاربر شبکه پای در رنتورا', ownerKYC: currentUser?.kycStatus === 'verified' && !!currentUser?.isOfficialSdk, ownerReputation: null, rating: null, ratingCount: 0, reviewsCount: 0, phoneContact: itemData.phoneContact || currentUser.phoneMasked || '', status: "active", deliveryAvailable: !!itemData.instantBook, instantBooking: !!itemData.instantBook, createdAt: new Date().toISOString() };
    await cloudSyncService.broadcastNewItem(newItem);
    setItems(prev => { const updated = [newItem, ...prev.filter(i => i.id !== newItem.id)]; cloudSyncService.saveCachedItems(updated); return updated; });
    return newItem;
  };

  const updateItem = async (itemId, fields) => {
    const current = items.find(i => i.id === itemId);
    if (!current) return null;
    const updatedItem = { ...current, ...fields, updatedAt: new Date().toISOString() };
    await cloudSyncService.broadcastNewItem(updatedItem);
    setItems(prev => { const updated = prev.map(i => i.id === itemId ? updatedItem : i); cloudSyncService.saveCachedItems(updated); return updated; });
    return updatedItem;
  };

  const toggleItemStatus = async (itemId) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return null;
    const nextStatus = (item.status || 'active') === 'active' ? 'paused' : 'active';
    return updateItem(itemId, { status: nextStatus });
  };

  const deleteItem = async (itemId) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return { success: false, error: 'آگهی یافت نشد.' };
    await cloudSyncService.broadcastNewItem({ ...item, status: 'deleted' });
    setItems(prev => { const updated = prev.filter(i => i.id !== itemId); cloudSyncService.saveCachedItems(updated); return updated; });
    return { success: true };
  };

  const createRentalBooking = async (bookingData) => {
    if (!currentUser) throw new Error("لطفاً ابتدا وارد حساب پای خود شوید.");
    const item = bookingData.item || items.find(i => i.id === bookingData.itemId);
    if (!item) throw new Error("کالای مورد نظر یافت نشد.");
    const myName = (currentUser.username || '').toLowerCase().replace('@', '').trim();
    const ownerName = (item.ownerUsername || '').toLowerCase().replace('@', '').trim();
    if ((myName && ownerName && myName === ownerName) || (item.ownerUid && currentUser.uid && item.ownerUid === currentUser.uid)) throw new Error("شما مالک این کالا هستید و نمی‌توانید آگهی خود را اجاره کنید.");
    const startDate = bookingData.startDate, endDate = bookingData.endDate;
    let daysCount = bookingData.daysCount || (startDate && endDate ? FinancialEngine.calculateDays(startDate, endDate) : 1);
    daysCount = Math.max(1, parseInt(daysCount, 10) || 1);
    const financials = calculatePricing({ pricePerDay: item.pricePerDay, dailyRate: item.pricePerDay, startDate, endDate, daysCount, securityDeposit: item.deposit || 0 });
    const agreementId = `RNT-${Math.floor(10000 + Math.random() * 90000)}`;
    return { id: "rnt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6), bookingNumber: agreementId, itemId: item.id, itemTitle: item.title, itemImage: item.images?.[0] || '', itemCategory: item.category, ownerUsername: item.ownerUsername, ownerUid: item.ownerUid, renterUsername: currentUser.username, renterUid: currentUser.uid, startDate, endDate, daysCount: financials.daysCount, pricePerDay: financials.dailyRate, rentalTotal: financials.rentalTotal, baseAmount: financials.rentalTotal, deposit: financials.deposit, securityDeposit: financials.deposit, totalRentalObligation: financials.totalRentalObligation, ownerDirectRentalAmount: financials.ownerDirectRentalAmount, ownerDirectDeposit: financials.ownerDirectDeposit, ownerDirectPayAtPickup: financials.ownerDirectRentalAmount, rentoraFee: financials.rentoraFee, totalPlatformFee: financials.rentoraFee, renterCommissionShare: financials.rentoraFee, paymentDueToRentora: financials.rentoraFee, ownerCommissionShare: 0, renterCommissionPaid: false, status: RENTAL_STATES.PAYMENT_PENDING, paymentStatus: "pending", settlementType: "direct_p2p_with_pi_platform_fee", isEscrowApplied: false, rentalAgreement: { agreementId, itemTitle: item.title, ownerUsername: item.ownerUsername, renterUsername: currentUser.username, rentalPeriodDays: financials.daysCount, startDate, endDate, rentalTotal: financials.rentalTotal, deposit: financials.deposit, rentoraFee: financials.rentoraFee, piFeePaymentStatus: "Pending Pi Payment", rentalPaymentMethod: "Direct P2P", depositPaymentMethod: "Direct P2P", terms: "Direct P2P settlement — rental fee and deposit are not processed or held by Rentora." }, isHandoverConfirmed: false, isReturnConfirmed: false, notes: bookingData.notes || '', createdAt: new Date().toISOString() };
  };

  const executePiPaymentForRental = async (rentalId, draftRental) => {
    if (!draftRental) throw new Error("اطلاعات رزرو نامعتبر است.");
    const paymentResult = await piService.createPayment({ paymentData: { amount: draftRental.rentoraFee, memo: `Rentora Fee #${draftRental.bookingNumber || draftRental.id.substring(0, 10)}`, metadata: { type: 'rentora_platform_fee', rentalId: draftRental.id, bookingNumber: draftRental.bookingNumber, itemId: draftRental.itemId, renterUid: draftRental.renterUid, ownerUid: draftRental.ownerUid, feeAmount: draftRental.rentoraFee } }, paymentIntentId: draftRental.paymentIntentId });
    const txid = paymentResult.txid, paymentId = paymentResult.paymentId;
    const confirmedRental = { ...draftRental, status: RENTAL_STATES.CONFIRMED, renterCommissionPaid: true, paymentStatus: "paid_confirmed", piPaymentId: paymentId, piTxRef: txid, paidAt: new Date().toISOString() };
    setRentals(prev => { const updated = [confirmedRental, ...prev.filter(r => r.id !== confirmedRental.id)]; cloudSyncService.saveCachedRentals(updated); return updated; });
    await cloudSyncService.broadcastNewRental(confirmedRental);
    return paymentResult;
  };

  const transitionRentalStatus = async (rentalId, action) => {
    const apiBase = getApiBaseUrl();
    const response = await fetch(`${apiBase}/api/sync/rental/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rentalId, action }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.rental) return { success: false, error: data?.error || 'تغییر وضعیت رزرو ناموفق بود.' };
    const updatedRental = data.rental;
    setRentals(prev => { const updated = prev.map(r => r.id === rentalId ? updatedRental : r); cloudSyncService.saveCachedRentals(updated); return updated; });
    cloudSyncService.notifySubscribers('RENTAL_STATUS_UPDATED', { rental: updatedRental });
    return { success: true, rental: updatedRental, idempotent: !!data.idempotent };
  };

  const confirmHandoverOneTap = async (rentalId) => transitionRentalStatus(rentalId, 'handover');
  const confirmReturnOneTap = async (rentalId) => transitionRentalStatus(rentalId, 'return');

  const sendChatMessage = async (arg1, arg2) => {
    if (!currentUser) return;
    let targetChatId = null, messageText = '', recipientUsername = null, itemId = null, itemTitle = 'گفتگوی رنتورا';
    if (typeof arg1 === 'object' && arg1 !== null) { messageText = (arg1.text || '').trim(); recipientUsername = arg1.recipientUsername; itemId = arg1.itemId; itemTitle = arg1.itemTitle || itemTitle; } else { targetChatId = arg1; messageText = String(arg2 || '').trim(); }
    if (!messageText) return;
    const safety = inspectMessageSafety(messageText); if (safety.isViolating) throw new Error(safety.message);
    const now = new Date().toISOString();
    const newMsg = { id: "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6), senderUsername: currentUser.username, senderUid: currentUser.uid || 'usr', text: messageText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), read: true };
    const currentChats = cloudSyncService.getCachedChats(); const myName = (currentUser.username || '').toLowerCase(); const targetName = (recipientUsername || '').toLowerCase(); let targetThreadToBroadcast = null, matched = false;
    const updated = currentChats.map(c => { if (targetChatId && c.id === targetChatId) { matched = true; const uThread = { ...c, lastMessageAt: now, messages: [...(c.messages || []), newMsg] }; targetThreadToBroadcast = uThread; return uThread; } if (recipientUsername) { const u1 = (c.ownerUsername || '').toLowerCase(), u2 = (c.renterUsername || '').toLowerCase(); if ((u1 === targetName && u2 === myName) || (u2 === targetName && u1 === myName)) { matched = true; const uThread = { ...c, lastMessageAt: now, messages: [...(c.messages || []), newMsg] }; targetThreadToBroadcast = uThread; return uThread; } } return c; });
    if (!matched) { const newChat = { id: targetChatId || ("chat_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6)), itemId: itemId || 'general', itemTitle, ownerUsername: recipientUsername || 'pioneer', renterUsername: currentUser.username, messages: [newMsg], lastMessageAt: now, unreadCount: 0 }; targetThreadToBroadcast = newChat; updated.unshift(newChat); }
    setChats([...updated]); cloudSyncService.saveCachedChats(updated);
    if (targetThreadToBroadcast) { cloudSyncService.notifySubscribers('CHAT_SYNC', { chats: updated, chat: targetThreadToBroadcast }); cloudSyncService.notifySubscribers('CHAT_POLL_SYNC', { chats: updated }); await cloudSyncService.broadcastChatMessage(targetThreadToBroadcast); }
    return newMsg;
  };

  const deleteChatThread = async (target) => {
    if (!target) return { success: false };
    const targetId = typeof target === 'object' ? target.id : target; const targetRecipient = typeof target === 'object' ? (target.recipientUsername || target.ownerUsername || target.renterUsername) : (typeof target === 'string' ? target : null);
    const currentChats = cloudSyncService.getCachedChats();
    const updated = currentChats.filter(c => { if (targetId && c.id === targetId) return false; if (targetRecipient) { const u1 = (c.ownerUsername || '').toLowerCase(), u2 = (c.renterUsername || '').toLowerCase(), tr = targetRecipient.toLowerCase(); if (u1 === tr || u2 === tr || c.id?.toLowerCase() === tr) return false; } return true; });
    setChats([...updated]); cloudSyncService.saveCachedChats(updated); cloudSyncService.notifySubscribers('CHAT_DELETED', { chats: updated, threadId: targetId }); cloudSyncService.notifySubscribers('CHAT_POLL_SYNC', { chats: updated });
    try { if (targetId) await cloudSyncService.deleteChatThread(targetId); return { success: true }; } catch (e) { return { success: false, error: e.message }; }
  };

  const deleteChatMessage = async (messageId) => {
    if (!messageId) return { success: false };
    const currentChats = cloudSyncService.getCachedChats(); let targetThreadToBroadcast = null;
    const updated = currentChats.map(c => { if ((c.messages || []).some(m => m.id === messageId)) { const uThread = { ...c, messages: (c.messages || []).filter(m => m.id !== messageId) }; targetThreadToBroadcast = uThread; return uThread; } return c; });
    setChats([...updated]); cloudSyncService.saveCachedChats(updated);
    if (targetThreadToBroadcast) { cloudSyncService.notifySubscribers('CHAT_SYNC', { chats: updated, chat: targetThreadToBroadcast }); cloudSyncService.notifySubscribers('CHAT_POLL_SYNC', { chats: updated }); await cloudSyncService.broadcastChatMessage(targetThreadToBroadcast); }
    return { success: true };
  };

  const clearAllChats = async () => { const prevChats = [...chats]; setChats([]); cloudSyncService.saveCachedChats([]); cloudSyncService.notifySubscribers('CHAT_DELETED', { chats: [], threadId: 'ALL' }); cloudSyncService.notifySubscribers('CHAT_POLL_SYNC', { chats: [] }); for (const c of prevChats) if (c.id) { try { await cloudSyncService.deleteChatThread(c.id); } catch (e) {} } return { success: true }; };
  const addReport = (reportData) => { const newReport = { id: "rep_" + Date.now(), reporterUsername: currentUser?.username || 'anonymous', createdAt: new Date().toISOString(), ...reportData }; setReports(prev => [newReport, ...prev]); return newReport; };
  const resolveReport = (reportId) => setReports(prev => prev.filter(r => r.id !== reportId));
  const addReview = (reviewData) => { const newReview = { id: "rev_" + Date.now(), reviewerUsername: currentUser?.username || 'pioneer', createdAt: new Date().toISOString(), ...reviewData }; setReviews(prev => { const updated = [newReview, ...prev]; cloudSyncService.saveCachedReviews(updated); return updated; }); cloudSyncService.broadcastReview(newReview); return newReview; };
  const updatePlatformConfig = (newConfig) => { if (isAdmin) setPlatformConfig(prev => ({ ...prev, ...newConfig })); };

  return <RentoraContext.Provider value={{ items, rentals, transactions, favorites, reviews, reports, chats, chatThreads: chats, latestNotification, clearLatestNotification: () => setLatestNotification(null), platformConfig, isRefreshing, refreshApp, purgeDatabase, toggleFavorite, calculatePricing, addItem, createItemListing: addItem, updateItem, toggleItemStatus, deleteItem, createRentalBooking, executePiPaymentForRental, confirmHandoverOneTap, confirmReturnOneTap, sendChatMessage, deleteChatThread, deleteChat: deleteChatThread, deleteChatMessage, clearAllChats, addReport, resolveReport, addReview, updatePlatformConfig }}>
    {children}
  </RentoraContext.Provider>;
}

export function useRentora() { const context = useContext(RentoraContext); if (!context) throw new Error('useRentora must be used within a RentoraProvider'); return context; }
