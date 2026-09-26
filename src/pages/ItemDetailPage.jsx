import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import BookingModal from '../components/BookingModal';
import ReportModal from '../components/ReportModal';
import {
  ArrowRight, MapPin, Star, Heart, Share2, ShieldCheck, Coins, Flag,
  Check, MessageSquare, Edit3, Loader2, Lock, ChevronLeft, ChevronRight, Maximize2, X
} from 'lucide-react';

export default function ItemDetailPage({
  item,
  onBack,
  onBookingSuccess,
  onOpenChat,
  onOpenPublicProfile,
  onNavigateToOwnerHub,
  onEditItem
}) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser } = usePiAuth();
  const { favorites, toggleFavorite, fetchListingReviews } = useRentora();

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [reviewsData, setReviewsData] = useState({
    stats: { totalReviews: 0, averageRating: null, isNew: true },
    reviews: []
  });
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewsError, setReviewsError] = useState('');

  useEffect(() => {
    if (!item?.id) return;
    let mounted = true;
    setLoadingReviews(true);
    setReviewsError('');
    fetchListingReviews(item.id)
      .then((data) => {
        if (mounted && data) setReviewsData(data);
      })
      .catch(() => {
        if (mounted) setReviewsError(l('بارگذاری نظرات ناموفق بود.', 'Unable to load reviews.', 'تعذر تحميل التقييمات.', '评价加载失败。'));
      })
      .finally(() => {
        if (mounted) setLoadingReviews(false);
      });
    return () => { mounted = false; };
  }, [item?.id, fetchListingReviews]);

  useEffect(() => {
    setActiveImageIndex(0);
    setGalleryOpen(false);
  }, [item?.id]);

  useEffect(() => {
    if (!galleryOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setGalleryOpen(false);
      if (event.key === 'ArrowLeft') moveImage(-1);
      if (event.key === 'ArrowRight') moveImage(1);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [galleryOpen, imagesList.length]);

  if (!item) return null;

  const isFav = (favorites || []).includes(item.id);
  const myName = (currentUser?.username || '').toLowerCase().replace('@', '').trim();
  const ownerName = (item.ownerUsername || '').toLowerCase().replace('@', '').trim();
  const isOwner = Boolean(
    currentUser && (
      (myName && ownerName && myName === ownerName) ||
      (item.ownerUid && currentUser.uid && item.ownerUid === currentUser.uid)
    )
  );

  const itemReviews = reviewsData.reviews || [];
  const averageRating = reviewsData.stats?.averageRating;
  const totalReviews = reviewsData.stats?.totalReviews || 0;
  const imagesList = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
  const hasGallery = imagesList.length > 0;

  const localized = (fa, en, ar, zh) => l(fa, en, ar, zh);
  const ownerInitial = (item.ownerUsername || 'R').replace('@', '').charAt(0).toUpperCase();

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url: window.location.href });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
      }
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const moveImage = (delta) => {
    if (imagesList.length < 2) return;
    setActiveImageIndex((current) => (current + delta + imagesList.length) % imagesList.length);
  };

  return (
    <div className="w-full max-w-6xl mx-auto pb-28 select-none">
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-[#534AB7] transition cursor-pointer"
        >
          <ArrowRight className={`w-4 h-4 ${dir === 'rtl' ? '' : 'rotate-180'}`} />
          <span>{t('btnBack')}</span>
        </button>

        <div className="flex items-center gap-1.5">
          {isOwner && (
            <button
              type="button"
              onClick={() => onEditItem?.(item)}
              className="px-2.5 py-1.5 rounded-lg border border-[#534AB7]/40 bg-[#EEEDFE] dark:bg-[#26215C] text-[#26215C] dark:text-[#EEEDFE] text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{localized('ویرایش', 'Edit', 'تعديل', '编辑')}</span>
            </button>
          )}
          <button type="button" onClick={handleShare} className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-[#534AB7] cursor-pointer" title={t('btnShare')}>
            <Share2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => toggleFavorite(item.id)}
            className={`p-2 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer ${isFav ? 'text-rose-500 bg-rose-50 dark:bg-rose-950/30' : 'text-slate-500 hover:text-[#534AB7]'}`}
            title={t('btnFavorite')}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500' : ''}`} />
          </button>
          <button type="button" onClick={() => setReportModalOpen(true)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-500 cursor-pointer" title={t('itemReportBtn')}>
            <Flag className="w-4 h-4" />
          </button>
        </div>
      </div>

      {copiedLink && (
        <div className="mb-4 p-2.5 rounded-xl badge-trust text-xs font-semibold flex items-center justify-center gap-1.5">
          <Check className="w-4 h-4" />
          <span>{t('itemShareSuccess')}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,.8fr)] gap-5 lg:items-start">
        <div className="space-y-5">
          <section>
            <div className="relative aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              {hasGallery ? (
                <img src={imagesList[activeImageIndex]} alt={item.title} className="w-full h-full object-cover cursor-zoom-in" onClick={() => setGalleryOpen(true)} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                  <div className="w-14 h-14 rounded-2xl bg-white/80 dark:bg-slate-800 flex items-center justify-center mb-2 text-xl font-black">R</div>
                  <span className="text-xs">{localized('تصویری برای این آگهی ثبت نشده است', 'No image available', 'لا توجد صورة لهذا الإعلان', '此商品暂无图片')}</span>
                </div>
              )}

              {item.ownerKYC && (
                <span className="absolute top-3 start-3 px-2.5 py-1 rounded-lg text-[10px] font-bold badge-trust flex items-center gap-1.5 shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {t('badgeKycVerified')}
                </span>
              )}

              {imagesList.length > 1 && (
                <>
                  <button type="button" onClick={() => moveImage(-1)} className="absolute top-1/2 start-3 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 text-white flex items-center justify-center cursor-pointer" aria-label={localized('تصویر قبلی', 'Previous image', 'الصورة السابقة', '上一张')}>
                    <ChevronLeft className={dir === 'rtl' ? 'rotate-180' : ''} />
                  </button>
                  <button type="button" onClick={() => moveImage(1)} className="absolute top-1/2 end-3 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 text-white flex items-center justify-center cursor-pointer" aria-label={localized('تصویر بعدی', 'Next image', 'الصورة التالية', '下一张')}>
                    <ChevronRight className={dir === 'rtl' ? 'rotate-180' : ''} />
                  </button>
                  <button type="button" onClick={() => setGalleryOpen(true)} className="absolute bottom-3 start-3 px-2.5 py-1.5 rounded-lg bg-black/55 text-white text-[10px] font-bold inline-flex items-center gap-1.5 cursor-pointer" aria-label={localized('باز کردن گالری تمام‌صفحه', 'Open fullscreen gallery', 'فتح المعرض بملء الشاشة', '打开全屏图库')}>
                    <Maximize2 className="w-3.5 h-3.5" />
                    {localized('تمام‌صفحه', 'Fullscreen', 'ملء الشاشة', '全屏')}
                  </button>
                  <span className="absolute bottom-3 end-3 px-2 py-1 rounded-md bg-black/55 text-white text-[10px] font-bold">
                    {activeImageIndex + 1} / {imagesList.length}
                  </span>
                </>
              )}
            </div>

            {imagesList.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pt-2.5 pb-1">
                {imagesList.map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`w-16 h-12 sm:w-20 sm:h-14 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${activeImageIndex === index ? 'border-[#534AB7]' : 'border-transparent opacity-70'}`}
                    aria-label={`${localized('تصویر', 'Image', 'صورة', '图片')} ${index + 1}`}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-[#EEEDFE] dark:bg-[#1E1B3D] text-[#26215C] dark:text-[#EEEDFE] font-semibold">{item.category}</span>
              <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <MapPin className="w-3.5 h-3.5" />
                {item.location || localized('موقعیت ثبت نشده', 'Location not provided', 'الموقع غير محدد', '未提供位置')}
              </span>
              <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                {averageRating ? `${averageRating} · ${totalReviews}` : localized('جدید', 'New', 'جديد', '新发布')}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white">{item.title}</h1>
          </section>

          <section className="rentora-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div
                onClick={() => onOpenPublicProfile?.(item.ownerUsername)}
                className="flex items-center gap-3 cursor-pointer group min-w-0"
                title={localized('مشاهده پروفایل عمومی مالک', 'View public profile', 'عرض الملف العام', '查看公开主页')}
              >
                {item.ownerAvatar ? (
                  <img src={item.ownerAvatar} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#534AB7] dark:text-[#AFA9EC] flex items-center justify-center font-black shrink-0">{ownerInitial}</div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-[#534AB7]">@{item.ownerUsername || 'owner'}</div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                    {item.ownerKYC ? <><ShieldCheck className="w-3 h-3 text-[#0F6E56]" /> <span className="text-[#0F6E56] font-semibold">{localized('احراز هویت شده', 'KYC verified', 'موثق', '已认证')}</span></> : localized('احراز هویت نشده', 'Not verified', 'غير موثق', '未认证')}
                  </div>
                </div>
              </div>
              {onOpenChat && !isOwner && (
                <button type="button" onClick={() => onOpenChat(item)} className="btn-secondary px-3 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0">
                  <MessageSquare className="w-3.5 h-3.5 text-[#534AB7]" />
                  <span>{t('itemChatBtn')}</span>
                </button>
              )}
            </div>
          </section>

          <section className="space-y-2.5">
            <h2 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">{t('itemDescription')}</h2>
            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-[#16152B]/50 border border-slate-200 dark:border-slate-800">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-7 whitespace-pre-line">
                {item.description || localized('توضیحات تکمیلی برای این آگهی ثبت نشده است.', 'No additional description provided.', 'لم تتم إضافة تفاصيل إضافية.', '物主未填写附加说明。')}
              </p>
            </div>
          </section>

          <section className="p-4 rounded-xl bg-slate-50/80 dark:bg-[#16152B]/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#534AB7] dark:text-[#AFA9EC] shrink-0"><Lock className="w-4 h-4" /></div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{localized('ارتباط و هماهنگی امن', 'Private coordination', 'التنسيق الخاص', '私密协调')}</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-6">
                {localized('اطلاعات تماس و هماهنگی مالک طبق جریان امن Rentora و پس از تایید پرداخت کارمزد رزرو در دسترس قرار می‌گیرد.', 'Owner contact and handover coordination follow Rentora’s secure flow and become available after the booking fee is confirmed.', 'تتم إتاحة بيانات التواصل والتنسيق وفق التدفق الآمن بعد تأكيد دفع عمولة الحجز.', '联系与交接信息将遵循 Rentora 安全流程，并在平台费确认后开放。')}
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">{t('itemReviewsTitle')} ({totalReviews})</h2>
            {loadingReviews ? (
              <div className="rentora-card p-5 flex justify-center items-center gap-2 text-xs text-slate-400"><Loader2 className="w-4 h-4 animate-spin text-[#534AB7]" />{localized('در حال بارگذاری نظرات...', 'Loading reviews...', 'جارٍ تحميل التقييمات...', '正在加载评价...')}</div>
            ) : reviewsError ? (
              <div className="rentora-card p-5 text-center text-xs text-rose-500 dark:text-rose-300">{reviewsError}</div>
            ) : totalReviews === 0 ? (
              <div className="rentora-card p-5 text-center text-xs text-slate-400">{t('itemNoReviews')}</div>
            ) : (
              <div className="space-y-2">
                {itemReviews.map((rev, index) => (
                  <article key={rev.id || index} className="rentora-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {rev.reviewerAvatar ? <img src={rev.reviewerAvatar} alt="" className="w-7 h-7 rounded-full object-cover" /> : <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold">{(rev.reviewerUsername || 'R').charAt(0).toUpperCase()}</div>}
                        <span className="text-xs font-bold truncate" dir="ltr">{rev.reviewerDisplayName || `@${rev.reviewerUsername}`}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-amber-500 font-bold text-xs shrink-0">{rev.rating}<Star className="w-3.5 h-3.5 fill-amber-400" /></span>
                    </div>
                    {rev.reviewText && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-6">{rev.reviewText}</p>}
                    {rev.createdAt && <time className="block mt-2 text-[10px] text-slate-400">{new Date(rev.createdAt).toLocaleDateString(lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar' : lang === 'zh' ? 'zh-CN' : 'en-US')}</time>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 space-y-3">
          <div className="rentora-card p-5 sm:p-6">
            <div className="flex items-end justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-xs text-slate-400">{t('dailyRent')}</div>
                <div className="mt-1 text-2xl font-black text-[#0F6E56] dark:text-[#48D2A8] font-mono">{item.pricePerDay} π</div>
              </div>
              <span className="text-xs text-slate-400">/ {localized('روز', 'day', 'يوم', '天')}</span>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="flex justify-between gap-3"><span className="text-slate-500">{t('refundableDeposit')}</span><span className="font-bold font-mono text-slate-900 dark:text-white">{item.deposit || 0} π</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">{localized('تسویه', 'Settlement', 'التسوية', '结算')}</span><span className="font-semibold text-[#534AB7] dark:text-[#AFA9EC]">{localized('مستقیم و غیرامانی', 'Direct P2P, non-escrow', 'مباشر وغير اماني', '双方直接结算，非托管')}</span></div>
            </div>

            <button
              type="button"
              onClick={() => setBookingModalOpen(true)}
              disabled={isOwner}
              className="w-full btn-primary py-3 text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Coins className="w-4 h-4 text-amber-400" />
              <span>{isOwner ? localized('آگهی شماست', 'Your listing', 'إعلانك', '这是你的商品') : t('itemBookBtn')}</span>
            </button>

            {!isOwner && onOpenChat && (
              <button type="button" onClick={() => onOpenChat(item)} className="w-full btn-secondary mt-2.5 py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
                <MessageSquare className="w-4 h-4 text-[#534AB7]" />
                {t('itemChatBtn')}
              </button>
            )}

            <p className="mt-3 text-[10px] text-slate-400 leading-5">
              {localized('قیمت نهایی رزرو و کارمزد از quote معتبر سرور در جریان رزرو تعیین می‌شود.', 'Final booking amounts and platform fee come from the server-authoritative quote during booking.', 'يتم تحديد المبالغ النهائية وعمولة المنصة من عرض السعر الموثوق على الخادم.', '最终预订金额与平台费由预订流程中的服务器权威报价确定。')}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#EEEDFE]/70 dark:bg-[#26215C]/50 border border-[#534AB7]/15">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#534AB7] mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">{localized('اعتماد و شفافیت', 'Trust & clarity', 'الثقة والوضوح', '信任与透明')}</div>
                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 leading-5">{localized('هویت، امتیاز، شرایط آگهی و مسیر رزرو قبل از اقدام قابل بررسی هستند.', 'Identity, rating, listing terms and the booking flow are visible before you act.', 'يمكن مراجعة الهوية والتقييم والشروط ومسار الحجز قبل المتابعة.', '操作前可查看身份、评价、商品条件与预订流程。')}</p>
              </div>
            </div>
          </div>

          {isOwner && (
            <div className="flex gap-2">
              <button type="button" onClick={() => onEditItem?.(item)} className="flex-1 btn-secondary py-2.5 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"><Edit3 className="w-3.5 h-3.5" />{localized('ویرایش', 'Edit', 'تعديل', '编辑')}</button>
              <button type="button" onClick={() => onNavigateToOwnerHub?.()} className="flex-1 btn-primary py-2.5 text-xs font-bold cursor-pointer">{localized('پنل مالک', 'Owner Hub', 'لوحة المؤجر', '物主中心')}</button>
            </div>
          )}
        </aside>
      </div>


      {galleryOpen && hasGallery && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" role="dialog" aria-modal="true" aria-label={localized('گالری تصاویر', 'Image gallery', 'معرض الصور', '图片图库')}>
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
            <span className="text-xs font-bold">{activeImageIndex + 1} / {imagesList.length}</span>
            <button type="button" onClick={() => setGalleryOpen(false)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer" aria-label={localized('بستن گالری', 'Close gallery', 'إغلاق المعرض', '关闭图库')}><X className="w-5 h-5" /></button>
          </div>
          <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 pb-4">
            <img src={imagesList[activeImageIndex]} alt={item.title} className="max-w-full max-h-full object-contain" />
            {imagesList.length > 1 && <>
              <button type="button" onClick={() => moveImage(-1)} className="absolute start-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer" aria-label={localized('تصویر قبلی', 'Previous image', 'الصورة السابقة', '上一张')}><ChevronLeft className={dir === 'rtl' ? 'rotate-180' : ''} /></button>
              <button type="button" onClick={() => moveImage(1)} className="absolute end-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer" aria-label={localized('تصویر بعدی', 'Next image', 'الصورة التالية', '下一张')}><ChevronRight className={dir === 'rtl' ? 'rotate-180' : ''} /></button>
            </>}
          </div>
          {imagesList.length > 1 && <div className="flex gap-2 overflow-x-auto px-4 pb-4 justify-center">
            {imagesList.map((src, index) => <button key={"fullscreen-" + src + "-" + index} type="button" onClick={() => setActiveImageIndex(index)} className={"w-16 h-12 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer " + (activeImageIndex === index ? 'border-white' : 'border-transparent opacity-60')} aria-label={localized('تصویر ' + (index + 1), 'Image ' + (index + 1), 'صورة ' + (index + 1), '图片 ' + (index + 1))}><img src={src} alt="" className="w-full h-full object-cover" /></button>)}
          </div>}
        </div>
      )}
      <BookingModal item={item} isOpen={bookingModalOpen} onClose={() => setBookingModalOpen(false)} onBookingSuccess={onBookingSuccess} />
      <ReportModal target={{ username: item.ownerUsername, title: item.title }} type="listing" isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} />
    </div>
  );
}
