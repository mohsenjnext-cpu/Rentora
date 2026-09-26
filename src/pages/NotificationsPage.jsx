import React, { useMemo, useState } from 'react';
import { Bell, CheckCheck, ChevronRight, Coins, MessageCircle, Package, Receipt, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';

export default function NotificationsPage({ onNavigate, onOpenChat }) {
  const { lang, l } = useLanguage();
  const { currentUser, isAuthenticated } = usePiAuth();
  const { rentals = [], transactions = [], conversations = [], items = [] } = useRentora();
  const [filter, setFilter] = useState('all');
  const [readIds, setReadIds] = useState(() => new Set());

  const notifications = useMemo(() => {
    const events = [];
    const add = (id, type, title, detail, time, action) => {
      if (id && time) events.push({ id, type, title, detail, time, action });
    };
    (rentals || []).forEach(r => add('rental:' + (r.id || r.bookingNumber), 'rentals',
      l('وضعیت اجاره به‌روزرسانی شد', 'Rental status updated', 'تم تحديث حالة الإيجار', '租赁状态已更新'),
      (r.itemTitle || l('کالا', 'Item', 'غرض', '物品')) + ' • ' + (r.status || ''), r.updatedAt || r.createdAt, 'activity'));
    (transactions || []).forEach(tx => add('payment:' + (tx.id || tx.txid || tx.timestamp), 'payments',
      l('رویداد پرداخت', 'Payment event', 'حدث دفع', '支付事件'),
      tx.status || tx.type || tx.memo || l('تراکنش ثبت‌شده', 'Recorded transaction', 'معاملة مسجلة', '已记录交易'), tx.updatedAt || tx.createdAt || tx.timestamp, 'activity'));
    (conversations || []).forEach(c => add('message:' + (c.id || c.lastMessageAt), 'messages',
      l('گفتگو به‌روزرسانی شد', 'Conversation updated', 'تم تحديث المحادثة', '对话已更新'),
      c.lastMessageText || l('پیام جدید در گفتگو', 'New message in conversation', 'رسالة جديدة في المحادثة', '对话中有新消息'),
      c.lastMessageAt || c.updatedAt || c.createdAt, 'chat'));
    (items || []).forEach(item => add('listing:' + (item.id || item.updatedAt || item.createdAt), 'listings',
      l('آگهی به‌روزرسانی شد', 'Listing updated', 'تم تحديث الإعلان', '物品信息已更新'),
      (item.title || l('آگهی', 'Listing', 'إعلان', '物品')) + ' • ' + (item.status || ''), item.updatedAt || item.createdAt, 'activity'));
    if (currentUser && currentUser.kycStatus === 'verified') add('kyc:' + (currentUser.uid || currentUser.username), 'system',
      l('احراز هویت KYC فعال است', 'KYC verification is active', 'التحقق من KYC نشط', 'KYC 已验证'),
      l('وضعیت اعتماد حساب شما از سرور دریافت شده است.', 'Your account trust status is available from the server.', 'تم استلام حالة الثقة من الخادم.', '账户信任状态来自服务器。'),
      currentUser.updatedAt, 'profile');
    return events.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 100);
  }, [rentals, transactions, conversations, items, currentUser, l]);

  const visible = filter === 'all' ? notifications : notifications.filter(n => n.type === filter);
  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;
  const markAllRead = () => setReadIds(new Set(notifications.map(n => n.id)));
  const formatTime = value => new Date(value).toLocaleString(lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar' : lang === 'zh' ? 'zh-CN' : 'en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const openNotification = n => {
    setReadIds(prev => new Set(prev).add(n.id));
    if (n.action === 'chat' && onOpenChat) return onOpenChat(null);
    onNavigate(n.action === 'profile' ? 'profile' : 'activity');
  };

  const icon = type => type === 'payments' ? Coins : type === 'messages' ? MessageCircle : type === 'listings' ? Package : type === 'system' ? ShieldCheck : Receipt;
  const filters = [
    ['all', l('همه', 'All', 'الكل', '全部')],
    ['rentals', l('اجاره‌ها', 'Rentals', 'الإيجارات', '租赁')],
    ['messages', l('پیام‌ها', 'Messages', 'الرسائل', '消息')],
    ['payments', l('پرداخت‌ها', 'Payments', 'المدفوعات', '支付')],
    ['listings', l('آگهی‌ها', 'Listings', 'الإعلانات', '物品')],
    ['system', l('سیستم', 'System', 'النظام', '系统')]
  ];

  if (!isAuthenticated) return <div className="w-full max-w-5xl mx-auto py-10"><section className="rentora-card p-8 text-center space-y-3"><Bell className="w-9 h-9 mx-auto text-[#534AB7]" /><h1 className="text-lg font-bold text-slate-900 dark:text-white">{l('اعلان‌ها', 'Notifications', 'الإشعارات', '通知')}</h1><p className="text-xs text-slate-500">{l('برای دیدن اعلان‌های حساب وارد شوید.', 'Sign in to view account notifications.', 'سجّل الدخول لرؤية إشعارات الحساب.', '登录后查看账户通知。')}</p></section></div>;

  return <div className="w-full max-w-5xl mx-auto space-y-5 pb-16 animate-fadeIn">
    <div className="flex items-start justify-between gap-3"><div><h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{l('اعلان‌ها', 'Notifications', 'الإشعارات', '通知')}</h1><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{l('به‌روزرسانی‌های مهم حساب، اجاره، پیام و پرداخت در یکجا.', 'Important account, rental, message and payment updates in one place.', 'تحديثات الحساب والإيجار والرسائل والمدفوعات في مكان واحد.', '账户、租赁、消息和支付的重要更新集中在这里。')}</p></div><button type="button" onClick={markAllRead} disabled={!unreadCount} className="btn-secondary min-h-11 px-3 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><CheckCheck className="w-4 h-4" />{l('همه خوانده شد', 'Mark all read', 'تحديد الكل كمقروء', '全部已读')}</button></div>
    <div className="flex gap-1.5 overflow-x-auto pb-1">{filters.map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key} className={'shrink-0 px-3 py-2 rounded-full text-[11px] font-bold border ' + (filter === key ? 'bg-[#534AB7] text-white border-[#534AB7]' : 'bg-white dark:bg-[#1A1930] text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700')}>{label}</button>)}</div>
    <section className="space-y-2">{visible.length === 0 ? <div className="rentora-card p-10 text-center space-y-2"><Bell className="w-8 h-8 mx-auto text-slate-300" /><p className="text-sm font-bold text-slate-700 dark:text-slate-200">{l('اعلانی برای نمایش نیست.', 'No notifications to show.', 'لا توجد إشعارات لعرضها.', '暂无通知。')}</p></div> : visible.map(n => { const Icon = icon(n.type); const unread = !readIds.has(n.id); return <button key={n.id} type="button" onClick={() => openNotification(n)} className={'w-full text-start rentora-card p-4 flex items-start gap-3 transition hover:border-[#534AB7]/40 ' + (unread ? 'bg-[#F5F3FF] dark:bg-[#1E1B3D]/70 border-[#DDD6FE]' : '')}><div className="w-10 h-10 shrink-0 rounded-xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#534AB7] dark:text-[#AFA9EC] flex items-center justify-center"><Icon className="w-4 h-4" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{n.title}</h2><span className="text-[9px] text-slate-400 shrink-0">{formatTime(n.time)}</span></div><p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">{n.detail}</p></div>{unread ? <span className="w-2 h-2 rounded-full bg-[#534AB7] mt-1 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-300 mt-1 shrink-0" />}</button>; })}</section>
    <p className="text-[10px] text-slate-400 px-1">{l('محتوای اعلان‌ها از داده‌های واقعی حساب می‌آید. وضعیت خوانده‌شدن این نسخه فقط در نشست فعلی نگه داشته می‌شود.', 'Notification content is derived from real account data. Read state in this v1 is session-only.', 'محتوى الإشعارات مشتق من بيانات الحساب الحقيقية. حالة القراءة في هذا الإصدار للجلسة الحالية فقط.', '通知内容来自真实账户数据。此 v1 的已读状态仅保存在当前会话。')}</p>
  </div>;
}
