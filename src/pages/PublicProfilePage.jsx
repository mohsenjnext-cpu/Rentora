import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { getUserReputationSummary } from '../services/reputationService';
import ItemCard from '../components/ItemCard';
import { 
  ArrowRight, 
  ShieldCheck, 
  Star, 
  Package, 
  Clock, 
  MessageSquare,
  Share2
} from 'lucide-react';

export default function PublicProfilePage({ 
  username, 
  onBack, 
  onSelectItem, 
  onRentItem, 
  onOpenChat 
}) {
  const { lang, dir, t, l } = useLanguage();
  const { users = [] } = usePiAuth();
  const { items = [], rentals = [], reviews = [] } = useRentora();

  const targetUsername = username || 'pioneer';

  const targetUser = users.find(u => u.username?.toLowerCase() === targetUsername.toLowerCase());

  // Items listed by this user
  const userItems = (items || []).filter(
    i => i.ownerUsername?.toLowerCase() === targetUsername.toLowerCase() &&
         (!i.status || i.status === 'active')
  );

  // Dynamic reputation
  const repSummary = getUserReputationSummary(targetUsername, rentals, reviews);

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-16 select-none animate-fadeIn">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#534AB7] cursor-pointer"
        >
          <ArrowRight className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-0' : 'rotate-180'}`} />
          <span>{t('btnBack')}</span>
        </button>
      </div>

      {/* Pioneer Card */}
      <div className="p-4 sm:p-5 rounded-2xl rentora-card space-y-4">
        <div className="flex items-start gap-3.5">
          <img
            src={targetUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${targetUsername}`}
            alt=""
            className="w-16 h-16 rounded-2xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
          />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-white" dir="ltr">
                {targetUser?.displayName || `@${targetUsername}`}
              </h1>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold">
              {targetUser?.kycStatus === 'verified' || !targetUser ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 stroke-[2.2] text-[#0F6E56]" />
                  <span className="text-[#0F6E56]">KYC Verified Pioneer</span>
                </>
              ) : (
                <span className="text-slate-400 font-normal">({l('احراز هویت نشده', 'Unverified', 'غير موثق', '未认证')})</span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
              {targetUser?.bio || l('عضو تاییدشده جامعه پیشگامان شبکه پای در پلتفرم رنتورا.', 'Verified Pi Pioneer member on Rentora P2P marketplace.', 'عضو موثق في مجتمع رواد باي على منصة رنتورا.', 'Rentora 平台经过 Pi Network 认证的先锋成员。')}
            </p>
          </div>
        </div>

        {/* Dynamic Reputation Summary */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-150 dark:border-slate-800 text-center">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400">{t('itemReviewsTitle')}</span>
            <div className="text-xs font-bold text-amber-500 flex items-center justify-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>{repSummary.formattedScore} ({repSummary.reviewCount})</span>
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400">{t('ownerStatsListings')}</span>
            <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
              {userItems.length}
            </div>
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <Package className="w-4 h-4 text-[#534AB7]" />
          <span>{l('وسایل آگهی‌شده توسط این کاربر', 'Items listed by this Pioneer', 'الأغراض المعروضة بواسطة هذا المستخدم', '该用户发布的物品')} ({userItems.length})</span>
        </h2>

        {userItems.length === 0 ? (
          <div className="p-8 text-center rounded-xl rentora-card space-y-2">
            <Package className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
            <p className="text-xs text-slate-400">
              {l('این کاربر در حال حاضر آگهی فعالی ندارد.', 'No active listings currently.', 'لا توجد إعلانات نشطة حالياً لهذا المستخدم.', '该用户当前没有处于活跃状态的物品。')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3.5">
            {userItems.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onSelect={onSelectItem}
                onRentClick={onRentItem}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
