import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { inspectMessageSafety, QUICK_QUESTIONS } from '../services/contactFilterService';
import { 
  X, 
  Send, 
  ShieldAlert, 
  Sparkles, 
  Coins, 
  CheckCheck, 
  ShieldCheck, 
  MessageSquare, 
  LogIn, 
  ArrowRight, 
  ArrowLeft, 
  Trash2,
  Lock,
  Unlock,
  Info,
  Calendar,
  AlertTriangle
} from 'lucide-react';

export default function ChatModal({ 
  itemContext, 
  initialItem,
  rentalContext,
  initialRental,
  isOpen, 
  onClose, 
  onBookDirectly,
  onDirectRent,
  onOpenPublicProfile
}) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen } = usePiAuth();
  const { 
    conversations = [],
    refreshConversations,
    getOrCreateConversation,
    fetchConversationMessages,
    sendConversationMessage,
    archiveConversation
  } = useRentora();

  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [filterWarningMessage, setFilterWarningMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [convToDelete, setConvToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const messagesEndRef = useRef(null);

  const activeItem = itemContext || initialItem;
  const activeRental = rentalContext || initialRental;

  const myUid = currentUser?.uid || currentUser?.id;
  const myUsername = (currentUser?.username || '').toLowerCase().replace('@', '').trim();
  const ownerUid = activeItem?.ownerUid || activeItem?.owner_uid;
  const ownerUsername = (activeItem?.ownerUsername || activeItem?.owner_username || '').toLowerCase().replace('@', '').trim();
  const isItemOwner = Boolean(
    currentUser && activeItem && (
      (myUid && ownerUid && myUid === ownerUid) ||
      (myUsername && ownerUsername && myUsername === ownerUsername)
    )
  );

  const scrollToBottom = (smooth = true) => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    } catch (e) {}
  };

  // Find active conversation from loaded conversations or from messages response
  const activeConversation = conversations.find(c => c.id === activeConvId) || null;

  // Mode resolution: is this pre-booking inquiry or post-booking coordination?
  const isPostBooking = Boolean(
    activeConversation?.type === 'post_booking' || 
    activeConversation?.isPostBookingUnlocked ||
    (activeRental && activeRental.paymentStatus === 'completed' && ['confirmed', 'active', 'completed'].includes(activeRental.status))
  );

  // Initialize or fetch conversation when modal opens or target changes
  useEffect(() => {
    if (!isOpen) {
      setActiveConvId(null);
      setMessages([]);
      setFilterWarningMessage('');
      return;
    }

    let isMounted = true;

    async function initConversation() {
      if (!isAuthenticated || !currentUser) {
        return;
      }

      setIsLoadingMessages(true);
      try {
        if (activeRental?.id) {
          const res = await getOrCreateConversation({ rentalId: activeRental.id });
          if (isMounted && res?.conversationId) {
            setActiveConvId(res.conversationId);
          }
        } else if (activeItem?.id) {
          if (isItemOwner) {
            if (isMounted) {
              setFilterWarningMessage(l(
                'شما مالک این کالا هستید (امکان گفتگو یا رزرو برای مالک وجود ندارد).',
                'You are the owner of this listing.',
                'أنت صاحب هذا الإعلان.',
                '您是该物品的物主。'
              ));
            }
            return;
          }
          const res = await getOrCreateConversation({ listingId: activeItem.id });
          if (isMounted && res?.conversationId) {
            setActiveConvId(res.conversationId);
          }
        } else {
          // General chat view: load all conversations
          const list = await refreshConversations();
          if (isMounted && list && list.length === 1 && !activeConvId) {
            setActiveConvId(list[0].id);
          }
        }
      } catch (err) {
        console.warn('Init conversation error:', err.message);
        if (isMounted) {
          if (err.message?.includes('Self-conversation') || err.message?.includes('خودتان')) {
            setFilterWarningMessage(l(
              'شما مالک این کالا هستید و امکان گفتگو با خودتان وجود ندارد.',
              'You are the owner of this item. Self-conversation is not allowed.',
              'أنت صاحب هذا الغرض ولا يمكنك محادثة نفسك.',
              '您是该物品的物主，无法与自己发起对话。'
            ));
          } else {
            setFilterWarningMessage(err.message || 'خطا در بارگذاری گفتگو');
          }
        }
      } finally {
        if (isMounted) setIsLoadingMessages(false);
      }
    }

    initConversation();

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeItem?.id, activeRental?.id, isAuthenticated, currentUser, isItemOwner]);

  // Load messages whenever activeConvId changes
  const loadMessages = useCallback(async (convId, silent = false) => {
    if (!convId || !isAuthenticated) return;
    if (!silent) setIsLoadingMessages(true);
    try {
      const data = await fetchConversationMessages(convId);
      if (data && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.warn('Fetch messages error:', err.message);
    } finally {
      if (!silent) setIsLoadingMessages(false);
    }
  }, [fetchConversationMessages, isAuthenticated]);

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId, false);
      scrollToBottom(false);
    } else {
      setMessages([]);
    }
  }, [activeConvId, loadMessages]);

  // Fast polling for active conversation messages while modal is open
  useEffect(() => {
    if (!isOpen || !activeConvId || !isAuthenticated) return;

    const interval = setInterval(() => {
      loadMessages(activeConvId, true);
    }, 1500);

    return () => clearInterval(interval);
  }, [isOpen, activeConvId, isAuthenticated, loadMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      scrollToBottom(true);
    }
  }, [isOpen, messages.length]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend) => {
    if (!isAuthenticated || !currentUser) {
      setAuthModalOpen(true);
      return;
    }

    const text = (textToSend || messageText || '').trim();
    if (!text) return;

    if (isItemOwner) {
      setFilterWarningMessage(l(
        'شما مالک این کالا هستید و امکان گفتگو با خودتان وجود ندارد.',
        'You are the owner of this item. Self-conversation is not allowed.',
        'أنت صاحب هذا الغرض ولا يمكنك محادثة نفسك.',
        '您是该物品的物主，无法与自己发起对话。'
      ));
      return;
    }

    // Strict Anti-Bypass Filter Inspection for Pre-Booking Mode
    if (!isPostBooking) {
      const safety = inspectMessageSafety(text);
      if (safety.isViolating) {
        setFilterWarningMessage(safety.message || t('chatPhoneWarning'));
        return;
      }
    }

    setFilterWarningMessage('');
    setMessageText('');
    setIsSending(true);

    try {
      let targetId = activeConvId;
      if (!targetId) {
        if (activeRental?.id) {
          const res = await getOrCreateConversation({ rentalId: activeRental.id });
          targetId = res.conversationId;
        } else if (activeItem?.id) {
          const res = await getOrCreateConversation({ listingId: activeItem.id });
          targetId = res.conversationId;
        }
        if (targetId) setActiveConvId(targetId);
      }

      if (!targetId) throw new Error('شناسه گفتگوی معتبر یافت نشد.');

      const newMsg = await sendConversationMessage(targetId, { text });
      if (newMsg) {
        setMessages(prev => [...prev, newMsg]);
        setTimeout(() => scrollToBottom(true), 50);
      }
    } catch (e) {
      setFilterWarningMessage(e.message || 'خطا در ارسال پیام.');
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickQuestionClick = (q) => {
    const localizedQ = (lang === 'fa' ? q.fa : (lang === 'ar' ? q.ar : (lang === 'zh' ? q.zh : q.en)));
    handleSendMessage(localizedQ);
  };

  const handleBookingCTA = () => {
    if (isItemOwner) return;
    onClose();
    if (onDirectRent && activeItem) onDirectRent(activeItem);
    else if (onBookDirectly && activeItem) onBookDirectly(activeItem);
  };

  const isThreadListView = !activeConvId && !activeItem && !activeRental;

  const otherUser = activeConversation?.otherUser || {
    username: activeItem?.ownerUsername || 'pioneer',
    displayName: activeItem?.ownerUsername || 'Pioneer',
    avatar: activeItem?.ownerAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${activeItem?.ownerUsername || 'pioneer'}`
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn select-none"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#151426] rounded-2xl w-full max-w-lg h-[88vh] max-h-[640px] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl animate-scaleIn overflow-hidden"
      >
        
        {/* ========================================================= */}
        {/* TOP HEADER                                                */}
        {/* ========================================================= */}
        <div className="p-3.5 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-[#1A1930]/90">
          
          {isThreadListView ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#EEEDFE] dark:bg-[#26215C] text-[#534AB7] dark:text-[#EEEDFE] flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('chatTitle')}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {conversations.length} {l('گفتگوی فعال', 'active chats', 'محادثات نشطة', '个活跃会话')}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              {(!activeItem && !activeRental && activeConvId) && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveConvId(null);
                    setMessages([]);
                    refreshConversations();
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
                  title={t('btnBack')}
                >
                  {dir === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                </button>
              )}

              <img
                src={otherUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${otherUser.username || 'pioneer'}`}
                alt=""
                className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 shrink-0 object-cover"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-mono truncate" dir="ltr">
                    @{otherUser.username}
                  </span>
                  
                  {/* Mode Badge: Pre-Booking vs Post-Booking */}
                  {isPostBooking ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      {l('هماهنگی رزرو', 'Coordination', 'تنسيق الحجز', '交接协调')}
                    </span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 shrink-0">
                      <Lock className="w-2.5 h-2.5" />
                      {l('پیش از رزرو', 'Pre-Booking', 'قبل الحجز', '预订咨询')}
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-slate-400 truncate max-w-[160px] sm:max-w-[220px]">
                  {activeConversation?.listing?.title || activeItem?.title || l('گفتگوی امن رنتورا', 'Rentora Secure Chat', 'محادثة رنتورا الآمنة', 'Rentora 安全聊天')}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons in Header */}
          <div className="flex items-center gap-1.5 shrink-0">
            {activeItem && !isPostBooking && !isItemOwner && (
              <button
                type="button"
                onClick={handleBookingCTA}
                className="btn-primary px-3 py-1.5 text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('itemBookBtn')}</span>
              </button>
            )}

            {!isThreadListView && activeConvId && (
              <button
                type="button"
                onClick={() => setConvToDelete(activeConvId)}
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                title={t('chatDeleteBtn')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title={t('btnCancel')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MODE BANNER & ANTI-BYPASS NOTICE                          */}
        {/* ========================================================= */}
        {!isThreadListView && (
          <div>
            {isPostBooking ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 border-b border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2 text-[11px] text-emerald-900 dark:text-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-snug">
                  {l('رزرو شما تایید شده است. می‌توانید آزادانه درباره نشانی دقیق، زمان تحویل و هماهنگی‌های لازم گفتگو کنید.', 'Booking is confirmed! You can freely coordinate pickup location, exact timing, and instructions.', 'تم تأكيد الحجز! يمكنك التنسيق بحرية حول العنوان وموعد الاستلام.', '订单已确认！您可以在此直接沟通准确交接地址与时间。')}
                </span>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-950/40 px-3 py-2 border-b border-amber-200 dark:border-amber-800/60 flex items-start gap-2 text-[11px] text-amber-900 dark:text-amber-200">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span className="leading-snug">
                  {l('گفتگوی اولیه درباره آگهی: تبادل اطلاعات تماس، آیدی یا شماره تلفن تا پیش از تایید رزرو مسدود است.', 'Pre-Booking Chat: Exchanging contact info or phone numbers is strictly prohibited before confirmed booking.', 'محادثة أولية: يُمنع تبادل أرقام الهواتف أو الروابط قبل تأكيد الحجز.', '预订前咨询：在订单支付确认前，禁止交换联系电话及外部社交账号。')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* FILTER VIOLATION WARNING BANNER                           */}
        {/* ========================================================= */}
        {filterWarningMessage && (
          <div className="bg-rose-50 dark:bg-rose-950/50 p-2.5 border-b border-rose-200 dark:border-rose-900/60 flex items-start gap-2 text-rose-700 dark:text-rose-300 text-xs animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1 text-[11px] leading-relaxed">
              {filterWarningMessage}
            </div>
            <button
              type="button"
              onClick={() => setFilterWarningMessage('')}
              className="text-rose-400 hover:text-rose-700 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* BODY: CONVERSATION LIST VIEW                              */}
        {/* ========================================================= */}
        {isThreadListView ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {conversations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-[#1E1D33] flex items-center justify-center text-slate-400">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <p className="text-xs font-medium">
                  {l('هنوز هیچ گفتگویی ثبت نشده است.', 'No conversations yet.', 'لا توجد محادثات بعد.', '暂无任何会话记录。')}
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  {l('با کلیک روی دکمه گفتگو در صفحه هر کالا، می‌توانید با صاحب کالا پیام رد و بدل کنید.', 'Click chat on any listing to start a conversation with the owner.', 'اضغط على زر المحادثة في صفحة أي غرض لبدء التواصل.', '在物品详情页点击沟通按钮即可向物主发起咨询。')}
                </p>
              </div>
            ) : (
              conversations.map(conv => {
                const partner = conv.otherUser || { username: 'pioneer', displayName: 'Pioneer' };
                const isPaid = conv.type === 'post_booking' || conv.isPostBookingUnlocked;
                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-[#1A1930] hover:bg-[#EEEDFE]/40 dark:hover:bg-[#26215C]/40 border border-slate-200 dark:border-slate-800 transition cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={partner.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.username || 'pioneer'}`}
                        alt=""
                        className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900 dark:text-white font-mono" dir="ltr">
                            @{partner.username}
                          </span>
                          {isPaid ? (
                            <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                              {l('رزرو قطعی', 'Paid Booking', 'حجز مؤكد', '已付款')}
                            </span>
                          ) : (
                            <span className="text-[8px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
                              {l('استعلام اولیه', 'Inquiry', 'استفسار', '咨询')}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {conv.listing?.title || l('کالای رنتورا', 'Rentora Item', 'غرض رنتورا', '物品')}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                          {conv.lastMessageText || l('شروع گفتگو...', 'Start conversation...', 'بدء المحادثة...', '开始沟通...')}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[9px] text-slate-400 font-mono">
                        {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* ========================================================= */
          /* BODY: ACTIVE CONVERSATION MESSAGES                        */
          /* ========================================================= */
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/50 dark:bg-[#121124]/50">
            {isLoadingMessages ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#534AB7]"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#534AB7] dark:text-[#AFA9EC] flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    {isPostBooking 
                      ? l('هماهنگی تحویل کالا', 'Pickup & Handover Coordination', 'تنسيق التسليم', '交接协调')
                      : l('پرسش درباره وضعیت و شرایط کالا', 'Ask about condition & availability', 'استفسر عن الحالة والتسليم', '咨询设备状态与租借事宜')}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                    {isPostBooking
                      ? l('رزرو شما تایید شده است. می‌توانید درباره زمان و محل تحویل کالا پیام ارسال کنید.', 'Your booking is confirmed. Send a message to coordinate pickup location and time.', 'تم تأكيد الحجز. يمكنك التنسيق بشأن الموعد والمكان.', '您的订单已确认，请在此沟通设备交接时间与地点。')
                      : l('برای شروع، سوال خود را بنویسید یا از گزینه‌های آماده زیر استفاده کنید.', 'Type your inquiry below or tap a quick question chip.', 'اكتب استفسارك أو اختر من الأسئلة الجاهزة.', '请在下方输入您的疑问或点击快捷短语快速咨询。')}
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = (msg.senderUsername || '').toLowerCase() === (currentUser?.username || '').toLowerCase();
                const isSystem = msg.messageType === 'system' || msg.messageType === 'handover_notice' || msg.messageType === 'status_update';

                if (isSystem) {
                  return (
                    <div key={msg.id || idx} className="flex justify-center my-2">
                      <div className="bg-slate-200/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 text-[10px] px-3 py-1 rounded-full border border-slate-300 dark:border-slate-700 font-mono flex items-center gap-1.5">
                        <Info className="w-3 h-3 text-[#534AB7] dark:text-[#AFA9EC]" />
                        <span>{msg.text}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id || idx}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-end gap-1.5 max-w-[85%]">
                      {!isMe && (
                        <img
                          src={msg.senderAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.senderUsername || 'pioneer'}`}
                          alt=""
                          className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 object-cover shrink-0 mb-1"
                        />
                      )}
                      <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed break-words ${
                          isMe
                            ? 'bg-[#534AB7] text-white rounded-br-xs'
                            : 'bg-white dark:bg-[#1E1D33] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 rounded-bl-xs'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>

                    <span className="text-[9px] text-slate-400 mt-0.5 px-1 font-mono">
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Not Logged In Banner */}
        {!isAuthenticated && (
          <div className="p-3 bg-amber-500/10 border-t border-amber-300/40 flex items-center justify-between gap-2">
            <span className="text-xs text-amber-900 dark:text-amber-300 font-medium">
              {l('برای ارسال پیام، ابتدا وارد حساب کاربری خود شوید.', 'Please sign in to send messages.', 'يرجى تسجيل الدخول لإرسال الرسائل.', '请登录后发送消息与物主沟通。')}
            </span>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="btn-primary px-3 py-1.5 text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t('navLogin')}</span>
            </button>
          </div>
        )}

        {/* Quick Question Chips (Pre-booking mode) */}
        {!isThreadListView && isAuthenticated && !isPostBooking && (
          <div className="p-2 border-t border-slate-150 dark:border-slate-800 bg-white dark:bg-[#151426] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {QUICK_QUESTIONS.map(q => {
              const localizedQ = (lang === 'fa' ? q.fa : (lang === 'ar' ? q.ar : (lang === 'zh' ? q.zh : q.en)));
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => handleQuickQuestionClick(q)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap bg-slate-100 dark:bg-[#1E1D33] text-slate-700 dark:text-slate-300 hover:bg-[#EEEDFE] dark:hover:bg-[#26215C] hover:text-[#26215C] dark:hover:text-white transition cursor-pointer"
                >
                  {localizedQ}
                </button>
              );
            })}
          </div>
        )}

        {/* Input Bar */}
        {!isThreadListView && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 sm:p-3 border-t border-slate-150 dark:border-slate-800 bg-white dark:bg-[#151426] flex items-center gap-2"
          >
            <input
              type="text"
              value={messageText}
              disabled={!isAuthenticated || isSending}
              onChange={(e) => {
                setMessageText(e.target.value);
                if (filterWarningMessage) setFilterWarningMessage('');
              }}
              placeholder={isAuthenticated 
                ? (isPostBooking 
                    ? l('پیام هماهنگی تحویل کالا، آدرس یا زمان...', 'Coordination message regarding pickup...', 'اكتب رسالة التنسيق...', '输入关于交接时间与地址的沟通...')
                    : t('chatInputPlaceholder')) 
                : l('جهت ارسال پیام وارد شوید...', 'Sign in to chat...', 'سجل الدخول للمراسلة...', '登录后即可输入消息...')}
              className="flex-1 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#121124] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!isAuthenticated || !messageText.trim() || isSending}
              className="btn-primary p-2.5 rounded-xl cursor-pointer disabled:opacity-40 shrink-0"
              title={t('chatSendBtn')}
            >
              <Send className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
            </button>
          </form>
        )}

        {/* ========================================================= */}
        {/* CONFIRMATION DIALOG: ARCHIVE / DELETE CONVERSATION         */}
        {/* ========================================================= */}
        {convToDelete && (
          <div 
            onClick={() => !isDeleting && setConvToDelete(null)}
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#1A1930] rounded-2xl p-5 max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 animate-scaleIn text-center"
            >
              <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('chatDeleteConfirmTitle')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {t('chatDeleteConfirmDesc')}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await archiveConversation(convToDelete);
                      setConvToDelete(null);
                      setActiveConvId(null);
                      setMessages([]);
                      await refreshConversations();
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeleting ? l('در حال حذف...', 'Deleting...', 'جارٍ الحذف...', '正在删除...') : t('btnDelete')}</span>
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setConvToDelete(null)}
                  className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  {t('btnCancel')}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
