import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { cloudSyncService } from '../services/cloudSyncService';
import { inspectMessageSafety, QUICK_QUESTIONS } from '../services/contactFilterService';
import { 
  X, 
  Send, 
  ShieldAlert, 
  Sparkles, 
  Coins, 
  CheckCheck, 
  Crown,
  AlertTriangle,
  ShieldCheck,
  MessageSquare,
  LogIn,
  ArrowRight,
  ArrowLeft,
  User,
  Clock,
  RotateCw
} from 'lucide-react';

export default function ChatModal({ 
  itemContext, 
  initialItem,
  isOpen, 
  onClose, 
  onBookDirectly,
  onDirectRent,
  onOpenPublicProfile
}) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen } = usePiAuth();
  const { chats = [], sendChatMessage, isUserPro, refreshApp } = useRentora();

  const [messageText, setMessageText] = useState('');
  const [filterWarningMessage, setFilterWarningMessage] = useState('');
  const [selectedThread, setSelectedThread] = useState(null);
  const messagesEndRef = useRef(null);

  const activeItem = itemContext || initialItem;

  // Determine current active chat thread or target recipient
  const targetRecipientUsername = activeItem?.ownerUsername || activeItem?.recipientUsername || null;
  const itemTitle = activeItem?.title || '';

  // Filter threads that belong to currentUser
  const myThreads = (chats || []).filter(th => {
    if (!currentUser?.username) return false;
    const myName = currentUser.username.toLowerCase();
    return th.renterUsername?.toLowerCase() === myName || th.ownerUsername?.toLowerCase() === myName;
  });

  // Determine which thread is currently open inside the chat
  let currentThread = null;
  if (selectedThread) {
    currentThread = (chats || []).find(th => th.id === selectedThread.id) || selectedThread;
  } else if (targetRecipientUsername) {
    currentThread = (chats || []).find(th => 
      (th.renterUsername?.toLowerCase() === currentUser?.username?.toLowerCase() && th.ownerUsername?.toLowerCase() === targetRecipientUsername?.toLowerCase()) ||
      (th.ownerUsername?.toLowerCase() === currentUser?.username?.toLowerCase() && th.renterUsername?.toLowerCase() === targetRecipientUsername?.toLowerCase())
    );
  }

  // Active recipient in the conversation
  let activeRecipient = targetRecipientUsername;
  if (!activeRecipient && currentThread) {
    activeRecipient = currentThread.renterUsername?.toLowerCase() === currentUser?.username?.toLowerCase()
      ? currentThread.ownerUsername
      : currentThread.renterUsername;
  }

  const isRecipientPro = activeRecipient ? isUserPro(activeRecipient) : false;
  const messagesList = currentThread?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Real-time Chat Sync interval (every 3 seconds while chat is open)
  useEffect(() => {
    if (!isOpen) return;

    if (activeItem) {
      setSelectedThread(null);
    }
    scrollToBottom();

    const interval = setInterval(async () => {
      try {
        await cloudSyncService.fetchSharedData();
      } catch (e) {}
    }, 3500);

    return () => clearInterval(interval);
  }, [isOpen, activeItem]);

  useEffect(() => {
    scrollToBottom();
  }, [messagesList.length]);

  if (!isOpen) return null;

  const handleSendMessage = (textToSend) => {
    if (!isAuthenticated || !currentUser) {
      setAuthModalOpen(true);
      return;
    }

    const text = (textToSend || messageText || '').trim();
    if (!text) return;

    // Strict Anti-Bypass Filter Inspection
    const safety = inspectMessageSafety(text);
    if (safety.isViolating) {
      setFilterWarningMessage(safety.message || t('chatPhoneWarning'));
      return;
    }

    setFilterWarningMessage('');
    try {
      sendChatMessage({
        recipientUsername: activeRecipient || 'pioneer',
        itemId: activeItem?.id || currentThread?.itemId || 'general',
        itemTitle: itemTitle || currentThread?.itemTitle || 'گفتگوی رنتورا',
        text: text
      });
      setMessageText('');
      setTimeout(scrollToBottom, 60);
    } catch (e) {
      setFilterWarningMessage(e.message || 'خطا در ارسال پیام.');
    }
  };

  const handleQuickQuestionClick = (q) => {
    const localizedQ = (lang === 'fa' ? q.fa : (lang === 'ar' ? q.ar : (lang === 'zh' ? q.zh : q.en)));
    handleSendMessage(localizedQ);
  };

  const handleBookingCTA = () => {
    onClose();
    if (onDirectRent && activeItem) onDirectRent(activeItem);
    else if (onBookDirectly && activeItem) onBookDirectly(activeItem);
  };

  // Check if we should show thread list view (e.g. opened from header and no target item)
  const isThreadListView = !activeItem && !selectedThread && myThreads.length > 0;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn select-none"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#151426] rounded-2xl w-full max-w-lg h-[88vh] max-h-[640px] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl animate-scaleIn overflow-hidden"
      >
        
        {/* Header */}
        <div className="p-3.5 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-[#1A1930]/70">
          
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
                  {myThreads.length} {l('گفتگوی فعال', 'active chats', 'محادثات نشطة', '个活跃会话')}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              {!activeItem && selectedThread && (
                <button
                  type="button"
                  onClick={() => setSelectedThread(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {dir === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                </button>
              )}

              <img
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${activeRecipient || 'pioneer'}`}
                alt=""
                className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-mono" dir="ltr">
                    @{activeRecipient || 'pioneer'}
                  </span>
                  {isRecipientPro && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400 text-[#26215C]">
                      PRO
                    </span>
                  )}
                  {activeItem?.ownerKYC && (
                    <span className="text-[9px] badge-trust px-1.5 py-0.2 rounded font-bold flex items-center gap-0.5">
                      <CheckCheck className="w-2.5 h-2.5" />
                      KYC
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 truncate max-w-[180px] sm:max-w-[260px]">
                  {itemTitle || currentThread?.itemTitle || l('گفتگوی امن رنتورا', 'Rentora Secure Chat', 'محادثة رنتورا الآمنة', 'Rentora 安全聊天')}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {activeItem && (
              <button
                type="button"
                onClick={handleBookingCTA}
                className="btn-primary px-3 py-1.5 text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('itemBookBtn')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Security / Policy Banner */}
        <div className="p-2 px-3 bg-[#EEEDFE]/70 dark:bg-[#1E1B3D]/70 border-b border-[#7F77DD]/20 text-[10px] sm:text-[11px] text-[#26215C] dark:text-[#EEEDFE] flex items-center gap-2 font-medium">
          <ShieldCheck className="w-4 h-4 text-[#534AB7] dark:text-[#AFA9EC] shrink-0" />
          <span className="truncate">{t('chatNotice')}</span>
        </div>

        {/* Phone Number Anti-Bypass Alert Warning */}
        {filterWarningMessage && (
          <div className="p-2.5 bg-rose-500/10 border-b border-rose-300/40 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-2 font-semibold animate-fadeIn">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{filterWarningMessage}</span>
          </div>
        )}

        {/* THREAD LIST VIEW (If opened with multiple conversations) */}
        {isThreadListView ? (
          <div className="flex-1 p-3 overflow-y-auto space-y-2">
            {myThreads.map(th => {
              const otherUser = th.renterUsername?.toLowerCase() === currentUser?.username?.toLowerCase() 
                ? th.ownerUsername 
                : th.renterUsername;
              const lastMsg = th.messages?.[th.messages.length - 1];
              return (
                <div
                  key={th.id}
                  onClick={() => setSelectedThread(th)}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#18172E] hover:border-[#534AB7] transition-all cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${otherUser}`}
                      alt=""
                      className="w-10 h-10 rounded-xl bg-slate-150 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900 dark:text-white font-mono" dir="ltr">
                          @{otherUser}
                        </span>
                        {isUserPro(otherUser) && (
                          <span className="px-1 py-0.2 rounded text-[8px] font-black bg-amber-400 text-[#26215C]">
                            PRO
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                        {lastMsg?.text || th.itemTitle || 'پیام جدید'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[9px] text-slate-400 block font-mono">
                      {lastMsg?.timestamp || ''}
                    </span>
                    <span className="text-[10px] text-[#534AB7] dark:text-[#AFA9EC] font-semibold">
                      {th.itemTitle}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ACTIVE CHAT MESSAGES BODY */
          <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3 bg-slate-50/40 dark:bg-[#121124]/40 text-xs">
            {messagesList.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#534AB7] dark:text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    {l('شروع گفتگو با کاربر', 'Start conversation', 'ابدأ المحادثة مع المستخدم', '与对方开启会话')}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                    {l('سوالات خود را درباره نحوه تحویل، سلامت کالا و زمان‌بندی بپرسید.', 'Ask questions regarding handover, item condition and scheduling.', 'اطرح استفساراتك حول الاستلام وحالة الغرض والمواعيد.', '您可以就交接方式、物品状况及时间安排向对方提问。')}
                  </p>
                </div>
              </div>
            ) : (
              messagesList.map((msg, idx) => {
                const isMe = msg.senderUsername?.toLowerCase() === currentUser?.username?.toLowerCase();
                return (
                  <div
                    key={msg.id || idx}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[82%] p-2.5 rounded-2xl text-xs leading-relaxed ${
                        isMe
                          ? 'bg-[#26215C] dark:bg-[#534AB7] text-white rounded-br-xs shadow-xs'
                          : 'bg-white dark:bg-[#1E1D33] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-xs shadow-2xs'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1 px-1 font-mono">
                      {msg.timestamp || 'هم‌اکنون'}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Not Logged In CTA Banner */}
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

        {/* Quick Question Chips (Only when inside active chat) */}
        {!isThreadListView && isAuthenticated && (
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

        {/* Input Bar (Only when inside active chat) */}
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
              disabled={!isAuthenticated}
              onChange={(e) => {
                setMessageText(e.target.value);
                if (filterWarningMessage) setFilterWarningMessage('');
              }}
              placeholder={isAuthenticated ? t('chatInputPlaceholder') : l('جهت ارسال پیام وارد شوید...', 'Sign in to chat...', 'سجل الدخول للمراسلة...', '登录后即可输入消息...')}
              className="flex-1 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#121124] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!isAuthenticated || !messageText.trim()}
              className="btn-primary p-2.5 rounded-xl cursor-pointer disabled:opacity-40 shrink-0"
              title={t('chatSendBtn')}
            >
              <Send className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
