import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import ItemCard from '../components/ItemCard';
import SubscriptionModal from '../components/SubscriptionModal';
import { 
  Briefcase, 
  Crown, 
  Plus, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  TrendingUp, 
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Package,
  Layers,
  ArrowRight,
  Check,
  Edit3
} from 'lucide-react';

export default function OwnerHubPage({ onNavigate, onSelectItem, onEditItem, onRentItem }) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen } = usePiAuth();
  const { 
    items = [], 
    rentals = [], 
    toggleItemStatus, 
    confirmReturnOneTap, 
    isUserPro 
  } = useRentora();

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'active' | 'inactive'
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [processingRentalId, setProcessingRentalId] = useState(null);
  const [successToast, setSuccessToast] = useState('');

  if (!isAuthenticated) {
    return (
      <div className="py-16 text-center max-w-md mx-auto space-y-4 animate-fadeIn select-none">
        <div className="w-12 h-12 mx-auto rounded-xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#26215C] dark:text-[#EEEDFE] flex items-center justify-center">
          <Briefcase className="w-6 h-6 stroke-[1.8]" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('ownerHubTitle')}
        </h2>
        <p className="text-xs text-slate-500">
          {t('ownerHubSubtitle')}
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="btn-primary px-5 py-2.5 text-xs font-bold cursor-pointer"
        >
          {t('navLogin')}
        </button>
      </div>
    );
  }

  const isPro = isUserPro(currentUser?.username);

  // My items
  const myItems = (items || []).filter(
    i => i.ownerUid === currentUser.uid || i.ownerUsername?.toLowerCase() === currentUser.username?.toLowerCase()
  );

  const filteredItems = myItems.filter(item => {
    if (activeTab === 'active') return !item.status || item.status === 'active';
    if (activeTab === 'inactive') return item.status === 'paused' || item.status === 'inactive';
    return true;
  });

  // Pending handover requests for my items
  const pendingRequests = (rentals || []).filter(
    r => r.ownerUsername?.toLowerCase() === currentUser.username?.toLowerCase() &&
         (r.status === 'confirmed' || r.status === 'active')
  );

  // Active rentals currently with renters
  const activeRentalsInUse = (rentals || []).filter(
    r => r.ownerUsername?.toLowerCase() === currentUser.username?.toLowerCase() && r.status === 'active'
  );

  // Completed rentals count
  const completedRentals = (rentals || []).filter(
    r => r.ownerUsername?.toLowerCase() === currentUser.username?.toLowerCase() && r.status === 'completed'
  );

  // Total Earnings
  const totalEarnings = completedRentals.reduce((sum, r) => sum + (r.baseAmount || 0), 0);

  const handleConfirmReturn = async (rentalId) => {
    setProcessingRentalId(rentalId);
    try {
      const res = await confirmReturnOneTap(rentalId);
      if (res.success) {
        setSuccessToast(l(
          'بازگشت سالم کالا تایید و ودیعه نقدی عودت داده شد.',
          'Safe return confirmed & cash deposit refunded.',
          'تم تأكيد إعادة الغرض سالماً وإرجاع التأمين النقدي.',
          '已确认安全归还并结清押金。'
        ));
        setTimeout(() => setSuccessToast(''), 3000);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setProcessingRentalId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-16 select-none animate-fadeIn">
      
      {/* 1. Header with Post New Item CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl rentora-card">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#26215C] text-white flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold text-slate-900 dark:text-white">
                {t('ownerHubTitle')}
              </h1>
              {isPro && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400 text-[#26215C]">
                  PRO VIP
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {t('ownerHubSubtitle')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('list-item')}
          className="btn-primary px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{t('ownerBtnAddGear')}</span>
        </button>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="p-3 rounded-xl badge-trust text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-[#0F6E56]" />
          <span>{successToast}</span>
        </div>
      )}

      {/* 2. Pro VIP Subscription Banner */}
      <div className={`p-4 rounded-2xl border transition-all ${
        isPro 
          ? 'bg-gradient-to-r from-amber-500/15 via-[#26215C]/10 to-amber-500/15 border-amber-300 dark:border-amber-500/30' 
          : 'banner-purple'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-[#26215C] flex items-center justify-center shrink-0 shadow-md">
              <Crown className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {isPro ? t('ownerProBannerTitle') : l('ارتقا به موجر طلایی (Rentora Pro VIP)', 'Upgrade to Rentora Pro VIP', 'الترقية للمؤجر الذهبي (Rentora Pro)', '升级至黄金 Pro VIP 房东')}
                </h3>
                {isPro && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400 text-[#26215C]">
                    ACTIVE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">
                {t('ownerProBannerDesc')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSubscriptionOpen(true)}
            className="btn-primary px-4 py-2 text-xs font-bold cursor-pointer shrink-0 self-start sm:self-auto shadow-xs"
          >
            {isPro ? l('مدیریت پلن Pro', 'Manage Pro Plan', 'إدارة خطة Pro', '管理 Pro 会员') : t('ownerProUpgradeBtn')}
          </button>
        </div>
      </div>

      {/* 3. Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-3.5 rounded-xl rentora-card text-center space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">{t('ownerStatsListings')}</span>
          <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">{myItems.length}</div>
        </div>

        <div className="p-3.5 rounded-xl rentora-card text-center space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">{t('ownerStatsActiveRentals')}</span>
          <div className="text-lg sm:text-xl font-black text-[#534AB7] dark:text-[#AFA9EC] font-mono">{activeRentalsInUse.length}</div>
        </div>

        <div className="p-3.5 rounded-xl badge-trust text-center space-y-1">
          <span className="text-[10px] text-[#0F6E56] font-bold uppercase block">{t('ownerStatsCompletedRentals')}</span>
          <div className="text-lg sm:text-xl font-black text-[#0F6E56] font-mono">{completedRentals.length}</div>
        </div>

        <div className="p-3.5 rounded-xl banner-purple text-center space-y-1">
          <span className="text-[10px] text-[#534AB7] font-bold uppercase block">{t('ownerStatsRevenue')}</span>
          <div className="text-lg sm:text-xl font-black text-[#26215C] dark:text-white font-mono">{totalEarnings.toFixed(2)} π</div>
        </div>
      </div>

      {/* 4. Pending Handover Requests (Amber Card) */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-bold text-[#854F0B] dark:text-[#FAC775] flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500 stroke-[2]" />
              <span>{t('ownerPendingRequestsTitle')} ({pendingRequests.length})</span>
            </h2>
          </div>

          <div className="space-y-2.5">
            {pendingRequests.map((rental) => (
              <div
                key={rental.id}
                className="p-4 rounded-xl badge-amber flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white text-sm">
                    {rental.itemTitle}
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">
                    {l('مستاجر:', 'Renter:', 'المستأجر:', '租客：')} <strong dir="ltr">@{rental.renterUsername}</strong>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {rental.startDate} ➔ {rental.endDate} ({rental.daysCount} {l('روز', 'days', 'أيام', '天')})
                  </div>
                  <div className="text-[11px] text-[#0F6E56] font-bold font-mono">
                    {l('کرایه نقدی دریافتی در محل:', 'Cash payout at pickup:', 'المبلغ النقدي عند الاستلام:', '线下实收现金：')} {rental.baseAmount} π
                  </div>
                </div>

                {rental.status === 'active' && (
                  <button
                    type="button"
                    disabled={processingRentalId === rental.id}
                    onClick={() => handleConfirmReturn(rental.id)}
                    className="btn-primary px-3.5 py-2 text-xs font-bold cursor-pointer shrink-0 self-start sm:self-auto bg-[#0F6E56] hover:bg-[#0b5442]"
                  >
                    {processingRentalId === rental.id ? '...' : t('btnConfirmReturn')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. My Listings Management Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#534AB7] stroke-[2]" />
            <span>{t('ownerMyListingsTitle')} ({myItems.length})</span>
          </h2>

          <div className="flex items-center gap-1 text-xs">
            {['all', 'active', 'inactive'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === tab
                    ? 'bg-[#26215C] text-white dark:bg-[#534AB7]'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab === 'all' ? t('catAll') : (tab === 'active' ? t('ownerToggleActive') : t('ownerToggleInactive'))}
              </button>
            ))}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-8 text-center rounded-xl rentora-card space-y-2">
            <Package className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
            <p className="text-xs text-slate-400">
              {l('کالایی در این بخش یافت نشد.', 'No items found in this section.', 'لا توجد أجهزة في هذا القسم.', '此分类下暂无物品。')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredItems.map((item) => {
              const isItemActive = !item.status || item.status === 'active';
              return (
                <div key={item.id} className="p-3 rounded-xl rentora-card flex items-center justify-between gap-3">
                  <div 
                    onClick={() => onSelectItem(item)}
                    className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                  >
                    <img
                      src={item.images?.[0] || 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=900&auto=format&fit=crop&q=80'}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">{item.title}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] font-black text-[#0F6E56] font-mono">
                          {item.pricePerDay} π / {l('روز', 'day', 'يوم', '天')}
                        </span>
                        {item.images?.length > 1 && (
                          <span className="text-[9px] text-slate-400">({item.images.length} {l('عکس', 'photos', 'صور', '图')})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditItem && onEditItem(item)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#534AB7] hover:border-[#534AB7] dark:hover:border-[#534AB7] text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                      title={l('ویرایش آگهی', 'Edit Listing', 'تعديل الإعلان', '编辑')}
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#534AB7]" />
                      <span className="text-[11px]">{l('ویرایش', 'Edit', 'تعديل', '编辑')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleItemStatus(item.id)}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                        isItemActive 
                          ? 'bg-[#E1F5EE] text-[#0F6E56]' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                      title={isItemActive ? l('توقف موقت نمایش آگهی', 'Pause listing', 'إيقاف مؤقت', '暂停展示') : l('فعال‌سازی نمایش آگهی', 'Activate listing', 'تفعيل', '激活展示')}
                    >
                      {isItemActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      <span className="text-[10px] hidden sm:inline">{isItemActive ? t('ownerToggleActive') : t('ownerToggleInactive')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionOpen}
        onClose={() => setIsSubscriptionOpen(false)}
      />

    </div>
  );
}
