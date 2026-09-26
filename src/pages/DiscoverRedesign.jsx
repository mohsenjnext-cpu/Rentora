import React, { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X, RotateCcw, Wrench, Camera, Tent, Dumbbell, Car, PartyPopper, Home, LayoutGrid } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useRentora } from '../context/RentoraContext';
import ItemCard from '../components/ItemCard';
import RentoraButton from '../components/ui/RentoraButton';
import RentoraCard from '../components/ui/RentoraCard';
import RentoraEmptyState from '../components/ui/RentoraEmptyState';
import RentoraInput from '../components/ui/RentoraInput';
import RentoraModal from '../components/ui/RentoraModal';
import RentoraSkeleton from '../components/ui/RentoraSkeleton';

export default function DiscoverRedesign({ initialCategory = 'all', initialQuery = '', onSelectItem, onRentItem }) {
  const { t, l } = useLanguage();
  const { items = [], isInitialLoadDone } = useRentora();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [condition, setCondition] = useState('all');
  const [city, setCity] = useState('');
  const [maxPrice, setMaxPrice] = useState(100);
  const [sort, setSort] = useState('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const categories = [
    ['all', t('catAll'), LayoutGrid], ['tools', t('catTools'), Wrench], ['cameras', t('catCameras'), Camera],
    ['camping', t('catCamping'), Tent], ['sports', t('catSports'), Dumbbell], ['vehicles', t('catVehicles'), Car],
    ['events', t('catEvents'), PartyPopper], ['home', t('catHome'), Home]
  ];

  const filtered = useMemo(() => (items || []).filter(item => {
    if (!item || (item.status && item.status !== 'active')) return false;
    if (category !== 'all' && item.category !== category) return false;
    if (condition !== 'all' && item.condition !== condition) return false;
    if (item.pricePerDay && item.pricePerDay > maxPrice) return false;
    const location = String(item.location || '').toLowerCase();
    if (city.trim() && !location.includes(city.trim().toLowerCase())) return false;
    const q = query.trim().toLowerCase();
    if (q && ![item.title, item.description, item.location].some(v => String(v || '').toLowerCase().includes(q))) return false;
    return true;
  }).sort((a, b) => {
    if (sort === 'price_asc') return Number(a.pricePerDay || 0) - Number(b.pricePerDay || 0);
    if (sort === 'price_desc') return Number(b.pricePerDay || 0) - Number(a.pricePerDay || 0);
    if (sort === 'rating') return Number(b.rating || 0) - Number(a.rating || 0);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  }), [items, query, category, condition, city, maxPrice, sort]);

  const clearFilters = () => {
    setQuery(''); setCategory('all'); setCondition('all'); setCity(''); setMaxPrice(100); setSort('newest');
  };
  const filteredState = query || category !== 'all' || condition !== 'all' || city || maxPrice < 100;

  return (
    <main className="space-y-5 pb-16" dir="inherit">
      <section className="space-y-3">
        <div>
          <p className="text-xs font-bold text-[var(--color-rentora-primary)]">{l('کشف و اجاره', 'DISCOVER & RENT', 'اكتشف واستأجر', '发现并租赁')}</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white">{t('discoverTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{l('چیزی که نیاز داری را پیدا کن، بدون دردسر.', 'Find what you need without the marketplace maze.', 'اعثر على ما تحتاجه بسهولة.', '轻松找到你需要的物品。')}</p>
        </div>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <RentoraInput id="discover-redesign-search" type="search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder={t('discoverSearchPlaceholder')} leadingAdornment={<Search className="h-4 w-4" aria-hidden="true" />}
              trailingAdornment={query ? <button type="button" onClick={() => setQuery('')} className="rounded p-1" aria-label={t('discoverClearSearch')}><X className="h-4 w-4" /></button> : null} />
          </div>
          <RentoraButton type="button" variant={filteredState ? 'primary' : 'secondary'} size="sm" onClick={() => setFiltersOpen(true)}
            aria-label={t('discoverFilterBtn')}><SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">{l('فیلتر', 'Filters', 'الفلاتر', '筛选')}</span></RentoraButton>
        </div>
      </section>

      <section className="flex gap-2 overflow-x-auto pb-1" aria-label={l('دسته‌بندی‌ها', 'Categories', 'الفئات', '分类')}>
        {categories.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setCategory(id)} aria-pressed={category === id}
          className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-bold transition focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] ${category === id ? 'border-[var(--color-rentora-primary)] bg-[var(--color-rentora-primary)] text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-[#16152B] dark:text-slate-200'}`}>
          <span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}</span>
        </button>)}
      </section>

      <RentoraCard className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-bold text-slate-900 dark:text-white">{l(`${filtered.length} کالا`, `${filtered.length} items`, `${filtered.length} عناصر`, `${filtered.length} 件物品`)}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{filteredState ? l('نتایج فیلترشده', 'Filtered results', 'نتائج مفلترة', '筛选结果') : l('آگهی‌های فعال', 'Active listings', 'الإعلانات النشطة', '活跃物品')}</p></div>
          <div className="flex items-center gap-2"><label htmlFor="discover-redesign-sort" className="text-[11px] text-slate-500">{t('discoverSortBy')}</label>
            <select id="discover-redesign-sort" value={sort} onChange={e => setSort(e.target.value)} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold dark:border-slate-700 dark:bg-[#151426] dark:text-white">
              <option value="newest">{t('discoverSortNewest')}</option><option value="price_asc">{t('discoverSortPriceLow')}</option><option value="price_desc">{t('discoverSortPriceHigh')}</option><option value="rating">{t('discoverSortRating')}</option>
            </select></div>
        </div>
      </RentoraCard>

      {!isInitialLoadDone && !filtered.length ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" role="status" aria-label={l('در حال بارگذاری...', 'Loading...', 'جار التحميل...', '加载中...')}>
        {Array.from({ length: 8 }, (_, i) => <RentoraCard key={i} className="p-2 space-y-2"><RentoraSkeleton className="aspect-square w-full" rounded="rounded-[var(--radius-control)]" /><RentoraSkeleton className="h-3 w-3/4" /><RentoraSkeleton className="h-3 w-1/2" /></RentoraCard>)}
      </div> : filtered.length ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map(item => <ItemCard key={item.id} item={item} onSelect={onSelectItem} onRentClick={onRentItem} />)}
      </div> : <RentoraEmptyState icon={<Search className="h-6 w-6" />} title={t('discoverEmptyTitle')} description={t('discoverEmptyDesc')}
        action={filteredState ? <RentoraButton variant="secondary" size="sm" onClick={clearFilters}><RotateCcw className="h-3.5 w-3.5" />{t('discoverClearFilters')}</RentoraButton> : null} />}

      <RentoraModal open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t('discoverFilterBtn')} size="md"
        footer={<div className="flex justify-between gap-2"><RentoraButton variant="ghost" onClick={clearFilters}><RotateCcw className="h-3.5 w-3.5" />{t('btnReset')}</RentoraButton><RentoraButton onClick={() => setFiltersOpen(false)}>{t('btnApply')}</RentoraButton></div>}>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2">{categories.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setCategory(id)} aria-pressed={category === id}
            className={`min-h-11 rounded-xl border px-3 text-xs font-bold flex items-center gap-2 ${category === id ? 'bg-[var(--color-rentora-primary)] text-white border-transparent' : 'border-slate-200 dark:border-slate-700 dark:text-slate-200'}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
          <div><div className="flex justify-between text-xs font-bold mb-2"><span>{t('discoverFilterMaxPrice')}</span><span>{maxPrice} π</span></div><input className="w-full" type="range" min="1" max="100" value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} aria-label={t('discoverFilterMaxPrice')} /></div>
          <label className="block text-xs font-bold">{t('itemCondition')}<select value={condition} onChange={e => setCondition(e.target.value)} className="mt-2 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-[#151426] dark:text-white"><option value="all">{t('catAll')}</option><option value="like_new">{t('condLikeNew')}</option><option value="good">{t('condGood')}</option><option value="fair">{t('condFair')}</option></select></label>
          <RentoraInput id="discover-redesign-city" label={t('discoverFilterLocation')} value={city} onChange={e => setCity(e.target.value)} placeholder={l('مثال: تهران', 'e.g. Montreal', 'مثال: دبي', '例如：北京')} />
        </div>
      </RentoraModal>
    </main>
  );
}
