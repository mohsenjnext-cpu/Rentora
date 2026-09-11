import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { getItemRatingSummary } from '../services/reputationService';
import { 
  MapPin, 
  Star, 
  ShieldCheck, 
  Heart, 
  Coins, 
  Crown,
  CheckCircle2,
  Settings
} from 'lucide-react';

export default function ItemCard({ item, onSelect, onRentClick }) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser } = usePiAuth();
  const { favorites = [], toggleFavorite, reviews = [] } = useRentora();

  if (!item) return null;

  const isFav = favorites.includes(item.id);

  const myName = (currentUser?.username || '').toLowerCase().replace('@', '').trim();
  const ownerName = (item.ownerUsername || '').toLowerCase().replace('@', '').trim();
  const isOwner = myName && ownerName && (myName === ownerName || (item.ownerUid && currentUser?.uid && item.ownerUid === currentUser.uid));

  // Dynamic Item Rating from verified reviews
  const ratingSummary = getItemRatingSummary(item, reviews);

  const imageUrl = (item.images && item.images.length > 0)
    ? item.images[0]
    : 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=900&auto=format&fit=crop&q=80';

  return (
    <div
      onClick={() => onSelect && onSelect(item)}
      className="group bg-white dark:bg-[#151426] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-2xs hover:shadow-md transition duration-200 flex flex-col justify-between cursor-pointer select-none"
    >
      <div>
        {/* Image Container with Badges */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          <img
            src={imageUrl}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            loading="lazy"
          />

          {/* Badges in Top Corners */}
          <div className="absolute top-2 left-2 rtl:left-auto rtl:right-2 flex items-center gap-1 z-10">
            {item.ownerKYC && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold badge-trust flex items-center gap-0.5 shadow-xs">
                <ShieldCheck className="w-2.5 h-2.5 stroke-[2.2]" />
                <span>KYC</span>
              </span>
            )}
            {isOwner && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EEEDFE] dark:bg-[#26215C] text-[#26215C] dark:text-[#EEEDFE] flex items-center gap-0.5 shadow-xs">
                {l('آگهی من', 'Mine', 'إعلاني', '我的发布')}
              </span>
            )}
          </div>

          {/* Favorite Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(item.id);
            }}
            className="absolute top-2 right-2 rtl:right-auto rtl:left-2 p-1.5 rounded-full bg-black/40 backdrop-blur-xs text-white hover:text-rose-400 transition cursor-pointer z-10"
            title={t('btnFavorite')}
          >
            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>

        {/* Content */}
        <div className="p-2.5 sm:p-3 space-y-1.5">
          {/* Location and Category */}
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-0.5 truncate">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{item.location || 'ایران'}</span>
            </span>
            <span className="flex items-center gap-0.5 text-amber-500 font-bold shrink-0">
              <Star className="w-3 h-3 fill-amber-400 stroke-[2]" />
              <span>{ratingSummary.formattedScore}</span>
            </span>
          </div>

          {/* Title */}
          <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-[#534AB7] transition">
            {item.title}
          </h3>
        </div>
      </div>

      {/* Pricing and Action Footer */}
      <div className="p-2.5 sm:p-3 pt-0 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 mt-1">
        <div>
          <span className="text-[9px] text-slate-400 font-medium block leading-none">{t('dailyRent')}</span>
          <div className="text-xs sm:text-sm font-black text-[#0F6E56] dark:text-[#48D2A8] font-mono mt-0.5">
            {item.pricePerDay} π <span className="text-[10px] font-normal text-slate-400">/{l('روز', 'd', 'يوم', '天')}</span>
          </div>
        </div>

        {isOwner ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onSelect) onSelect(item);
            }}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-[#1E1D33] text-slate-700 dark:text-slate-300 hover:border-[#534AB7] text-[11px] font-bold shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <Settings className="w-3 h-3 text-[#534AB7]" />
            <span>{l('مدیریت آگهی', 'Manage', 'إدارة', '管理')}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onRentClick) {
                onRentClick(item);
              } else if (onSelect) {
                onSelect(item);
              }
            }}
            className="btn-primary px-2.5 py-1.5 text-[11px] font-bold shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <Coins className="w-3 h-3 text-amber-400" />
            <span>{t('itemBookBtn')}</span>
          </button>
        )}
      </div>

    </div>
  );
}
