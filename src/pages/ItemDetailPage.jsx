import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import BookingModal from '../components/BookingModal';
import ReportModal from '../components/ReportModal';
import { 
  ArrowRight, 
  MapPin, 
  Star, 
  Heart, 
  Share2, 
  ShieldCheck, 
  Coins, 
  Flag, 
  Check, 
  Crown,
  MessageSquare
} from 'lucide-react';

export default function ItemDetailPage({ 
  item, 
  onBack, 
  onBookingSuccess, 
  onOpenChat,
  onOpenPublicProfile,
  onNavigateToOwnerHub 
}) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, setAuthModalOpen } = usePiAuth();
  const { favorites, toggleFavorite, isUserPro, reviews = [] } = useRentora();

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

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
  const isOwnerPro = item.ownerIsPro || isUserPro(item.ownerUsername);

  // Real Reviews for this item
  const itemReviews = (reviews || []).filter(rev => rev.itemId === item.id);

  const handleShare = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {}
  };

  const imagesList = (item.images && item.images.length > 0)
    ? item.images
    : ['https://images.unsplash.com/photo-1504148455328-c376907d081c?w=900&auto=format&fit=crop&q=80'];

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24 select-none">
      
      {/* 1. Top Bar: Back button, Title, Share, Favorite, Report */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#534AB7] cursor-pointer"
        >
          <ArrowRight className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-0' : 'rotate-180'}`} />
          <span>{t('btnBack')}</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleShare}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
            title={t('btnShare')}
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => toggleFavorite(item.id)}
            className={`p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 transition cursor-pointer ${
              isFav ? 'text-rose-500 bg-rose-50 dark:bg-rose-950/30' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
            title={t('btnFavorite')}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-500 transition cursor-pointer"
            title={t('itemReportBtn')}
          >
            <Flag className="w-4 h-4" />
          </button>
        </div>
      </div>

      {copiedLink && (
        <div className="p-2 rounded-lg badge-trust text-xs font-semibold flex items-center justify-center gap-1.5 animate-fadeIn">
          <Check className="w-4 h-4 text-[#0F6E56]" />
          <span>{t('itemShareSuccess')}</span>
        </div>
      )}

      {/* 2. Main Image Carousel (Gallery) */}
      <div className="space-y-2">
        <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800">
          <img
            src={imagesList[activeImageIndex]}
            alt={item.title}
            className="w-full h-full object-cover"
          />

          {/* Badges in top corners */}
          <div className="absolute top-3 left-3 rtl:left-auto rtl:right-3 flex items-center gap-1.5">
            {isOwnerPro && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-400 text-[#26215C] flex items-center gap-1 shadow-sm">
                <Crown className="w-3 h-3" />
                <span>{t('badgePro')}</span>
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold badge-trust flex items-center gap-1 shadow-sm">
              <ShieldCheck className="w-3 h-3 stroke-[2.2]" />
              <span>{t('badgeKycVerified')}</span>
            </span>
          </div>
        </div>

        {/* Thumbnail row if multiple images */}
        {imagesList.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {imagesList.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveImageIndex(idx)}
                className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition cursor-pointer ${
                  activeImageIndex === idx ? 'border-[#534AB7]' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Item Title, Category, City */}
      <div className="space-y-1.5 pb-2 border-b border-slate-150 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#EEEDFE] dark:bg-[#1E1B3D] text-[#26215C] dark:text-[#EEEDFE]">
            {item.category}
          </span>
          <span className="flex items-center gap-1 text-slate-500 font-medium">
            <MapPin className="w-3.5 h-3.5 text-slate-400 stroke-[1.8]" />
            <span>{item.location || 'ایران'}</span>
          </span>
          <span className="flex items-center gap-0.5 text-amber-600 font-bold">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 stroke-[2]" />
            <span>{itemReviews.length > 0 ? (itemReviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) / itemReviews.length).toFixed(1) : (item.rating && item.ratingCount > 0 ? `${item.rating}` : l('جدید', 'New', 'جديد', '新发布'))}</span>
          </span>
        </div>

        <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
          {item.title}
        </h1>
      </div>

      {/* 4. Owner Card */}
      <div className="p-3.5 rounded-xl rentora-card flex items-center justify-between gap-3">
        <div 
          onClick={() => onOpenPublicProfile && onOpenPublicProfile(item.ownerUsername)}
          className="flex items-center gap-3 cursor-pointer group"
          title={l('مشاهده پروفایل عمومی موجر', 'View Public Profile', 'عرض الملف الشخصي للمؤجر', '查看物主公开主页')}
        >
          <img
            src={item.ownerAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${item.ownerUsername}`}
            alt=""
            className="w-11 h-11 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-slate-900 dark:text-white font-mono group-hover:text-[#534AB7] transition" dir="ltr">
                @{item.ownerUsername || 'pioneer'}
              </span>
              {isOwnerPro && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400 text-[#26215C] flex items-center gap-0.5">
                  <Crown className="w-2.5 h-2.5" />
                  <span>PRO</span>
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {t('itemOwnerInfo')} {item.ownerKYC ? <>• <span className="text-[#0F6E56] font-semibold">KYC ✓</span></> : <>• <span className="text-slate-400">({l('احراز نشده', 'Unverified', 'غير موثق', '未认证')})</span></>}
            </div>
          </div>
        </div>

        {/* Action: Open Chat with Owner */}
        {onOpenChat && !isOwner && (
          <button
            type="button"
            onClick={() => onOpenChat({ ownerUsername: item.ownerUsername, title: item.title, id: item.id, images: item.images, pricePerDay: item.pricePerDay })}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-700 dark:text-slate-200 hover:border-[#534AB7] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#534AB7] stroke-[2]" />
            <span>{t('itemChatBtn')}</span>
          </button>
        )}
      </div>

      {/* 5. Description & Specifications */}
      <div className="space-y-2">
        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
          {t('itemDescription')}
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50/60 dark:bg-[#16152B]/40 p-3.5 rounded-xl border border-slate-150 dark:border-slate-800 whitespace-pre-line">
          {item.description || l('توضیحات تکمیلی برای این کالا ثبت نشده است.', 'No additional description provided.', 'لم تتم إضافة تفاصيل إضافية.', '物主未填写附加说明。')}
        </p>
      </div>

      {/* 6. Pricing Breakdown Card */}
      <div className="p-4 rounded-xl rentora-card space-y-2 text-xs">
        <h3 className="font-bold text-slate-900 dark:text-white pb-1.5 border-b border-slate-150 dark:border-slate-800">
          {t('itemPriceCardTitle')}
        </h3>

        <div className="flex justify-between text-slate-600 dark:text-slate-300">
          <span>{t('dailyRent')}:</span>
          <span className="font-black text-[#0F6E56] dark:text-[#48D2A8] font-mono">{item.pricePerDay} π / {l('روز', 'day', 'يوم', '天')}</span>
        </div>

        <div className="flex justify-between text-slate-600 dark:text-slate-300">
          <span>{t('refundableDeposit')}:</span>
          <span className="font-bold text-slate-900 dark:text-white font-mono">{item.deposit || 0} π</span>
        </div>

        <div className="flex justify-between text-slate-600 dark:text-slate-300">
          <span>{l('شیوه تحویل:', 'Handover Method:', 'طريقة التسليم:', '交接方式：')}</span>
          <span className="font-medium text-[#534AB7] dark:text-[#AFA9EC]">{l('حضوری و مستقیم (تست در محل)', 'In-Person Handover (inspect on site)', 'تسليم مباشر يداً بيد (فحص في الموقع)', '当面交接（现场验机）')}</span>
        </div>

        <div className="pt-1.5 text-[10px] text-slate-400 border-t border-slate-200 dark:border-slate-800">
          {t('itemDirectHandoverNotice')}
        </div>
      </div>

      {/* 7. Bottom Fixed CTA Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-[#121124]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          
          <div>
            <div className="text-[10px] text-slate-400 font-medium">{t('dailyRent')}:</div>
            <div className="text-base sm:text-lg font-black text-[#0F6E56] dark:text-[#48D2A8] font-mono">
              {item.pricePerDay} π <span className="text-[10px] font-normal text-slate-400">/{l('روز', 'd', 'يوم', '天')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenChat && !isOwner && (
              <button
                type="button"
                onClick={() => onOpenChat({ ownerUsername: item.ownerUsername, title: item.title, id: item.id, images: item.images, pricePerDay: item.pricePerDay })}
                className="btn-secondary px-3.5 py-2 text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <MessageSquare className="w-4 h-4 text-[#534AB7]" />
                <span className="hidden sm:inline">{t('itemChatBtn')}</span>
              </button>
            )}

            {isOwner ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                  {l('شما مالک این کالا هستید', 'You own this item', 'أنت مالك هذا الغرض', '您是此物品的物主')}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateToOwnerHub && onNavigateToOwnerHub()}
                  className="px-4 py-2 rounded-xl bg-[#26215C] dark:bg-[#534AB7] text-white font-bold text-xs cursor-pointer shadow-sm hover:opacity-90 transition"
                >
                  {l('مدیریت در پنل مالک', 'Manage in Owner Hub', 'إدارة في لوحة المؤجر', '前往物主中心管理')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setBookingModalOpen(true)}
                className="btn-primary px-5 py-2 text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Coins className="w-4 h-4 text-amber-400" />
                <span>{t('itemBookBtn')}</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* 8. Reviews Section */}
      <div className="space-y-2.5 pt-2">
        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
          <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          <span>{t('itemReviewsTitle')} ({itemReviews.length})</span>
        </h3>

        {itemReviews.length === 0 ? (
          <div className="p-4 rounded-xl rentora-card text-center text-xs text-slate-400">
            {t('itemNoReviews')}
          </div>
        ) : (
          <div className="space-y-2">
            {itemReviews.map((rev, idx) => (
              <div key={rev.id || idx} className="p-3 rounded-xl rentora-card text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200" dir="ltr">@{rev.reviewerUsername}</span>
                  <span className="text-amber-500 font-bold">{rev.rating || 5} ★</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300">{rev.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      <BookingModal
        item={item}
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        onBookingSuccess={onBookingSuccess}
      />

      {/* Report Modal */}
      <ReportModal
        target={{ username: item.ownerUsername, title: item.title }}
        type="listing"
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
      />

    </div>
  );
}
