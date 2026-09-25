import React, { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Flag, Heart, Lock, MapPin, MessageSquare, Pencil, Share2, ShieldCheck, Star } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import BookingModal from '../components/BookingModal';
import ReportModal from '../components/ReportModal';

export default function ItemDetailRedesign({
  item,
  onBack,
  onBookingSuccess,
  onOpenChat,
  onOpenPublicProfile,
  onNavigateToOwnerHub,
  onEditItem
}) {
  const { dir, t, l } = useLanguage();
  const { currentUser } = usePiAuth();
  const { favorites = [], toggleFavorite, fetchListingReviews } = useRentora();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [reviewsData, setReviewsData] = useState({ stats: { totalReviews: 0, averageRating: null }, reviews: [] });
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!item?.id) return;
    let active = true;
    setLoadingReviews(true);
    fetchListingReviews(item.id)
      .then((data) => { if (active && data) setReviewsData(data); })
      .catch(() => {})
      .finally(() => { if (active) setLoadingReviews(false); });
    return () => { active = false; };
  }, [item?.id]);

  if (!item) return null;

  const mine = String(currentUser?.uid || '') && String(item.ownerUid || '') === String(currentUser?.uid || '');
  const myName = String(currentUser?.username || '').replace('@', '').trim().toLowerCase();
  const ownerName = String(item.ownerUsername || '').replace('@', '').trim().toLowerCase();
  const isOwner = Boolean(mine || (myName && ownerName && myName === ownerName));
  const isFavorite = favorites.includes(item.id);
  const images = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
  const image = images[activeImageIndex] || images[0] || null;
  const averageRating = reviewsData.stats?.averageRating;
  const totalReviews = reviewsData.stats?.totalReviews || 0;
  const status = item.status || 'active';
  const isActive = status === 'active';

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: item.title, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch (_) {}
  };

  return (
    <main dir={dir} className="mx-auto w-full max-w-5xl px-3 pb-32 pt-2 sm:px-5 sm:pb-10">
      <header className="sticky top-0 z-20 -mx-3 mb-3 flex items-center justify-between border-b border-rentora-border bg-rentora-canvas/95 px-3 py-2 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-rentora-control px-2 text-sm font-bold text-rentora-ink hover:bg-rentora-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rentora-primary-accent">
          <ArrowRight className={dir === 'rtl' ? '' : 'rotate-180'} size={18} />
          {t('btnBack')}
        </button>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={share} aria-label={t('btnShare')} className="min-h-11 min-w-11 rounded-rentora-control border border-rentora-border bg-rentora-surface p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rentora-primary-accent"><Share2 size={18} /></button>
          <button type="button" onClick={() => toggleFavorite(item.id)} aria-label={t('btnFavorite')} aria-pressed={isFavorite} className={`min-h-11 min-w-11 rounded-rentora-control border border-rentora-border bg-rentora-surface p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rentora-primary-accent ${isFavorite ? 'text-rose-600' : 'text-slate-600'}`}><Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} /></button>
          <button type="button" onClick={() => setReportOpen(true)} aria-label={t('itemReportBtn')} className="min-h-11 min-w-11 rounded-rentora-control border border-rentora-border bg-rentora-surface p-2.5 text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rentora-primary-accent"><Flag size={18} /></button>
        </div>
      </header>

      {copied && <div role="status" className="mb-3 flex items-center justify-center gap-2 rounded-rentora-control bg-rentora-success-soft px-3 py-2 text-sm font-bold text-rentora-success"><Check size={16} />{t('itemShareSuccess')}</div>}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,.85fr)] lg:items-start">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-rentora-panel border border-rentora-border bg-rentora-surface shadow-rentora-card">
            <div className="relative aspect-[16/10] bg-slate-100">
              {image ? <img src={image} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">{l('تصویری برای این آگهی ثبت نشده است', 'No listing image', 'لا توجد صورة للإعلان', '暂无图片')}</div>}
              <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
                {item.ownerKYC && <span className="inline-flex items-center gap-1.5 rounded-rentora-pill bg-rentora-success-soft px-2.5 py-1 text-xs font-bold text-rentora-success shadow-rentora-card"><ShieldCheck size={14} />{t('badgeKycVerified')}</span>}
                {!isActive && <span className="rounded-rentora-pill bg-rentora-warning-soft px-2.5 py-1 text-xs font-bold text-rentora-warning">{status}</span>}
              </div>
            </div>
            {images.length > 1 && <div className="flex gap-2 overflow-x-auto p-2.5" aria-label={l('تصاویر آگهی', 'Listing images', 'صور الإعلان', '物品图片')}>
              {images.map((src, index) => <button key={src + index} type="button" onClick={() => setActiveImageIndex(index)} aria-label={l(`تصویر ${index + 1}`, `Image ${index + 1}`, `الصورة ${index + 1}`, `图片 ${index + 1}`)} className={`h-16 w-20 shrink-0 overflow-hidden rounded-rentora-control border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rentora-primary-accent ${index === activeImageIndex ? 'border-rentora-primary-accent' : 'border-transparent'}`}><img src={src} alt="" className="h-full w-full object-cover" /></button>)}
            </div>}
          </div>

          <section className="rounded-rentora-panel border border-rentora-border bg-rentora-surface p-4 shadow-rentora-card sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="rounded-rentora-pill bg-rentora-primary-soft px-2.5 py-1 text-rentora-primary">{item.category}</span>
              <span className="inline-flex items-center gap-1"><MapPin size={14} />{item.location || l('موقعیت ثبت نشده', 'Location not provided', 'الموقع غير محدد', '未提供位置')}</span>
              {averageRating ? <span className="inline-flex items-center gap-1 text-amber-700"><Star size={14} fill="currentColor" />{averageRating} ({totalReviews})</span> : <span>{l('هنوز امتیازی ثبت نشده', 'No ratings yet', 'لا توجد تقييمات بعد', '暂无评分')}</span>}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-rentora-ink sm:text-3xl">{item.title}</h1>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{item.description || l('توضیحات تکمیلی برای این کالا ثبت نشده است.', 'No additional description provided.', 'لم تتم إضافة تفاصيل إضافية.', '物主未填写附加说明。')}</p>
          </section>

          <section className="rounded-rentora-panel border border-rentora-border bg-rentora-surface p-4 shadow-rentora-card sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-black text-rentora-ink">{l('مالک آگهی', 'Listing owner', 'مالك الإعلان', '物主')}</h2>{item.ownerKYC && <span className="text-xs font-bold text-rentora-success">{l('احراز هویت‌شده', 'KYC verified', 'موثق', '已认证')}</span>}</div>
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => onOpenPublicProfile?.(item.ownerUsername)} className="flex min-h-12 min-w-0 items-center gap-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rentora-primary-accent">
                <img src={item.ownerAvatar} alt="" className="h-11 w-11 rounded-rentora-control bg-slate-100 object-cover" />
                <span className="min-w-0"><span className="block truncate font-bold text-rentora-ink" dir="ltr">@{item.ownerUsername || 'pioneer'}</span><span className="text-xs text-slate-500">{t('itemOwnerInfo')}</span></span>
              </button>
              {!isOwner && onOpenChat && <button type="button" onClick={() => onOpenChat(item)} className="min-h-11 shrink-0 rounded-rentora-control border border-rentora-border px-3 text-xs font-bold text-rentora-primary hover:bg-rentora-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rentora-primary-accent"><MessageSquare size={15} className="inline me-1" />{t('itemChatBtn')}</button>}
            </div>
          </section>

          <section className="rounded-rentora-panel border border-rentora-warning-border bg-rentora-warning-soft/50 p-4">
            <div className="flex items-start gap-3"><Lock className="mt-0.5 shrink-0 text-rentora-warning" size={19} /><div><h2 className="font-black text-rentora-ink">{l('اطلاعات تماس خصوصی', 'Private contact details', 'بيانات التواصل الخاصة', '私人联系信息')}</h2><p className="mt-1 text-xs leading-6 text-slate-600">{l('اطلاعات تماس و هماهنگی تحویل فقط پس از تأیید پرداخت کارمزد رزرو و ایجاد دسترسی معتبر باز می‌شود.', 'Owner contact and handover details are unlocked only after verified booking-fee completion and an authorized rental context.', 'تُفتح بيانات التواصل بعد تأكيد دفع العمولة وإنشاء سياق إيجار مصرح به.', '只有在预订平台费完成验证并建立授权租赁后，才会解锁联系与交接信息。')}</p></div></div>
          </section>

          <section className="rounded-rentora-panel border border-rentora-border bg-rentora-surface p-4 shadow-rentora-card sm:p-5">
            <div className="mb-3 flex items-center gap-2"><Star size={17} className="text-amber-500" fill="currentColor" /><h2 className="font-black text-rentora-ink">{t('itemReviewsTitle')} ({totalReviews})</h2></div>
            {loadingReviews ? <div className="rounded-rentora-control bg-slate-50 p-4 text-center text-sm text-slate-500">{l('در حال بارگذاری نظرات...', 'Loading reviews...', 'جارٍ تحميل التقييمات...', '正在加载评价...')}</div> : totalReviews === 0 ? <div className="rounded-rentora-control bg-slate-50 p-4 text-center text-sm text-slate-500">{t('itemNoReviews')}</div> : <div className="space-y-2">{reviewsData.reviews.map((review, index) => <article key={review.id || index} className="rounded-rentora-control border border-rentora-border p-3"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{review.reviewerUsername || review.userUsername || l('کاربر', 'User', 'مستخدم', '用户')}</strong><span className="inline-flex items-center gap-1 text-xs text-amber-700"><Star size={13} fill="currentColor" />{review.rating}</span></div>{review.reviewText && <p className="mt-2 text-sm leading-6 text-slate-600">{review.reviewText}</p>}</article>)}</div>}
          </section>
        </div>

        <aside className="lg:sticky lg:top-4">
          <div className="rounded-rentora-panel border border-rentora-border bg-rentora-surface p-4 shadow-rentora-panel sm:p-5">
            <div className="mb-4"><p className="text-xs font-semibold text-slate-500">{t('dailyRent')}</p><div className="mt-1 text-3xl font-black text-rentora-success" dir="ltr">{item.pricePerDay} π <span className="text-xs font-semibold text-slate-400">/ {l('روز', 'day', 'يوم', '天')}</span></div></div>
            <div className="space-y-2 border-y border-rentora-border py-3 text-sm"><div className="flex justify-between gap-3"><span className="text-slate-500">{t('refundableDeposit')}</span><strong dir="ltr">{item.deposit || 0} π</strong></div><div className="flex justify-between gap-3"><span className="text-slate-500">{l('مدل تسویه', 'Settlement', 'التسوية', '结算')}</span><strong className="text-end text-rentora-primary">{l('مستقیم بین طرفین', 'Direct P2P', 'مباشر بين الطرفين', '双方直接结算')}</strong></div></div>
            <p className="mt-3 text-xs leading-6 text-slate-500">{l('کرایه و ودیعه در زمان تحویل مستقیماً بین طرفین تسویه می‌شود. Rentora فقط کارمزد پلتفرم را از مسیر Pi دریافت می‌کند.', 'Rent and deposit are settled directly between owner and renter at handover. Rentora processes only the platform fee through Pi.', 'يُسوى الإيجار والتأمين مباشرة عند التسليم، وتحصل رنتورا على عمولة المنصة عبر باي فقط.', '租金和押金在交付时由双方直接结算，Rentora 仅通过 Pi 收取平台费。')}</p>
            <div className="mt-4 grid gap-2">
              {!isOwner && onOpenChat && <button type="button" onClick={() => onOpenChat(item)} className="min-h-12 rounded-rentora-control border border-rentora-border px-4 text-sm font-bold text-rentora-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rentora-primary-accent"><MessageSquare size={17} className="inline me-2" />{t('itemChatBtn')}</button>}
              {isOwner ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><button type="button" onClick={() => onEditItem?.(item)} className="min-h-12 rounded-rentora-control bg-rentora-primary-soft px-4 text-sm font-black text-rentora-primary"><Pencil size={16} className="inline me-2" />{l('ویرایش', 'Edit', 'تعديل', '编辑')}</button><button type="button" onClick={onNavigateToOwnerHub} className="min-h-12 rounded-rentora-control bg-rentora-primary px-4 text-sm font-black text-white">{l('پنل مالک', 'Owner Hub', 'لوحة المؤجر', '物主中心')}</button></div> : <button type="button" onClick={() => setBookingOpen(true)} disabled={!isActive} className="min-h-12 rounded-rentora-control bg-rentora-primary px-4 text-sm font-black text-white shadow-rentora-card disabled:cursor-not-allowed disabled:opacity-50"><CalendarDays size={17} className="inline me-2" />{isActive ? t('itemBookBtn') : l('این آگهی فعلاً قابل رزرو نیست', 'This listing is not currently bookable', 'هذا الإعلان غير متاح للحجز حالياً', '当前无法预订此物品')}</button>}
            </div>
          </div>
        </aside>
      </section>

      {bookingOpen && <BookingModal item={item} isOpen={bookingOpen} onClose={() => setBookingOpen(false)} onBookingSuccess={onBookingSuccess} />}
      {reportOpen && <ReportModal isOpen={reportOpen} onClose={() => setReportOpen(false)} target={item} type="listing" />}
    </main>
  );
}
