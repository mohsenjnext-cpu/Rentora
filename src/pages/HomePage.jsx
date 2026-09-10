import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRentora } from '../context/RentoraContext';
import { usePiAuth } from '../context/PiAuthContext';
import CategoryBar from '../components/CategoryBar';
import ItemCard from '../components/ItemCard';
import EmptyState from '../components/EmptyState';
import { 
  Search, 
  ShieldCheck, 
  Package, 
  Users, 
  Plus, 
  CheckCircle2 
} from 'lucide-react';

export default function HomePage({ onNavigate, onSelectItem, onRentItem }) {
  const { lang, dir, t, l } = useLanguage();
  const { items = [] } = useRentora();
  const { users = [], currentUser } = usePiAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate('discover', { query: searchQuery.trim() });
    } else {
      onNavigate('discover');
    }
  };

  const activeItems = (items || []).filter(i => !i.status || i.status === 'active');
  const latestItems = activeItems.slice(0, 10);
  const totalPioneersCount = Math.max(users.length, currentUser ? 1 : 0);

  return (
    <div className="space-y-5 sm:space-y-6 pb-12 select-none">
      
      {/* 1. Hero Banner (Light purple tint card #EEEDFE) */}
      <section className="banner-purple p-5 sm:p-7">
        <div className="max-w-2xl space-y-3">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-3xl font-bold text-[#26215C] dark:text-white leading-tight">
              {t('homeHeroTitle')}
            </h1>
            <p className="text-xs sm:text-sm text-[#534AB7] dark:text-[#AFA9EC] font-semibold">
              {t('homeHeroSubtitle')}
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => onNavigate('list-item')}
              className="btn-primary px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{t('navPostItem')}</span>
            </button>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="pt-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute top-2.5 left-3 rtl:left-auto rtl:right-3 stroke-[2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('homeSearchPlaceholder')}
                className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-2 text-xs rounded-lg bg-white dark:bg-[#151426] text-slate-900 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-[#534AB7]"
              />
            </div>
            <button
              type="submit"
              className="btn-primary px-3.5 py-2 text-xs font-bold shrink-0 cursor-pointer"
            >
              <span>{t('btnSearch')}</span>
            </button>
          </form>
        </div>
      </section>

      {/* 2. Horizontal Scrollable Category Chips */}
      <section className="space-y-2">
        <CategoryBar
          selectedCategory="all"
          onSelectCategory={(catId) => onNavigate('discover', { category: catId })}
        />
      </section>

      {/* 3. KYC Trust Banner */}
      <section className="p-3 sm:p-3.5 rounded-xl badge-trust flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/90 dark:bg-[#0B382C] text-[#0F6E56] dark:text-[#48D2A8] shrink-0">
            <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-[#0F6E56] dark:text-[#48D2A8]">
              {t('homeTrustBadgeTitle')}
            </h4>
            <p className="text-[11px] text-[#0F6E56]/80 dark:text-slate-300">
              {t('homeTrustBadgeDesc')}
            </p>
          </div>
        </div>
      </section>

      {/* 4. Platform Real Stats Counters */}
      <section className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {/* تعداد آگهی‌ها */}
        <div className="p-3 rounded-xl rentora-card text-center space-y-0.5">
          <Package className="w-4 h-4 mx-auto text-[#534AB7] stroke-[1.8]" />
          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-mono">
            {activeItems.length}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">
            {t('homeStatItems')}
          </div>
        </div>

        {/* تعداد کاربران */}
        <div className="p-3 rounded-xl rentora-card text-center space-y-0.5">
          <Users className="w-4 h-4 mx-auto text-[#0F6E56] stroke-[1.8]" />
          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-mono">
            {totalPioneersCount}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">
            {t('homeStatPioneers')}
          </div>
        </div>

        {/* تایید دوطرفه تحویل حضوری */}
        <div className="p-3 rounded-xl rentora-card text-center space-y-0.5">
          <CheckCircle2 className="w-4 h-4 mx-auto text-[#0F6E56] stroke-[1.8]" />
          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-mono">
            ۱۰۰٪
          </div>
          <div className="text-[10px] text-slate-400 font-medium">
            {t('homeStatHandover')}
          </div>
        </div>
      </section>

      {/* 5. "جدیدترین وسایل" Product Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            {t('homeFeaturedTitle')}
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('discover')}
            className="text-xs font-semibold text-[#534AB7] dark:text-[#AFA9EC] hover:underline cursor-pointer"
          >
            {t('homeViewAll')}
          </button>
        </div>

        {latestItems.length === 0 ? (
          <EmptyState
            type="package"
            title={t('homeNoItemsTitle')}
            message={t('homeNoItemsDesc')}
            actionLabel={t('homePostFirstItem')}
            onAction={() => onNavigate('list-item')}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            {latestItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onSelect={onSelectItem}
                onRentClick={onRentItem}
              />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
