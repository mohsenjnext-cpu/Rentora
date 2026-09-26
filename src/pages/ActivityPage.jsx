import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { RENTAL_STATES, RentalStateMachine } from '../services/rentalStateMachine';
import ReviewModal from '../components/ReviewModal';
import ReportModal from '../components/ReportModal';
import {
  Clock,
  CheckCircle2,
  Star,
  Flag,
  Coins,
  MapPin,
  AlertTriangle,
  Receipt,
  RotateCw,
  Package,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  Info,
  Phone,
  MessageCircle,
  Lock,
  Copy,
  Check,
  Trash2,
  AlertOctagon
} from 'lucide-react';

export default function ActivityPage({ onNavigate, onSelectItem, onOpenChat }) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen } = usePiAuth();
  const {
    rentals = [],
    transactions = [],
    conversations = [],
    items = [],
    fetchRentalContact,
    confirmHandoverOneTap,
    confirmReturnOneTap
  } = useRentora();

  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [activityFilter, setActivityFilter] = useState('all');
  const [selectedRentalForReview, setSelectedRentalForReview] = useState(null);
  const [selectedRentalForReport, setSelectedRentalForReport] = useState(null);
  const [selectedAgreementRental, setSelectedAgreementRental] = useState(null);
  const [selectedContactRental, setSelectedContactRental] = useState(null);
  const [rentalContactData, setRentalContactData] = useState(null);
  const [isLoadingContact, setIsLoadingContact] = useState(false);
  const [contactError, setContactError] = useState('');
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
  const [clearSuccessNotice, setClearSuccessNotice] = useState(false);

  const clearedKey = currentUser ? `rentora_cleared_history_${currentUser.username || currentUser.uid}` : null;
  const [clearedHistoryTime, setClearedHistoryTime] = useState(() => {
    if (!clearedKey) return 0;
    try {
      return Number(localStorage.getItem(clearedKey)) || 0;
    } catch (_) {
      return 0;
    }
  });

  const handleOpenContactModal = async (rental) => {
    setSelectedContactRental(rental);
    setRentalContactData(null);
    setContactError('');
    setIsLoadingContact(true);
    try {
      const contact = await fetchRentalContact(rental.id);
      setRentalContactData(contact);
    } catch (err) {
      setContactError(err.message || l('امکان دریافت اطلاعات تماس وجود ندارد.', 'Unable to fetch contact details.', 'تعذر الحصول على بيانات التواصل.', '无法获取联系方式。'));
    } finally {
      setIsLoadingContact(false);
    }
  };

  const handleCopyPhone = (text) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch (e) {}
  };
  const [processingId, setProcessingId] = useState(null);
  const [handoverError, setHandoverError] = useState('');
  const [handoverErrorRentalId, setHandoverErrorRentalId] = useState(null);

  const activityFeed = useMemo(() => {
    const events = [];
    const push = (event) => {
      if (!event?.id) return;
      events.push(event);
    };
    (rentals || []).forEach((r) => {
      const stamp = r.updatedAt || r.createdAt;
      push({
        id: 'rental:' + (r.id || r.bookingNumber),
        type: 'rentals',
        icon: 'rental',
        title: l('وضعیت اجاره به‌روزرسانی شد', 'Rental status updated', 'تم تحديث حالة الإيجار', '租赁状态已更新'),
        detail: `${r.itemTitle || l('کالا', 'Item', 'غرض', '物品')} • #${r.bookingNumber || r.id?.slice?.(0, 10) || ''} • ${r.status || ''}`,
        time: stamp
      });
    });
    (transactions || []).forEach((tx) => {
      const stamp = tx.updatedAt || tx.createdAt || tx.timestamp;
      push({
        id: 'tx:' + (tx.id || tx.txid || stamp),
        type: 'payments',
        icon: 'payment',
        title: l('رویداد پرداخت', 'Payment event', 'حدث دفع', '支付事件'),
        detail: tx.status || tx.type || tx.memo || l('تراکنش ثبت‌شده', 'Recorded transaction', 'معاملة مسجلة', '已记录交易'),
        time: stamp
      });
    });
    (conversations || []).forEach((c) => {
      const stamp = c.lastMessageAt || c.updatedAt || c.createdAt;
      if (!c.lastMessageText && !c.lastMessageAt) return;
      push({
        id: 'message:' + (c.id || stamp),
        type: 'messages',
        icon: 'message',
        title: l('گفتگو به‌روزرسانی شد', 'Conversation updated', 'تم تحديث المحادثة', '对话已更新'),
        detail: c.lastMessageText || l('پیام جدید در گفتگو', 'New message in conversation', 'رسالة جديدة', '对话中有新消息'),
        time: stamp
      });
    });
    (items || []).forEach((item) => {
      const stamp = item.updatedAt || item.createdAt;
      push({
        id: 'listing:' + (item.id || stamp),
        type: 'listings',
        icon: 'listing',
        title: l('آگهی به‌روزرسانی شد', 'Listing updated', 'تم تحديث الإعلان', '物品信息已更新'),
        detail: `${item.title || l('آگهی', 'Listing', 'إعلان', '物品')} • ${item.status || ''}`,
        time: stamp
      });
    });
    if (currentUser?.kycStatus === 'verified') {
      push({
        id: 'kyc:' + (currentUser.uid || currentUser.username),
        type: 'system',
        icon: 'kyc',
        title: l('احراز هویت KYC فعال است', 'KYC verification is active', 'التحقق من KYC نشط', 'KYC 已验证'),
        detail: l('وضعیت اعتماد حساب شما از سرور دریافت شده است.', 'Your account trust status is available from the server.', 'تم استلام حالة الثقة من الخادم.', '账户信任状态来自服务器。'),
        time: currentUser.updatedAt
      });
    }
    return events.sort((a,b) => {
      const at = a.time ? new Date(a.time).getTime() : 0;
      const bt = b.time ? new Date(b.time).getTime() : 0;
      return bt - at;
    }).slice(0, 50);
  }, [rentals, transactions, conversations, items, currentUser, l]);

  const filteredActivity = useMemo(
    () => activityFilter === 'all' ? activityFeed : activityFeed.filter(e => e.type === activityFilter),
    [activityFeed, activityFilter]
  );

  const formatActivityTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar' : lang === 'zh' ? 'zh-CN' : 'en', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const activityFilters = [
    ['all', l('همه', 'All', 'الكل', '全部')],
    ['rentals', l('اجاره‌ها', 'Rentals', 'الإيجارات', '租赁')],
    ['listings', l('آگهی‌ها', 'Listings', 'الإعلانات', '物品')],
    ['payments', l('پرداخت‌ها', 'Payments', 'المدفوعات', '支付')],
    ['messages', l('پیام‌ها', 'Messages', 'الرسائل', '消息')],
    ['system', l('سیستم', 'System', 'النظام', '系统')]
  ];

  const myUsername = (currentUser?.username || '').toLowerCase().replace('@', '').trim();

  // Deduplicated rentals belonging to the current user
  const myRentals = useMemo(() => {
    if (!currentUser) return [];
    const myUid = currentUser.uid || currentUser.id;
    const raw = (rentals || []).filter(r => {
      const renter = (r.renterUsername || r.renter_username || '').toLowerCase().replace('@', '').trim();
      const renterUid = r.renterUid || r.renter_pi_uid;
      return (renter && renter === myUsername) || (myUid && renterUid === myUid);
    });

    // Authoritative deduplication by unique ID / bookingNumber
    const seenIds = new Set();
    const deduped = [];
    for (const r of raw) {
      const id = r.id || r.rental_id || r.bookingNumber;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        deduped.push(r);
      }
    }
    return deduped;
  }, [rentals, myUsername, currentUser]);

  const activeRentals = useMemo(() => {
    return myRentals.filter(r =>
      r.status === RENTAL_STATES.CONFIRMED ||
      r.status === RENTAL_STATES.ACTIVE ||
      r.status === RENTAL_STATES.PAYMENT_PENDING ||
      r.status === RENTAL_STATES.REQUESTED ||
      r.status === RENTAL_STATES.ACCEPTED
    );
  }, [myRentals]);

  const historyRentals = useMemo(() => {
    return myRentals.filter(r => {
      const isHistoryStatus = (
        r.status === RENTAL_STATES.COMPLETED ||
        r.status === RENTAL_STATES.CANCELLED ||
        r.status === RENTAL_STATES.REJECTED ||
        r.status === RENTAL_STATES.DISPUTED
      );
      if (!isHistoryStatus) return false;

      if (clearedHistoryTime > 0) {
        const itemTime = r.updatedAt ? new Date(r.updatedAt).getTime() : (r.createdAt ? new Date(r.createdAt).getTime() : 0);
        if (itemTime > 0 && itemTime <= clearedHistoryTime) {
          return false;
        }
      }
      return true;
    });
  }, [myRentals, clearedHistoryTime]);

  const handleClearHistory = () => {
    const nowTime = Date.now();
    if (clearedKey) {
      try {
        localStorage.setItem(clearedKey, String(nowTime));
      } catch (_) {}
    }
    setClearedHistoryTime(nowTime);
    setIsClearHistoryModalOpen(false);
    setClearSuccessNotice(true);
    setTimeout(() => setClearSuccessNotice(false), 3000);
  };

  const handleConfirmHandover = async (rentalId) => {
    setProcessingId(rentalId);
    setHandoverError('');
    setHandoverErrorRentalId(rentalId);
    try {
      const result = await confirmHandoverOneTap(rentalId);
      if (result?.success !== false) {
        setHandoverErrorRentalId(null);
      }
    } catch (e) {
      setHandoverError(e?.message || l(
        'تأیید تحویل ناموفق بود. دوباره تلاش کنید.',
        'Handover confirmation failed. Try again.',
        'تعذر تأكيد التسليم. حاول مرة أخرى.',
        '交接确认失败，请重试。'
      ));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-16 select-none animate-fadeIn" aria-labelledby="activity-page-title">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 id="activity-page-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            {t('activityTitle')}
          </h1>
          <p className="text-[11px] text-slate-400">
            {l('مدیریت سفارش‌ها، قراردادهای اجاره و تاییدیه‌های تحویل', 'Manage bookings, rental agreements, and handovers', 'إدارة الحجوزات وعقود الإيجار والتسليم', '管理预订、租赁协议及交接确认')}
          </p>
        </div>
      </div>

      {handoverError && (
        <div className="p-3 rounded-xl badge-amber text-xs font-bold flex items-center justify-between gap-3 animate-fadeIn" role="alert">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span className="truncate">{handoverError}</span>
          </div>
          <button
            type="button"
            onClick={() => handoverErrorRentalId && handleConfirmHandover(handoverErrorRentalId)}
            disabled={processingId !== null}
            className="px-2.5 py-1.5 rounded-lg bg-white/70 dark:bg-slate-900/40 text-[#854F0B] dark:text-[#FAC775] shrink-0 cursor-pointer"
          >
            {l('تلاش مجدد', 'Try again', 'حاول مرة أخرى', '重试')}
          </button>
        </div>
      )}

      {/* Unified Activity Feed */}
      <section className="rentora-card p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{l('رویدادهای اخیر', 'Recent activity', 'النشاط الأخير', '最近动态')}</h2>
            <p className="text-[10px] text-slate-400">{l('رویدادهای واقعی حساب، اجاره، پرداخت، آگهی و گفتگو', 'Real account, rental, payment, listing and conversation events', 'أحداث الحساب والإيجار والدفع والإعلانات والمحادثات', '真实账户、租赁、支付、物品和对话事件')}</p>
          </div>
          <span className="text-[10px] font-mono text-slate-400">{filteredActivity.length}</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={l('فیلتر فعالیت', 'Activity filters', 'فلاتر النشاط', '活动筛选')}>
          {activityFilters.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={activityFilter === key} onClick={() => setActivityFilter(key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                activityFilter === key
                  ? 'bg-[#534AB7] text-white border-[#534AB7]'
                  : 'bg-white dark:bg-[#1A1930] text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {filteredActivity.length === 0 ? (
            <div className="py-7 text-center text-xs text-slate-400">
              <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
              {l('هنوز رویدادی برای نمایش وجود ندارد.', 'No activity to show yet.', 'لا توجد أحداث لعرضها بعد.', '暂无动态。')}
            </div>
          ) : filteredActivity.map((event) => (
            <div key={event.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 dark:bg-[#16152B]/60 border border-slate-200/70 dark:border-slate-800">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#534AB7] dark:text-[#AFA9EC] flex items-center justify-center">
                {event.icon === 'payment' ? <Coins className="w-4 h-4" /> :
                 event.icon === 'message' ? <MessageCircle className="w-4 h-4" /> :
                 event.icon === 'listing' ? <Package className="w-4 h-4" /> :
                 event.icon === 'kyc' ? <ShieldCheck className="w-4 h-4" /> :
                 <Receipt className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">{event.title}</h3>
                  <time className="text-[9px] text-slate-400 shrink-0">{formatActivityTime(event.time)}</time>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">{event.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rental workspace tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#1A1930] rounded-xl text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          role="tab" aria-selected={activeTab === 'active'} aria-controls="activity-rentals-panel" className={`flex-1 py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'active'
              ? 'bg-white dark:bg-[#26215C] text-[#26215C] dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{t('tabActiveRentals')} ({activeRentals.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'history'}
          aria-controls="activity-rental-history-panel"
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-white dark:bg-[#26215C] text-[#26215C] dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{t('tabRentalHistory')} ({historyRentals.length})</span>
        </button>
      </div>

      {/* Active Tab */}
      {activeTab === 'active' && (
        <div id="activity-rentals-panel" role="tabpanel" className="space-y-3">
          {activeRentals.length === 0 ? (
            <div className="p-8 text-center rounded-xl rentora-card space-y-2">
              <Package className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="text-xs text-slate-400">{t('noActiveRentals')}</p>            </div>
          ) : (
            activeRentals.map(rental => {
              const statusMeta = RentalStateMachine.getStatusMeta(rental.status, l);
              const bookingNumber = rental.bookingNumber || rental.rentalAgreement?.agreementId || rental.id.substring(0, 10);
              const rentalFee = rental.rentalTotal !== undefined ? rental.rentalTotal : rental.baseAmount;
              const feeAmount = rental.rentoraFee !== undefined ? rental.rentoraFee : (rental.totalPlatformFee || 0);

              return (
                <div key={rental.id} className="p-4 rounded-xl rentora-card space-y-3 border border-slate-150 dark:border-slate-800 shadow-2xs">

                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-mono text-[10px] font-bold text-[#534AB7] dark:text-[#AFA9EC] bg-[#EEEDFE] dark:bg-[#26215C] px-1.5 py-0.2 rounded">
                          #{bookingNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {rental.startDate} ➔ {rental.endDate} ({rental.daysCount} {l('روز', 'days', 'أيام', '天')})
                        </span>
                      </div>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        {rental.itemTitle}
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono block">
                        {l('موجر:', 'Owner:', 'المؤجر:', '物主：')} @{rental.ownerUsername}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${statusMeta.bg}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* Pricing Breakdown & Direct Settlement Details */}
                  <div className="p-3 rounded-lg bg-slate-50/70 dark:bg-[#16152B]/70 space-y-1.5 text-[11px] border border-slate-200/70 dark:border-slate-800">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>{l('کرایه (تسویه مستقیم با موجر):', 'Rental (Direct P2P):', 'الإيجار (مباشر يداً بيد):', '租金（线下直接结清）：')}</span>
                      <strong className="font-mono text-slate-900 dark:text-white">{rentalFee} π</strong>
                    </div>

                    {rental.deposit > 0 && (
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>{l('ودیعه امانی (تسویه مستقیم):', 'Deposit (Direct P2P):', 'التأمين (مباشر يداً بيد):', '押金（线下直接交付）：')}</span>
                        <strong className="font-mono text-slate-900 dark:text-white">{rental.deposit} π</strong>
                      </div>
                    )}

                    <div className="flex justify-between text-[#0F6E56] dark:text-[#48D2A8] font-bold pt-1 border-t border-slate-200 dark:border-slate-700">
                      <span>{l('کارمزد رنتورا (پرداخت آنلاین با پای):', 'Rentora Fee (Pi Payment):', 'عمولة رنتورا (مدفوعة):', 'Rentora 平台费（Pi 链上已付）：')}</span>
                      <span className="font-mono">✓ {feeAmount} π ({l('تاییدشده', 'Confirmed', 'مؤكدة', '已确认')})</span>
                    </div>
                  </div>

                  {/* Actions & Agreement Button */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleOpenContactModal(rental)}
                      className="px-3 py-1.5 rounded-lg border border-[#534AB7]/40 bg-[#EEEDFE]/40 dark:bg-[#26215C]/40 text-[#534AB7] dark:text-[#AFA9EC] hover:bg-[#EEEDFE] dark:hover:bg-[#26215C] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{l('اطلاعات تماس و هماهنگی', 'Contact & Coordination', 'بيانات التواصل والتنسيق', '联系与交接方式')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedAgreementRental(rental)}
                      className="btn-secondary px-3 py-1.5 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer shrink-0"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#534AB7]" />
                      <span>{l('قرارداد اجاره', 'Rental Agreement', 'عقد الإيجار', '租赁协议')}</span>
                    </button>

                    {rental.status === RENTAL_STATES.CONFIRMED && (
                      <button
                        type="button"
                        disabled={processingId === rental.id}
                        onClick={() => handleConfirmHandover(rental.id)}
                        className="btn-primary flex-1 min-w-[140px] py-1.5 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{processingId === rental.id ? '...' : l('تایید دریافت کالا در محل تحویل', 'Confirm Handover at Pickup', 'تأكيد استلام الغرض', '现场确认已交接')}</span>
                      </button>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {/* Action Bar when history exists */}
          {historyRentals.length > 0 && (
            <div className="flex items-center justify-between px-1 py-1">
              <span className="text-xs text-slate-500 font-medium">
                {historyRentals.length} {l('مورد در سوابق', 'records in history', 'سجلات في الأرشيف', '条历史记录')}
              </span>
              <button
                type="button"
                onClick={() => setIsClearHistoryModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/60 dark:border-rose-800/60 transition cursor-pointer"
                title={t('btnClearHistory')}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('btnClearHistory')}</span>
              </button>
            </div>
          )}

          {clearSuccessNotice && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold animate-fadeIn">
              <Check className="w-4 h-4 shrink-0" />
              <span>{t('clearHistorySuccess')}</span>
            </div>
          )}

          <div id="activity-rental-history-panel" role="tabpanel">
          {historyRentals.length === 0 ? (
            <div className="p-8 text-center rounded-xl rentora-card space-y-2">
              <Package className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="text-xs text-slate-400">{t('noRentalHistory')}</p>
            </div>
          ) : (
            historyRentals.map(rental => {
              const statusMeta = RentalStateMachine.getStatusMeta(rental.status, l);
              const bookingNumber = rental.bookingNumber || rental.rentalAgreement?.agreementId || rental.id.substring(0, 10);
              const rentalFee = rental.rentalTotal !== undefined ? rental.rentalTotal : rental.baseAmount;

              return (
                <div key={rental.id} className="p-4 rounded-xl rentora-card space-y-3 border border-slate-150 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-mono text-[10px] font-bold text-[#534AB7] dark:text-[#AFA9EC] bg-[#EEEDFE] dark:bg-[#26215C] px-1.5 py-0.2 rounded">
                          #{bookingNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">@{rental.ownerUsername}</span>
                      </div>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{rental.itemTitle}</h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusMeta.bg}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-150 dark:border-slate-800">
                    <span>{rental.daysCount} {l('روز', 'days', 'أيام', '天')}</span>
                    <span className="font-mono font-bold text-[#0F6E56]">{rentalFee} π (P2P)</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-150 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSelectedAgreementRental(rental)}
                      className="btn-secondary px-3 py-1.5 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#534AB7]" />
                      <span>{l('قرارداد', 'Agreement', 'العقد', '协议')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRentalForReview(rental)}
                      className="btn-secondary flex-1 py-1.5 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      <span>{t('btnLeaveReview')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRentalForReport(rental)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 cursor-pointer"
                      title={t('btnReportDispute')}
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                  </div>
           </div>
              );
            })
          )}
        </div>
      )}

      {/* Clear History Confirmation Modal */}
      {isClearHistoryModalOpen && (
        <div
          onClick={() => setIsClearHistoryModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#1A1930] rounded-2xl p-5 max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 animate-scaleIn text-center"
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                {t('clearHistoryConfirmTitle')}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {t('clearHistoryConfirmDesc')}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleClearHistory}
                className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('btnClearHistory')}</span>              </button>
              <button
                type="button"
                onClick={() => setIsClearHistoryModalOpen(false)}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {t('btnCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rental Agreement Full Modal */}
      {selectedAgreementRental && (
        <div
          onClick={() => setSelectedAgreementRental(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#151426] rounded-2xl w-full max-w-md max-h-[88vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl animate-scaleIn overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-[#18172E]/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#26215C] text-white flex items-center justify-center">
                  <FileText className="w-4 h-4 text-[#EEEDFE]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {l('قرارداد رسمی رزرو رنتورا', 'Rentora Rental Agreement', 'عقد إيجار رنتورا الرسمي', 'Rentora 官方租赁协议')}
                  </h3>
                  <span className="font-mono text-[10px] text-slate-400">
                    #{selectedAgreementRental.bookingNumber || selectedAgreementRental.rentalAgreement?.agreementId || selectedAgreementRental.id.substring(0, 10)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAgreementRental(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Agreement Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs">

              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#19182E] border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[10px] text-slate-400 block">{l('موجر (مالک کالا):', 'Owner:', 'المؤجر:', '物主：')}</span>
                  <strong className="font-mono text-slate-900 dark:text-white" dir="ltr">@{selectedAgreementRental.ownerUsername}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">{l('مستاجر:', 'Renter:', 'المستأجر:', '租客：')}</span>
                  <strong className="font-mono text-slate-900 dark:text-white" dir="ltr">@{selectedAgreementRental.renterUsername}</strong>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">{l('نام کالا:', 'Item:', 'الغرض:', '物品名称：')}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedAgreementRental.itemTitle}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">{l('مدت اجاره:', 'Rental Period:', 'مدة الإيجار:', '租赁期限：')}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {selectedAgreementRental.startDate} ➔ {selectedAgreementRental.endDate} ({selectedAgreementRental.daysCount} {l('روز', 'days', 'أيام', '天')})
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">{l('مبلغ کرایه (تسویه مستقیم):', 'Rental (Direct P2P):', 'الإيجار (مباشر يداً بيد):', '租金（线下当面结清）：')}</span>
                  <strong className="font-mono text-slate-900 dark:text-white">{selectedAgreementRental.rentalTotal || selectedAgreementRental.baseAmount} π</strong>
                </div>

                {selectedAgreementRental.deposit > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">{l('ودیعه امانی (تسویه مستقیم):', 'Deposit (Direct P2P):', 'التأمين (مباشر يداً بيد):', '押金（线下当面交接）：')}</span>
                    <strong className="font-mono text-slate-900 dark:text-white">{selectedAgreementRental.deposit} π</strong>
                  </div>
                )}

                <div className="flex justify-between text-[#0F6E56] dark:text-[#48D2A8] font-bold pt-2 border-t border-slate-150 dark:border-slate-800">
                  <span>{l('کارمزد رنتورا (پرداخت آنلاین):', 'Rentora Platform Fee:', 'عمولة المنصة:', '平台服务费：')}</span>
                  <span className="font-mono">
                    ✓ {selectedAgreementRental.rentoraFee !== undefined ? selectedAgreementRental.rentoraFee : selectedAgreementRental.totalPlatformFee} π
                  </span>
                </div>

                {selectedAgreementRental.piTxRef && (
                  <div className="text-[9px] text-slate-400 font-mono truncate pt-1" dir="ltr">
                    Pi TxID: {selectedAgreementRental.piTxRef}
                  </div>
                )}
              </div>

              {/* Legal Notice */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-900 dark:text-amber-300 leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{l('بند حقوقی تسویه مستقیم:', 'Direct P2P Settlement Clause:', 'بند التسوية المباشرة:', '点对点直接结算条款：')}</span>
                </div>
                <p className="opacity-95">
                  {l(
                    'رنتورا یک پلتفرم همتا‌به‌همتا (P2P) است و مبالغ اجاره و ودیعه مستقیماً در زمان تحویل بین طرفین مبادله شده و توسط رنتورا نگهداری یا امانت گرفته نمی‌شود.',
                    'Rentora is a P2P marketplace. Rental fee and security deposit are settled directly between users upon handover and are not held or processed by Rentora.',
                    'رنتورا منصة تأجير مباشرة. يُسوى الإيجار والتأمين مباشرة بين الطرفين عند الاستلام ولا تحتفظ بها المنصة.',
                    'Rentora 仅为点对点租赁中介平台。租金与押金均由双方当面直接结清，平台不代管或托管资金。'
                  )}
                </p>
              </div>

            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-[#1A1930]/40 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAgreementRental(null)}
                className="btn-primary px-5 py-2 text-xs font-bold cursor-pointer"
              >
                {l('تایید و بستن', 'OK', 'حسناً', '确定')}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Contact Details Modal */}
      {selectedContactRental && (
        <div
          onClick={() => setSelectedContactRental(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#151426] rounded-2xl w-full max-w-md max-h-[88vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl animate-scaleIn overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-[#18172E]/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#26215C] text-white flex items-center justify-center">
                  <Phone className="w-4 h-4 text-[#EEEDFE]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {l('اطلاعات تماس و هماهنگی تحویل', 'Owner Contact & Coordination', 'بيانات التواصل والتنسيق', '物主联系与交付信息')}
                  </h3>
                  <span className="font-mono text-[10px] text-slate-400">
                    @{selectedContactRental.ownerUsername} • #{selectedContactRental.bookingNumber || selectedContactRental.id.substring(0, 10)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedContactRental(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto space-y-3.5 text-xs">
              {isLoadingContact ? (
                <div className="py-8 text-center space-y-2">
                  <RotateCw className="w-6 h-6 animate-spin mx-auto text-[#534AB7]" />
                  <p className="text-slate-400">{l('در حال دریافت اطلاعات تماس امن از سرور...', 'Fetching secure contact data...', 'جارٍ تحميل بيانات التواصل...', '正在安全加载联系信息...')}</p>
                </div>
              ) : contactError ? (
                <div className="space-y-2">
                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{contactError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectedContactRental && handleOpenContactModal(selectedContactRental)}
                    className="w-full btn-secondary py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    {l('تلاش مجدد', 'Try again', 'إعادة المحاولة', '重试')}
                  </button>
                </div>
              ) : rentalContactData ? (
                <div className="space-y-3">
                  {/* Verified Notice */}
                  <div className="p-3 rounded-xl badge-trust flex items-center gap-2 border border-[#0F6E56]/30">
                    <ShieldCheck className="w-4 h-4 text-[#0F6E56] dark:text-[#48D2A8] shrink-0" />
                    <span className="text-[11px] text-[#0F6E56] dark:text-[#48D2A8] font-bold">
                      {l('رزرو معتبر: اطلاعات تماس اختصاصی این آگهی فعال گردید.', 'Verified Booking: Private contact unlocked for this listing.', 'حجز مؤكد: تم تفعيل بيانات التواصل لهذا الإعلان.', '预订有效：已成功解锁该物品的专属联系与交接方式。')}
                    </span>
                  </div>

                  {/* Contact Name */}
                  <div className="p-3 rounded-xl rentora-card space-y-1">
                    <span className="text-[10px] text-slate-400 block">{l('نام رابط / مالک کالا:', 'Contact Person:', 'اسم جهة الاتصال:', '联系人姓名：')}</span>
                    <strong className="text-sm font-bold text-slate-900 dark:text-white">
                      {rentalContactData.contactName || selectedContactRental.ownerUsername}
                    </strong>
                  </div>

                  {/* Phone Number */}
                  {rentalContactData.contactPhone && (
                    <div className="p-3 rounded-xl rentora-card flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 block">{l('شماره تماس مستقیم:', 'Phone Number:', 'رقم الهاتف:', '联系电话：')}</span>
                        <strong className="text-sm font-mono font-black text-slate-900 dark:text-white" dir="ltr">
                          {rentalContactData.contactPhone}
                        </strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(rentalContactData.contactPhone)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1A1930] hover:border-[#534AB7] text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedPhone ? l('کپی شد', 'Copied', 'تم النسخ', '已复制') : l('کپی', 'Copy', 'نسخ', '复制')}</span>
                        </button>
                        <a
                          href={`tel:${rentalContactData.contactPhone}`}
                          className="btn-primary px-3 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >                          <Phone className="w-3.5 h-3.5" />
                          <span>{l('تماس', 'Call', 'اتصال', '拨打')}</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* WhatsApp */}
                  {rentalContactData.whatsapp && (
                    <div className="p-3 rounded-xl rentora-card flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 block">{l('واتساپ:', 'WhatsApp:', 'واتساب:', 'WhatsApp：')}</span>
                        <strong className="text-xs font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">
                          {rentalContactData.whatsapp}
                        </strong>
                      </div>
                      <a
                        href={rentalContactData.whatsapp.startsWith('http') ? rentalContactData.whatsapp : `https://wa.me/${rentalContactData.whatsapp.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-xs"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{l('ارسال پیام', 'Chat WhatsApp', 'مراسلة', '发消息')}</span>
                      </a>
                    </div>
                  )}

                  {/* Preferred Method & Hours */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-xl rentora-card space-y-0.5">
                      <span className="text-[10px] text-slate-400 block">{l('روش ترجیحی ارتباط:', 'Preferred Method:', 'طريقة التواصل:', '首选沟通：')}</span>
                      <span className="font-semibold text-[#534AB7] dark:text-[#AFA9EC]">
                        {rentalContactData.preferredContactMethod === 'whatsapp' ? l('پیام واتساپ', 'WhatsApp', 'واتساب', 'WhatsApp') :
                         rentalContactData.preferredContactMethod === 'chat' ? l('چت درون‌برنامه', 'In-App Chat', 'دردشة رنتورا', '应用内聊天') :
                         rentalContactData.preferredContactMethod === 'both' ? l('تماس و واتساپ', 'Phone & WhatsApp', 'هاتف وواتساب', '电话与WhatsApp') :
                         l('تماس تلفنی', 'Phone Call', 'اتصال هاتفي', '电话通话')}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl rentora-card space-y-0.5">
                      <span className="text-[10px] text-slate-400 block">{l('ساعات پاسخگویی:', 'Contact Hours:', 'أوقات الاتصال:', '接听时段：')}</span>
                      <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                        {rentalContactData.contactHours || l('همه‌روزه (توافقی)', 'Daily (Flexible)', 'يومياً', '全天（协商）')}
                      </span>
                    </div>
                  </div>

                  {/* Coordination Notes */}
                  {rentalContactData.coordinationNotes && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#18172E] border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                        {l('دستورالعمل و آدرس تحویل:', 'Handover Instructions:', 'تعليمات الاستلام والتسليم:', '交接说明与地址：')}
                      </span>
                      <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                        {rentalContactData.coordinationNotes}
                      </p>
                    </div>
                  )}

                  {/* In-App Coordination Chat Shortcut */}
                  {onOpenChat && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetRental = selectedContactRental;
                        setSelectedContactRental(null);
                        onOpenChat(targetRental, 'rental');
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#534AB7] hover:bg-[#433A9D] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xs"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{l('گفتگوی هماهنگی تحویل در رنتورا', 'In-App Handover Chat', 'محادثة التنسيق في رنتورا', '应用内交接沟通')}</span>
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-[#1A1930]/40 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedContactRental(null)}
                className="btn-primary px-5 py-2 text-xs font-bold cursor-pointer"
              >
                {l('بستن', 'Close', 'إغلاق', '关闭')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedRentalForReview && (
        <ReviewModal
          rental={selectedRentalForReview}
          isOpen={!!selectedRentalForReview}
          onClose={() => setSelectedRentalForReview(null)}
        />
      )}

      {/* Report Modal */}
      {selectedRentalForReport && (
        <ReportModal
          target={{ username: selectedRentalForReport.ownerUsername, title: selectedRentalForReport.itemTitle }}
          type="order"
          isOpen={!!selectedRentalForReport}
          onClose={() => setSelectedRentalForReport(null)}
        />
      )}

    </div>
  );
}