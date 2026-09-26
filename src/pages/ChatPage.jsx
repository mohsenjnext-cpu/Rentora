import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Search, Send, ArrowLeft, ShieldCheck, Lock, AlertTriangle, User, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { inspectMessageSafety } from '../services/contactFilterService';
import ReportModal from '../components/ReportModal';

export default function ChatPage({ onNavigate }) {
  const { lang, dir, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen } = usePiAuth();
  const {
    conversations = [],
    refreshConversations,
    fetchConversationMessages,
    sendConversationMessage,
    markConversationAsRead
  } = useRentora();

  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [warning, setWarning] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const scrollRef = useRef(null);

  const selected = conversations.find(c => c.id === selectedId) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(c => {
      const u = c.otherUser || {};
      const title = c.listing?.title || c.item?.title || '';
      return [u.username, u.displayName, title, c.lastMessage?.text, c.last_message?.text]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    });
  }, [conversations, query]);

  const getOther = (c) => c?.otherUser || {
    username: c?.other_username || c?.otherUsername || 'pioneer',
    displayName: c?.other_username || c?.otherUsername || 'Pioneer',
    avatar: null
  };

  const loadList = async () => {
    if (!isAuthenticated) return;
    setLoadingList(true);
    try { await refreshConversations(); } finally { setLoadingList(false); }
  };

  const loadMessages = async (id) => {
    if (!id || !isAuthenticated) return;
    setLoadingMessages(true);
    setWarning('');
    try {
      const data = await fetchConversationMessages(id);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      if (markConversationAsRead) await markConversationAsRead(id);
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });
    } catch (e) {
      setWarning(e?.message || l('خطا در بارگذاری گفتگو.', 'Unable to load this conversation.', 'تعذر تحميل المحادثة.', '无法加载此会话。'));
    } finally { setLoadingMessages(false); }
  };

  useEffect(() => { loadList(); }, [isAuthenticated]);
  useEffect(() => { if (selectedId) loadMessages(selectedId); else setMessages([]); }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !isAuthenticated) return;
    const timer = setInterval(() => fetchConversationMessages(selectedId).then(data => {
      if (Array.isArray(data?.messages)) setMessages(data.messages);
    }).catch(() => {}), 2500);
    return () => clearInterval(timer);
  }, [selectedId, isAuthenticated, fetchConversationMessages]);

  const handleSend = async () => {
    const value = text.trim();
    if (!value || !selectedId || sending) return;
    const safety = inspectMessageSafety(value);
    if (safety.isViolating) {
      setWarning(safety.message || l('اطلاعات تماس و پرداخت خارج از رنتورا مجاز نیست.', 'Contact details and off-platform payment are restricted.', 'بيانات الاتصال والدفع خارج المنصة غير مسموحة.', '不允许发送站外联系方式或付款信息。'));
      return;
    }
    setWarning('');
    setSending(true);
    setText('');
    try {
      const msg = await sendConversationMessage(selectedId, { text: value });
      if (msg) setMessages(prev => [...prev.filter(m => m.id !== msg.id), msg]);
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });
      await loadList();
    } catch (e) {
      setText(value);
      setWarning(e?.message || l('ارسال پیام ناموفق بود.', 'Message could not be sent.', 'تعذر إرسال الرسالة.', '消息发送失败。'));
    } finally { setSending(false); }
  };

  if (!isAuthenticated) {
    return <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#534AB7] flex items-center justify-center"><MessageSquare className="w-8 h-8" /></div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{l('پیام‌ها', 'Messages', 'الرسائل', '消息')}</h2>
      <p className="text-sm text-slate-500">{l('برای مشاهده گفتگوهای خود وارد حساب Pi شوید.', 'Sign in with Pi to view your conversations.', 'سجل الدخول عبر Pi لعرض محادثاتك.', '请使用 Pi 登录以查看会话。')}</p>
      <button type="button" onClick={() => setAuthModalOpen(true)} className="btn-primary px-5 py-3">{l('ورود با Pi', 'Sign in with Pi', 'تسجيل الدخول عبر Pi', '使用 Pi 登录')}</button>
    </div>;
  }

  return <div className="max-w-7xl mx-auto h-[calc(100dvh-7.5rem)] min-h-[560px]">
    <div className="h-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151426] shadow-sm flex">
      <aside className={`w-full md:w-[360px] lg:w-[390px] shrink-0 border-e border-slate-200 dark:border-slate-800 flex flex-col ${selectedId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div><h1 className="text-lg font-bold text-slate-900 dark:text-white">{l('گفتگوها', 'Conversations', 'المحادثات', '会话')}</h1><p className="text-xs text-slate-500 mt-1">{conversations.length} {l('گفتگوی فعال', 'active chats', 'محادثات نشطة', '个活跃会话')}</p></div>
            <button type="button" onClick={loadList} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Refresh"><RefreshCw className={`w-4 h-4 text-[#534AB7] ${loadingList ? 'animate-spin' : ''}`} /></button>
          </div>
          <div className="mt-4 relative"><Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input value={query} onChange={e=>setQuery(e.target.value)} className="w-full ps-9 pe-3 h-11 rounded-xl bg-slate-100 dark:bg-[#1c1b30] outline-none text-sm" placeholder={l('جستجوی گفتگو...', 'Search conversations...', 'البحث في المحادثات...', '搜索会话...')} /></div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">{l('گفتگویی برای نمایش نیست.', 'No conversations to display.', 'لا توجد محادثات للعرض.', '暂无会话。')}</div> :
          filtered.map(c => {
            const u=getOther(c); const last=c.lastMessage?.text || c.last_message?.text || '';
            const unread=Number(c.unreadCount || c.unread_count || 0);
            return <button key={c.id} type="button" onClick={()=>setSelectedId(c.id)} className={`w-full text-start p-3 rounded-xl flex gap-3 hover:bg-slate-50 dark:hover:bg-[#1c1b30] ${selectedId===c.id?'bg-[#EEEDFE] dark:bg-[#26215C]':''}`}>
              {u.avatar ? <img src={u.avatar} alt="" className="w-11 h-11 rounded-xl object-cover bg-slate-100 shrink-0"/> : <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0"><User className="w-5 h-5 text-slate-400"/></div>}
              <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><span className="font-bold text-sm truncate text-slate-900 dark:text-white" dir="ltr">@{u.username || 'pioneer'}</span>{unread>0 && <span className="min-w-5 h-5 rounded-full bg-[#534AB7] text-white text-[10px] flex items-center justify-center px-1">{unread}</span>}</div><div className="text-[11px] text-slate-500 truncate mt-1">{c.listing?.title || c.item?.title || l('گفتگوی رنتورا','Rentora chat','محادثة رنتورا','Rentora 会话')}</div><p className="text-xs text-slate-500 truncate mt-1">{last || l('پیامی هنوز ارسال نشده است.','No messages yet.','لا توجد رسائل بعد.','暂无消息。')}</p></div>
            </button>;
          })}
        </div>
      </aside>

      <section className={`flex-1 flex-col min-w-0 ${selectedId ? 'flex' : 'hidden md:flex'}`}>
        {!selected ? <div className="h-full flex items-center justify-center text-center p-8"><div><MessageSquare className="w-10 h-10 mx-auto text-slate-300 mb-3"/><h2 className="font-bold text-slate-700 dark:text-slate-200">{l('یک گفتگو را انتخاب کنید','Select a conversation','اختر محادثة','选择一个会话')}</h2><p className="text-xs text-slate-400 mt-1">{l('پیام‌های امن رنتورا اینجا نمایش داده می‌شوند.','Your secure Rentora messages appear here.','ستظهر رسائل رنتورا الآمنة هنا.','您的 Rentora 安全消息会显示在这里。')}</p></div></div> :
        <><header className="h-[72px] px-4 md:px-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 shrink-0">
          <button type="button" onClick={()=>setSelectedId(null)} className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowLeft className="w-5 h-5" /></button>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><User className="w-5 h-5 text-slate-400"/></div>
          <div className="min-w-0 flex-1"><div className="font-bold text-sm text-slate-900 dark:text-white" dir="ltr">@{getOther(selected).username || 'pioneer'}</div><div className="text-[11px] text-slate-500 truncate">{selected.listing?.title || selected.item?.title || l('گفتگوی امن رنتورا','Rentora Secure Chat','محادثة رنتورا الآمنة','Rentora 安全聊天')}</div></div>
          <span className="text-[10px] px-2 py-1 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-1"><Lock className="w-3 h-3"/>{l('پیش از رزرو','Pre-booking','قبل الحجز','预订前')}</span><button type="button" onClick={() => setIsReportOpen(true)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" aria-label={l('گزارش گفتگو','Report conversation','الإبلاغ عن المحادثة','举报会话')} title={l('گزارش گفتگو','Report conversation','الإبلاغ عن المحادثة','举报会话')}><AlertTriangle className="w-4 h-4" /></button>
        </header>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
          {loadingMessages ? <div className="text-center py-10 text-xs text-slate-400">{l('در حال بارگذاری پیام‌ها...','Loading messages...','جار تحميل الرسائل...','正在加载消息...')}</div> :
          messages.length===0 ? <div className="h-full flex items-center justify-center text-center text-sm text-slate-400">{l('هنوز پیامی در این گفتگو نیست.','No messages in this conversation yet.','لا توجد رسائل في هذه المحادثة بعد.','此会话暂无消息。')}</div> :
          messages.map((m,i)=>{const mine=String(m.senderUid||m.sender_uid||m.senderUsername||'').toLowerCase()===String(currentUser?.uid||currentUser?.username||'').toLowerCase(); return <div key={m.id||i} className={`flex ${mine?'justify-end':'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${mine?'bg-[#534AB7] text-white rounded-br-md':'bg-slate-100 dark:bg-[#1c1b30] text-slate-800 dark:text-slate-100 rounded-bl-md'}`}>{m.text || m.content || ''}</div></div>;})}
        </div>
        {warning && <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0"/><span>{warning}</span></div>}
        <div className="p-3 md:p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex gap-2 items-end"><textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();}}} rows={1} className="flex-1 min-h-11 max-h-32 resize-none rounded-xl bg-slate-100 dark:bg-[#1c1b30] px-4 py-3 text-sm outline-none" placeholder={l('پیام خود را بنویسید...','Write a message...','اكتب رسالة...','输入消息...')} /><button type="button" onClick={handleSend} disabled={!text.trim()||sending} className="btn-primary min-h-11 px-4 flex items-center gap-2 disabled:opacity-50"><Send className="w-4 h-4"/><span className="hidden sm:inline">{l('ارسال','Send','إرسال','发送')}</span></button></div>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400"><ShieldCheck className="w-3 h-3"/>{l('پیش از رزرو، اطلاعات تماس و پرداخت خارج از رنتورا محدود است.','Before booking, off-platform contact and payment details are restricted.','قبل الحجز، يتم تقييد بيانات الاتصال والدفع خارج المنصة.','预订前会限制站外联系方式和付款信息。')}</div>
        </div></>}
      </section>
    </div>
  </div>;
  {selected && <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} type="conversation" target={{ id: selected.id, username: getOther(selected).username, title: selected.listing?.title || selected.item?.title || l('گفتگو','Conversation','محادثة','会话') }} />}
}
