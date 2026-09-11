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
  ShieldCheck, 
  MessageSquare, 
  LogIn, 
  ArrowRight, 
  ArrowLeft, 
  Trash2
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
  const { 
    chats = [], 
    sendChatMessage, 
    deleteChatThread, 
    deleteChatMessage, 
    clearAllChats,
    isUserPro 
  } = useRentora();

  const [messageText, setMessageText] = useState('');
  const [filterWarningMessage, setFilterWarningMessage] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [selectedRecipientName, setSelectedRecipientName] = useState(null);
  const [threadToDelete, setThreadToDelete] = useState(null);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const messagesEndRef = useRef(null);

  const activeItem = itemContext || initialItem;
  const itemRecipientUsername = activeItem?.ownerUsername || activeItem?.recipientUsername || null;
  const itemTitle = activeItem?.title || '';

  // Determine current active recipient
  const activeRecipient = itemRecipientUsername || selectedRecipientName || null;

  // Filter threads belonging to current user
  const myThreads = (chats || []).filter(th => {
    if (!currentUser?.username) return false;
    const myName = currentUser.username.toLowerCase();
    const u1 = (th.renterUsername || '').toLowerCase();
    const u2 = (th.ownerUsername || '').toLowerCase();
    return u1 === myName || u2 === myName;
  });

  // Find currently open thread dynamically from live chats state
  const myName = (currentUser?.username || '').toLowerCase();
  const currentThread = (chats || []).find(th => {
    if (selectedThreadId && th.id === selectedThreadId) return true;
    if (activeRecipient) {
      const targetName = activeRecipient.toLowerCase();
      const u1 = (th.renterUsername || '').toLowerCase();
      const u2 = (th.ownerUsername || '').toLowerCase();
      return (u1 === myName && u2 === targetName) || (u2 === myName && u1 === targetName);
    }
    return false;
  }) || null;

  const messagesList = currentThread?.messages || [];
  const isRecipientPro = activeRecipient ? isUserPro(activeRecipient) : false;

  const scrollToBottom = (smooth = true) => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    } catch (e) {}
  };

  // Setup on modal open / item change
  useEffect(() => {
    if (!isOpen) return;

    if (activeItem) {
      setSelectedThreadId(null);
      setSelectedRecipientName(itemRecipientUsername);
    }

    scrollToBottom(false);

    // Immediate fast sync on modal open
    cloudSyncService.fetchSharedData(true).catch(() => {});

    // Polling every 600ms while chat screen is actively open
    const interval = setInterval(async () => {
      try {
        await cloudSyncService.fetchSharedData(true);
      } catch (e) {}
    }, 600);

    return () => clearInterval(interval);
  }, [isOpen, activeItem, itemRecipientUsername]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && messagesList.length > 0) {
      scrollToBottom(true);
    }
  }, [isOpen, messagesList.length]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend) => {
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
    setMessageText('');

    try {
      await sendChatMessage({
        recipientUsername: activeRecipient || 'pioneer',
        itemId: activeItem?.id || currentThread?.itemId || 'general',
        itemTitle: itemTitle || currentThread?.itemTitle || 'گفتگوی رنتورا',
        text: text
      });
      setTimeout(() => scrollToBottom(true), 40);
      setTimeout(() => scrollToBottom(true), 200);
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

  const isThreadListView = !activeItem && !selectedThreadId && !selectedRecipientName && myThreads.length > 0;

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
                  {myThreads.length} {l('گفتگوی فعال', 'active chats', 'محادثات نشطة', '个活跃会话')}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              {!activeItem && (selectedThreadId || selectedRecipientName) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedThreadId(null);
                    setSelectedRecipientName(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
                  title={t('btnBack')}
                >
                  {dir === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                </button>
              )}

              <img
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${activeRecipient || 'pioneer'}`}
                alt=""
                className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-mono truncate" dir="ltr">
                    @{activeRecipient || 'pioneer'}
                  </span>
                  {isRecipientPro && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400 text-[#26215C] shrink-0">
                      PRO
                    </span>
                  )}
                  {activeItem?.ownerKYC && (
                    <span className="text-[9px] badge-trust px-1.5 py-0.2 rounded font-bold flex items-center gap-0.5 shrink-0">
                      <CheckCheck className="w-2.5 h-2.5" />
                      KYC
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => cloudSyncService.fetchSharedData(true)}
                    className="p-1 rounded-md text-slate-400 hover:text-[#534AB7] dark:hover:text-[#AFA9EC] transition cursor-pointer"
                    title={l('همگام‌سازی زنده', 'Live Sync', 'تزامن مباشر', '实时同步')}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse block"></span>
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 truncate max-w-[140px] sm:max-w-[200px]">
                  {itemTitle || currentThread?.itemTitle || l('گفتگوی امن رنتورا', 'Rentora Secure Chat', 'محادثة رنتورا الآمنة', 'Rentora 安全聊天')}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons in Header */}
          <div className="flex items-center gap-1.5 shrink-0">
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

            {/* DEDICATED VISIBLE DELETE CHAT BUTTON */}
            {!isThreadListView && (
              <button
                type="button"
                onClick={() => {
                  const target = currentThread || {
                    id: selectedThreadId || activeItem?.id || activeRecipient || 'current',
                    recipientUsername: activeRecipient,
                    itemTitle: itemTitle || currentThread?.itemTitle
                  };
                  setThreadToDelete(target);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                title={t('chatDeleteBtn')}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span className="text-[11px]">{t('chatDeleteBtn')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Security Banner */}
        <div className="p-2 px-3 bg-[#EEEDFE]/70 dark:bg-[#1E1B3D]/70 border-b border-[#7F77DD]/20 text-[10px] sm:text-[11px] text-[#26215C] dark:text-[#EEEDFE] flex items-center gap-2 font-medium">
          <ShieldCheck className="w-4 h-4 text-[#534AB7] dark:text-[#AFA9EC] shrink-0" />
          <span className="truncate">{t('chatNotice')}</span>
        </div>

        {/* Safety Warning */}
        {filterWarningMessage && (
          <div className="p-2.5 bg-rose-500/10 border-b border-rose-300/40 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-2 font-semibold animate-fadeIn">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{filterWarningMessage}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 1: THREAD LIST VIEW                                  */}
        {/* ========================================================= */}
        {isThreadListView ? (
          <div className="flex-1 p-3 overflow-y-auto space-y-2">
            <div className="flex items-center justify-between pb-1 px-1">
              <span className="text-[11px] text-slate-500 font-bold">
                {l('لیست گفتگوهای شما', 'Your conversation list', 'قائمة محادثاتك', '您的会话列表')}
              </span>
              {myThreads.length > 1 && (
                <button
                  type="button"
                  onClick={() => setThreadToDelete('ALL_CHATS')}
                  className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{l('حذف همه گفتگوها', 'Delete all chats', 'حذف جميع المحادثات', '清除全部会话')}</span>
                </button>
              )}
            </div>

            {myThreads.map(th => {
              const otherUser = (th.renterUsername || '').toLowerCase() === myName
                ? th.ownerUsername 
                : th.renterUsername;
              const lastMsg = th.messages?.[th.messages.length - 1];

              return (
                <div
                  key={th.id}
                  onClick={() => {
                    setSelectedThreadId(th.id);
                    setSelectedRecipientName(otherUser);
                  }}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#18172E] hover:border-[#534AB7] transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${otherUser || 'pioneer'}`}
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
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px] sm:max-w-[240px]">
                        {lastMsg?.text || th.itemTitle || 'پیام جدید'}
                      </p>
                    </div>
                  </div>

                  {/* Actions on Card: Timestamp + Red Delete Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 block font-mono">
                        {lastMsg?.timestamp || ''}
                      </span>
                      <span className="text-[10px] text-[#534AB7] dark:text-[#AFA9EC] font-semibold truncate max-w-[90px] block">
                        {th.itemTitle}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setThreadToDelete(th);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                      title={t('chatDeleteBtn')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('btnDelete')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ========================================================= */
          /* VIEW 2: ACTIVE CONVERSATION MESSAGES                      */
          /* ========================================================= */
          <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3 bg-slate-50/40 dark:bg-[#121124]/40 text-xs">
            
            {/* Clear messages banner if conversation has messages */}
            {messagesList.length > 0 && (
              <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-slate-100 dark:bg-[#191830] rounded-xl border border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-medium">
                  {messagesList.length} {l('پیام ثبت‌شده در این گفتگو', 'messages in this chat', 'رسائل في هذه المحادثة', '条聊天记录')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const target = currentThread || {
                      id: selectedThreadId || activeItem?.id || activeRecipient || 'current',
                      recipientUsername: activeRecipient,
                      itemTitle: itemTitle || currentThread?.itemTitle
                    };
                    setThreadToDelete(target);
                  }}
                  className="text-rose-600 dark:text-rose-400 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{l('حذف کامل این گفتگو', 'Delete conversation', 'حذف المحادثة', '清空本段会话')}</span>
                </button>
              </div>
            )}

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
                const isMe = (msg.senderUsername || '').toLowerCase() === myName;
                return (
                  <div
                    key={msg.id || idx}
                    className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`flex items-center gap-1.5 max-w-[90%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div
                        className={`p-2.5 rounded-2xl text-xs leading-relaxed ${
                          isMe
                            ? 'bg-[#26215C] dark:bg-[#534AB7] text-white rounded-br-xs shadow-xs'
                            : 'bg-white dark:bg-[#1E1D33] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-xs shadow-2xs'
                        }`}
                      >
                        {msg.text}
                      </div>

                      {/* Delete Individual Message Button */}
                      <button
                        type="button"
                        onClick={() => setMessageToDelete(msg)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer shrink-0"
                        title={l('حذف این پیام', 'Delete message', 'حذف الرسالة', '删除此消息')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="text-[9px] text-slate-400 mt-0.5 px-1 font-mono">
                      {msg.timestamp || 'هم‌اکنون'}
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

        {/* Quick Question Chips */}
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

        {/* ========================================================= */}
        {/* CONFIRMATION DIALOG: DELETE ENTIRE CONVERSATION            */}
        {/* ========================================================= */}
        {threadToDelete && (
          <div 
            onClick={() => !isDeleting && setThreadToDelete(null)}
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
                  {threadToDelete === 'ALL_CHATS' 
                    ? l('حذف تمامی گفتگوها', 'Delete All Conversations', 'حذف جميع المحادثات', '清除所有会话')
                    : t('chatDeleteConfirmTitle')
                  }
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {threadToDelete === 'ALL_CHATS'
                    ? l('آیا از حذف تمام گفتگوها و پیام‌ها اطمینان دارید؟ این عمل غیرقابل بازگشت است.', 'Are you sure you want to delete all chat threads? This cannot be undone.', 'هل أنت متأكد من حذف جميع المحادثات والرسائل؟ لا يمكن التراجع عن هذا الإجراء.', '您确定要清空所有聊天记录吗？此操作不可恢复。')
                    : t('chatDeleteConfirmDesc')
                  }
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      if (threadToDelete === 'ALL_CHATS') {
                        await clearAllChats();
                        setSelectedThreadId(null);
                        setSelectedRecipientName(null);
                      } else {
                        await deleteChatThread(threadToDelete);
                        setSelectedThreadId(null);
                        setSelectedRecipientName(null);
                      }
                      setThreadToDelete(null);
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
                  onClick={() => setThreadToDelete(null)}
                  className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  {t('btnCancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* CONFIRMATION DIALOG: DELETE INDIVIDUAL MESSAGE            */}
        {/* ========================================================= */}
        {messageToDelete && (
          <div 
            onClick={() => setMessageToDelete(null)}
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#1A1930] rounded-2xl p-5 max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-3 animate-scaleIn text-center"
            >
              <div className="w-10 h-10 mx-auto rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                  {l('حذف این پیام؟', 'Delete this message?', 'حذف هذه الرسالة؟', '删除此条消息？')}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 px-2 bg-slate-50 dark:bg-[#141324] py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  "{messageToDelete.text}"
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    await deleteChatMessage(messageToDelete.id);
                    setMessageToDelete(null);
                  }}
                  className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('btnDelete')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMessageToDelete(null)}
                  className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
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
