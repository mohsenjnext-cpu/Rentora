import React, { useMemo, useState } from 'react';
import { Clock3, CheckCircle2, AlertTriangle, MessageCircle, FileText, Phone, RotateCw, Star, Flag, Package, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { RENTAL_STATES } from '../services/rentalStateMachine';
import RentoraButton from '../components/ui/RentoraButton';
import RentoraCard from '../components/ui/RentoraCard';
import RentoraEmptyState from '../components/ui/RentoraEmptyState';
import ReviewModal from '../components/ReviewModal';
import ReportModal from '../components/ReportModal';

export default function ActivityRedesign({ onNavigate, onSelectItem, onOpenChat }) {
  const { dir, t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen } = usePiAuth();
  const { rentals = [], fetchRentalContact, confirmHandoverOneTap } = useRentora();
  const [tab, setTab] = useState('active');
  const [reviewRental, setReviewRental] = useState(null);
  const [reportRental, setReportRental] = useState(null);
  const [contactRental, setContactRental] = useState(null);
  const [contact, setContact] = useState(null);
  const [contactError, setContactError] = useState('');
  const [loadingContact, setLoadingContact] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const mine = useMemo(() => {
    if (!currentUser) return [];
    const uid = currentUser.uid || currentUser.id;
    const username = String(currentUser.username || '').replace('@', '').toLowerCase();
    const seen = new Set();
    return rentals.filter(r => {
      const owner = uid && (r.renterUid === uid || r.renter_pi_uid === uid);
      const named = username && String(r.renterUsername || '').replace('@', '').toLowerCase() === username;
      const id = r.id || r.rental_id || r.bookingNumber;
      if (!(owner || named) || !id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [rentals, currentUser]);

  const active = useMemo(() => mine.filter(r => [RENTAL_STATES.CONFIRMED, RENTAL_STATES.ACTIVE, RENTAL_STATES.PAYMENT_PENDING, RENTAL_STATES.REQUESTED, RENTAL_STATES.ACCEPTED].includes(r.status)), [mine]);
  const history = useMemo(() => mine.filter(r => [RENTAL_STATES.COMPLETED, RENTAL_STATES.CANCELLED, RENTAL_STATES.REJECTED, RENTAL_STATES.DISPUTED].includes(r.status)), [mine]);
  const list = tab === 'active' ? active : history;

  const openContact = async rental => {
    setContactRental(rental); setContact(null); setContactError(''); setLoadingContact(true);
    try { setContact(await fetchRentalContact(rental.id)); } catch (e) { setContactError(e?.message || l('امکان دریافت اطلاعات تماس وجود ندارد.','Unable to fetch contact details.','تعذر الحصول على بيانات التواصل.','无法获取联系方式。')); }
    finally { setLoadingContact(false); }
  };

  const confirmHandover = async id => {
    setProcessingId(id);
    try { await confirmHandoverOneTap(id); } catch (_) {} finally { setProcessingId(null); }
  };

  if (!isAuthenticated) return <main dir={dir} className="mx-auto w-full max-w-xl px-3 py-10"><RentoraCard className="p-7 text-center"><Clock3 className="mx-auto mb-3 text-rentora-primary" size={30}/><h1 className="text-xl font-black text-rentora-ink">{t('activityTitle')}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{l('برای مشاهده رزروها و فعالیت‌ها وارد شوید.','Sign in to view your rentals and activity.','سجل الدخول لعرض الحجوزات والنشاط.','登录以查看租赁与活动。')}</p><RentoraButton className="mt-5" onClick={() => setAuthModalOpen(true)}>{t('navLogin')}</RentoraButton></RentoraCard></main>;

  return <main dir={dir} className="mx-auto w-full max-w-4xl space-y-4 px-3 pb-32 pt-2 sm:px-5 sm:pb-10">
    <header><p className="text-xs font-semibold text-rentora-primary">{l('رزروها و تراکنش‌ها','Bookings & activity','الحجوزات والنشاط','预订与活动')}</p><h1 className="text-2xl font-black text-rentora-ink">{t('activityTitle')}</h1><p className="mt-1 text-sm text-slate-500">{l('وضعیت رزروها و هماهنگی تحویل را از یکجا ببینید.','Track bookings and handovers in one place.','تابع الحجوزات والتسليم من مكان واحد.','在一个地方查看预订和交接。')}</p></header>
    <div role="tablist" className="grid grid-cols-2 rounded-rentora-control bg-slate-100 p-1 dark:bg-slate-800/70">
      {[[ 'active', l('جاری','Active','النشطة','进行中') ],['history', l('تاریخچه','History','السجل','历史')]].map(([key,label]) => <button key={key} type="button" role="tab" aria-selected={tab===key} onClick={()=>setTab(key)} className={"min-h-11 rounded-rentora-control px-3 text-sm font-bold "+(tab===key?'bg-rentora-surface text-rentora-primary shadow-sm':'text-slate-500')}>{label} <span className="text-xs">({key==='active'?active.length:history.length})</span></button>)}
    </div>
    {list.length===0 ? <RentoraEmptyState title={tab==='active'?l('رزرو جاری ندارید','No active rentals','لا توجد حجوزات نشطة','暂无进行中的租赁'):l('تاریخچه‌ای وجود ندارد','No rental history','لا يوجد سجل للإيجارات','暂无租赁历史')} description={tab==='active'?l('رزروهای شما پس از ایجاد در این بخش نمایش داده می‌شوند.','Your bookings will appear here after creation.','ستظهر الحجوزات هنا بعد إنشائها.','创建预订后会显示在这里。'):l('رزروهای تکمیل‌شده یا لغوشده اینجا می‌آیند.','Completed or cancelled rentals appear here.','تظهر الحجوزات المكتملة أو الملغاة هنا.','已完成或取消的租赁会显示在这里。')} action={<RentoraButton size="sm" onClick={()=>onNavigate('discover')}>{l('کشف کالاها','Discover items','اكتشف المنتجات','发现物品')}</RentoraButton>}/> :
      <section className="space-y-3">{list.map(r => {
        const actionable = r.status === RENTAL_STATES.CONFIRMED;
        return <RentoraCard key={r.id || r.bookingNumber} className="overflow-hidden">
          <div className="flex gap-3 p-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-rentora-control bg-rentora-primary-soft text-rentora-primary"><Package size={20}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-black text-rentora-ink">{r.itemTitle || l('کالای اجاره‌ای','Rental item','الغرض المؤجر','租赁物品')}</h2><span className="rounded-rentora-pill bg-rentora-primary-soft px-2 py-1 text-[10px] font-bold text-rentora-primary">{String(r.status || '').replaceAll('_',' ')}</span></div><p className="mt-1 text-xs text-slate-500" dir="ltr">#{r.bookingNumber || r.id}</p><p className="mt-1 text-xs text-slate-500" dir="ltr">{r.startDate || '—'} → {r.endDate || '—'}</p></div><ChevronRight size={17} className="mt-2 shrink-0 text-slate-300 rtl:rotate-180"/></div>
          <div className="grid grid-cols-2 gap-2 border-t border-rentora-border p-3 sm:grid-cols-4"><div><span className="block text-[10px] text-slate-400">{l('مالک','Owner','المالك','物主')}</span><strong className="text-xs" dir="ltr">@{r.ownerUsername || '—'}</strong></div><div><span className="block text-[10px] text-slate-400">{l('مبلغ','Total','الإجمالي','总额')}</span><strong className="text-xs font-mono">{r.rentalTotal || r.baseAmount || '—'} π</strong></div><div><span className="block text-[10px] text-slate-400">{l('کارمزد','Fee','العمولة','服务费')}</span><strong className="text-xs font-mono">{r.rentoraFee ?? r.platform_fee ?? '—'} π</strong></div><div><span className="block text-[10px] text-slate-400">{l('ودیعه','Deposit','التأمين','押金')}</span><strong className="text-xs font-mono">{r.deposit || 0} π</strong></div></div>
          <div className="flex flex-wrap gap-2 border-t border-rentora-border p-3">
            {actionable && <RentoraButton size="sm" disabled={processingId===r.id} onClick={()=>confirmHandover(r.id)}><CheckCircle2 size={15}/>{processingId===r.id?'...':l('تأیید تحویل','Confirm handover','تأكيد الاستلام','确认交接')}</RentoraButton>}
            {(r.status===RENTAL_STATES.CONFIRMED || r.status===RENTAL_STATES.ACTIVE) && <RentoraButton variant="secondary" size="sm" onClick={()=>openContact(r)}><Phone size={15}/>{l('اطلاعات تماس','Contact','التواصل','联系方式')}</RentoraButton>}
            <RentoraButton variant="ghost" size="sm" onClick={()=>onOpenChat?.(r,'rental')}><MessageCircle size={15}/>{l('چت','Chat','دردشة','聊天')}</RentoraButton>
            {r.status===RENTAL_STATES.COMPLETED && <RentoraButton variant="ghost" size="sm" onClick={()=>setReviewRental(r)}><Star size={15}/>{l('ثبت نظر','Review','تقييم','评价')}</RentoraButton>}
            <RentoraButton variant="ghost" size="sm" onClick={()=>setReportRental(r)}><Flag size={15}/>{l('گزارش','Report','إبلاغ','举报')}</RentoraButton>
          </div>
        </RentoraCard>;
      })}</section>}
    {contactRental && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={()=>setContactRental(null)}><RentoraCard className="w-full max-w-md p-5" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between"><h2 className="font-black">{l('اطلاعات تماس امن','Secure contact','بيانات التواصل الآمنة','安全联系信息')}</h2><button type="button" onClick={()=>setContactRental(null)} aria-label={l('بستن','Close','إغلاق','关闭')} className="min-h-11 min-w-11">×</button></div>{loadingContact?<div className="py-8 text-center"><RotateCw className="mx-auto animate-spin text-rentora-primary"/><p className="mt-2 text-xs text-slate-500">{l('در حال دریافت...','Loading...','جار التحميل...','加载中...')}</p></div>:contactError?<div role="alert" className="mt-4 flex gap-2 rounded-rentora-control bg-rentora-danger-soft p-3 text-sm text-rentora-danger"><AlertTriangle size={17}/>{contactError}</div>:<div className="mt-4 space-y-3">{contact?.contactName&&<RentoraCard className="p-3"><span className="block text-[10px] text-slate-400">{l('نام رابط','Contact','جهة الاتصال','联系人')}</span><strong>{contact.contactName}</strong></RentoraCard>}{contact?.contactPhone&&<RentoraCard className="flex items-center justify-between gap-3 p-3"><div><span className="block text-[10px] text-slate-400">{l('شماره تماس','Phone','الهاتف','电话')}</span><strong dir="ltr" className="font-mono">{contact.contactPhone}</strong></div><a href={"tel:"+contact.contactPhone} className="min-h-11 min-w-11 rounded-rentora-control bg-rentora-primary px-3 py-2 text-xs font-bold text-white inline-flex items-center justify-center">{l('تماس','Call','اتصال','拨打')}</a></RentoraCard>}{contact?.coordinationNotes&&<RentoraCard className="p-3 text-xs leading-6">{contact.coordinationNotes}</RentoraCard>}{!contact?.contactPhone&&!contact?.coordinationNotes&&!contact?.contactName&&<p className="text-sm text-slate-500">{l('اطلاعات تماس ثبت نشده است.','No contact details are available.','لا تتوفر بيانات تواصل.','暂无联系方式。')}</p>}</div>}</RentoraCard></div>}
    {reviewRental&&<ReviewModal rental={reviewRental} isOpen onClose={()=>setReviewRental(null)}/>}
    {reportRental&&<ReportModal target={{username:reportRental.ownerUsername,title:reportRental.itemTitle}} type="order" isOpen onClose={()=>setReportRental(null)}/>}
  </main>;
}
