import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRentora } from '../context/RentoraContext';
import { usePiAuth } from '../context/PiAuthContext';
import CategoryBar from '../components/CategoryBar';
import ItemCard from '../components/ItemCard';
import EmptyState from '../components/EmptyState';
import { Search, ShieldCheck, Package, Users, Plus, CheckCircle2 } from 'lucide-react';

export default function HomePage({ onNavigate, onSelectItem, onRentItem }) {
  const { t, l } = useLanguage();
  const { items = [] } = useRentora();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onNavigate('discover', searchQuery.trim() ? { query: searchQuery.trim() } : {});
  };

  const activeItems = (items || []).filter(i => !i.status || i.status === 'active');
  const latestItems = activeItems.slice(0, 10);
  const { users = [], currentUser } = usePiAuth();
  const totalPioneersCount = Math.max(users.length, currentUser ? 1 : 0);



  return (
    <div className="select-none">
      <div className="md:hidden space-y-4 pb-3">
        <section className="banner-purple rounded-[20px] p-4 min-h-[205px] flex flex-col items-end text-right">
          <h1 className="text-[25px] leading-[1.45] font-bold text-[#26215C] dark:text-white max-w-[318px]">{t('homeHeroTitle')}</h1>
          <p className="mt-1 text-[12px] leading-[1.7] font-semibold text-[#534AB7] dark:text-[#AFA9EC] max-w-[318px]">{t('homeHeroSubtitle')}</p>
          <button type="button" onClick={() => onNavigate('list-item')} className="btn-primary mt-3 h-10 px-5 text-[11px] font-bold inline-flex items-center gap-1.5 self-start"><Plus className="w-3.5 h-3.5" /><span>{t('navPostItem')}</span></button>
          <form onSubmit={handleSearchSubmit} className="mt-2.5 w-full h-11 bg-white dark:bg-[#151426] border border-[#DCDCE8] dark:border-slate-700 rounded-xl flex items-center gap-1 p-1">
            <button type="submit" className="h-9 w-12 rounded-[10px] bg-[#534AB7] text-white text-[10px] font-bold shrink-0">{t('btnSearch')}</button>
            <div className="relative flex-1 h-full"><Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" /><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('homeSearchPlaceholder')} className="w-full h-full bg-transparent border-0 outline-none pr-8 pl-2 text-[11px] text-slate-800 dark:text-white placeholder:text-[#8A8A9B] text-right" /></div>
          </form>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-[#1E1E2F] dark:text-white text-right mb-2">{l('دسته‌بندی‌ها', 'Categories', 'الفئات', '分类')}</h2>
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1" dir="ltr">
            {[['all', l('همه', 'All', 'الكل', '全部')], ['tools', l('ابزار', 'Tools', 'أدوات', '工具')], ['cameras', l('الکترونیک', 'Cameras', 'كاميرات', '数码')], ['sports', l('ورزشی', 'Sports', 'رياضة', '运动')], ['vehicles', l('خودرو', 'Vehicles', 'مركبات', '车辆')]].map(([id, label]) => (
              <button key={id} type="button" onClick={() => onNavigate('discover', { category: id })} className={`h-[34px] px-4 rounded-full text-[10px] font-semibold whitespace-nowrap ${id === 'all' ? 'bg-[#26215C] text-white' : 'bg-white dark:bg-[#151426] border border-[#E1E1EA] dark:border-slate-700 text-[#55556A] dark:text-slate-300'}`}>{label}</button>
            ))}
          </div>
        </section>

        <section className="h-[58px] rounded-[14px] bg-[#E1F5EE] dark:bg-[#0B382C] border border-[#B8E4D5] dark:border-[#1C6B55] px-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-white dark:bg-[#123F35] text-[#0F6E56] flex items-center justify-center shrink-0"><ShieldCheck className="w-[17px] h-[17px]" /></div>
          <div className="text-right flex-1"><h4 className="text-[12px] font-bold text-[#0F6E56] dark:text-[#48D2A8]">{t('homeTrustBadgeTitle')}</h4><p className="text-[10px] text-[#2B7A65] dark:text-slate-300">{t('homeTrustBadgeDesc')}</p></div>
        </section>

        <section className="grid grid-cols-3 gap-2.5">
          <div className="h-[68px] rounded-[14px] bg-white dark:bg-[#151426] border border-[#E5E5EC] dark:border-slate-800 text-center pt-2"><div className="text-[17px] font-bold text-[#534AB7]">{activeItems.length}</div><div className="text-[10px] text-[#8A8A9B] mt-1">{t('homeStatItems')}</div></div>
          <div className="h-[68px] rounded-[14px] bg-white dark:bg-[#151426] border border-[#E5E5EC] dark:border-slate-800 text-center pt-2"><div className="text-[17px] font-bold text-[#0F6E56]">{totalPioneersCount}</div><div className="text-[10px] text-[#8A8A9B] mt-1">{t('homeStatPioneers')}</div></div>
          <div className="h-[68px] rounded-[14px] bg-white dark:bg-[#151426] border border-[#E5E5EC] dark:border-slate-800 text-center pt-2"><div className="text-[17px] font-bold text-[#0F6E56]">۱۰۰٪</div><div className="text-[10px] text-[#8A8A9B] mt-1">{t('homeStatHandover')}</div></div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2"><button type="button" onClick={() => onNavigate('discover')} className="text-[11px] font-semibold text-[#534AB7] dark:text-[#AFA9EC]">{t('homeViewAll')} ›</button><h2 className="text-[16px] font-bold text-[#1E1E2F] dark:text-white">{t('homeFeaturedTitle')}</h2></div>
          {latestItems.length === 0 ? <EmptyState type="package" title={t('homeNoItemsTitle')} message={t('homeNoItemsDesc')} actionLabel={t('homePostFirstItem')} onAction={() => onNavigate('list-item')} /> : <div className="grid grid-cols-2 gap-2.5">{latestItems.slice(0, 4).map((item) => <ItemCard key={item.id} item={item} variant="compact" onSelect={onSelectItem} onRentClick={onRentItem} />)}</div>}
        </section>
      </div>

      <div className="hidden md:block space-y-5 sm:space-y-6 pb-12">
        <section className="banner-purple p-5 sm:p-7"><div className="max-w-2xl space-y-3"><div className="space-y-1"><h1 className="text-xl sm:text-3xl font-bold text-[#26215C] dark:text-white leading-tight">{t('homeHeroTitle')}</h1><p className="text-xs sm:text-sm text-[#534AB7] dark:text-[#AFA9EC] font-semibold">{t('homeHeroSubtitle')}</p></div><div><button type="button" onClick={() => onNavigate('list-item')} className="btn-primary px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"><Plus className="w-3.5 h-3.5 stroke-[2.5]" /><span>{t('navPostItem')}</span></button></div><form onSubmit={handleSearchSubmit} className="pt-1 flex items-center gap-2"><div className="relative flex-1"><Search className="w-4 h-4 text-slate-400 absolute top-2.5 left-3 rtl:left-auto rtl:right-3 stroke-[2]" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('homeSearchPlaceholder')} className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-2 text-xs rounded-lg bg-white dark:bg-[#151426] text-slate-900 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-[#534AB7]" /></div><button type="submit" className="btn-primary px-3.5 py-2 text-xs font-bold shrink-0 cursor-pointer"><span>{t('btnSearch')}</span></button></form></div></section>
        <section className="space-y-2"><CategoryBar selectedCategory="all" onSelectCategory={(catId) => onNavigate('discover', { category: catId })} /></section>
        <section className="p-3 sm:p-3.5 rounded-xl badge-trust flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><div className="p-1.5 rounded-lg bg-white/90 dark:bg-[#0B382C] text-[#0F6E56] dark:text-[#48D2A8] shrink-0"><ShieldCheck className="w-4 h-4 stroke-[2.2]" /></div><div><h4 className="font-bold text-xs text-[#0F6E56] dark:text-[#48D2A8]">{t('homeTrustBadgeTitle')}</h4><p className="text-[11px] text-[#0F6E56]/80 dark:text-slate-300">{t('homeTrustBadgeDesc')}</p></div></div></section>
        <section className="grid grid-cols-3 gap-2.5 sm:gap-3"><div className="p-3 rounded-xl rentora-card text-center space-y-0.5"><Package className="w-4 h-4 mx-auto text-[#534AB7] stroke-[1.8]" /><div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-mono">{activeItems.length}</div><div className="text-[10px] text-slate-400 font-medium">{t('homeStatItems')}</div></div><div className="p-3 rounded-xl rentora-card text-center space-y-0.5"><Users className="w-4 h-4 mx-auto text-[#0F6E56] stroke-[1.8]" /><div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-mono">{totalPioneersCount}</div><div className="text-[10px] text-slate-400 font-medium">{t('homeStatPioneers')}</div></div><div className="p-3 rounded-xl rentora-card text-center space-y-0.5"><CheckCircle2 className="w-4 h-4 mx-auto text-[#0F6E56] stroke-[1.8]" /><div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-mono">۱۰۰٪</div><div className="text-[10px] text-slate-400 font-medium">{t('homeStatHandover')}</div></div></section>
        <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">{t('homeFeaturedTitle')}</h2><button type="button" onClick={() => onNavigate('discover')} className="text-xs font-semibold text-[#534AB7] dark:text-[#AFA9EC] hover:underline cursor-pointer">{t('homeViewAll')}</button></div>{latestItems.length === 0 ? <EmptyState type="package" title={t('homeNoItemsTitle')} message={t('homeNoItemsDesc')} actionLabel={t('homePostFirstItem')} onAction={() => onNavigate('list-item')} /> : <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">{latestItems.map((item) => <ItemCard key={item.id} item={item} onSelect={onSelectItem} onRentClick={onRentItem} />)}</div>}</section>
      </div>
    </div>
  );
}
