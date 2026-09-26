import React, { useMemo, useState } from 'react';
import { Search, ShieldCheck, Package, Users, CheckCircle2, Plus, ArrowLeft, Wrench, Camera, Tent, Dumbbell, Car, PartyPopper, Home } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useRentora } from '../context/RentoraContext';
import { usePiAuth } from '../context/PiAuthContext';
import ItemCard from '../components/ItemCard';
import RentoraCard from '../components/ui/RentoraCard';
import RentoraButton from '../components/ui/RentoraButton';
import RentoraEmptyState from '../components/ui/RentoraEmptyState';
import RentoraSkeleton from '../components/ui/RentoraSkeleton';

export default function HomeRedesign({ onNavigate, onSelectItem, onRentItem }) {
  const { t, l } = useLanguage();
  const { items = [], isInitialLoadDone = false } = useRentora();
  const { users = [], currentUser } = usePiAuth();
  const [query, setQuery] = useState('');

  const activeItems = useMemo(() => (items || []).filter(item => item && (!item.status || item.status === 'active')), [items]);
  const featuredItems = activeItems.slice(0, 8);
  const pioneerCount = Math.max(users.length, currentUser ? 1 : 0);
  const loading = !isInitialLoadDone && featuredItems.length === 0;

  const categories = [
    ['all', t('catAll'), Package],
    ['tools', t('catTools'), Wrench],
    ['cameras', t('catCameras'), Camera],
    ['camping', t('catCamping'), Tent],
    ['sports', t('catSports'), Dumbbell],
    ['vehicles', t('catVehicles'), Car],
    ['events', t('catEvents'), PartyPopper],
    ['home', t('catHome'), Home]
  ];

  const submitSearch = (event) => {
    event.preventDefault();
    onNavigate('discover', query.trim() ? { query: query.trim() } : {});
  };

  return (
    <div className="space-y-5 pb-16" dir="rtl">
      <section className="relative overflow-hidden rounded-[28px] border border-violet-100 dark:border-violet-900/50 bg-gradient-to-br from-violet-50 via-white to-emerald-50 dark:from-[#191633] dark:via-[#12111f] dark:to-[#0c2922] p-5 sm:p-8">
        <div className="max-w-2xl space-y-4">
          <div>
            <span className="inline-flex items-center rounded-full bg-white/80 dark:bg-white/10 px-3 py-1 text-[10px] font-bold text-violet-700 dark:text-violet-200 border border-violet-100 dark:border-violet-800">
              Rentora · Pi Testnet
            </span>
            <h1 className="mt-3 text-2xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white">{t('homeHeroTitle')}</h1>
            <p className="mt-2 max-w-xl text-xs sm:text-sm leading-6 text-slate-600 dark:text-slate-300">{t('homeHeroSubtitle')}</p>
          </div>
          <form onSubmit={submitSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
              <input value={query} onChange={e => setQuery(e.target.value)} type="search" placeholder={t('homeSearchPlaceholder')} aria-label={t('homeSearchPlaceholder')} className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-3 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-violet-300 dark:border-slate-700 dark:bg-[#151426] dark:text-white" />
            </div>
            <RentoraButton type="submit" size="md"><Search className="h-4 w-4" />{t('btnSearch')}</RentoraButton>
            <RentoraButton type="button" variant="secondary" size="md" onClick={() => onNavigate('list-item')}><Plus className="h-4 w-4" />{t('navPostItem')}</RentoraButton>
          </form>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{l('دسته‌بندی‌ها', 'Categories', 'الفئات', '分类')}</h2>
          <button type="button" onClick={() => onNavigate('discover')} className="min-h-11 px-2 inline-flex items-center text-xs font-semibold text-violet-600 dark:text-violet-300">{t('homeViewAll')}</button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="list">
          {categories.map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => onNavigate('discover', { category: id })} className="min-h-11 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 transition hover:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-300 dark:border-slate-700 dark:bg-[#151426] dark:text-slate-200" role="listitem">
              <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2.5">
        <RentoraCard className="p-3 text-center"><Package className="mx-auto h-4 w-4 text-violet-500" /><div className="mt-1 text-base font-black text-slate-900 dark:text-white">{activeItems.length}</div><div className="text-[10px] text-slate-500">{t('homeStatItems')}</div></RentoraCard>
        <RentoraCard className="p-3 text-center"><Users className="mx-auto h-4 w-4 text-emerald-600" /><div className="mt-1 text-base font-black text-slate-900 dark:text-white">{pioneerCount}</div><div className="text-[10px] text-slate-500">{t('homeStatPioneers')}</div></RentoraCard>
        <RentoraCard className="p-3 text-center"><CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" /><div className="mt-1 text-base font-black text-slate-900 dark:text-white">۱۰۰٪</div><div className="text-[10px] text-slate-500">{t('homeStatHandover')}</div></RentoraCard>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white p-2 text-emerald-600 dark:bg-emerald-950"><ShieldCheck className="h-5 w-5" /></div>
          <div><h2 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{t('homeTrustBadgeTitle')}</h2><p className="mt-1 text-[11px] leading-5 text-emerald-700 dark:text-emerald-400">{t('homeTrustBadgeDesc')}</p></div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900 dark:text-white">{t('homeFeaturedTitle')}</h2>
          <button type="button" onClick={() => onNavigate('discover')} className="min-h-11 px-2 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-300">{t('homeViewAll')}<ArrowLeft className="h-3.5 w-3.5" /></button>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4" role="status" aria-label={l('در حال بارگذاری آگهی‌ها', 'Loading listings', 'جارٍ تحميل الإعلانات', '正在加载物品')}>
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="space-y-2"><RentoraSkeleton className="aspect-square w-full" /><RentoraSkeleton className="h-3 w-3/4" /><RentoraSkeleton className="h-3 w-1/2" /></div>)}
          </div>
        ) : featuredItems.length === 0 ? (
          <RentoraEmptyState title={t('homeNoItemsTitle')} description={t('homeNoItemsDesc')} action={<RentoraButton size="sm" onClick={() => onNavigate('list-item')}><Plus className="h-3.5 w-3.5" />{t('homePostFirstItem')}</RentoraButton>} />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {featuredItems.map(item => <ItemCard key={item.id} item={item} onSelect={onSelectItem} onRentClick={onRentItem} />)}
          </div>
        )}
      </section>
    </div>
  );
}
