import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRentora } from '../context/RentoraContext';
import ItemCard from '../components/ItemCard';
import EmptyState from '../components/EmptyState';
import { 
  Search, 
  SlidersHorizontal, 
  X, 
  RotateCcw,
  Wrench,
  Camera,
  Tent,
  Dumbbell,
  Car,
  PartyPopper,
  Home,
  LayoutGrid,
  Check
} from 'lucide-react';

export default function DiscoverPage({ initialCategory = 'all', initialQuery = '', onSelectItem, onRentItem }) {
  const { lang, dir, t, l } = useLanguage();
  const { items = [] } = useRentora();

  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedCondition, setSelectedCondition] = useState('all');
  const [selectedCity, setSelectedCity] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const filterCategories = [
    { id: 'all', label: t('catAll'), icon: LayoutGrid },
    { id: 'tools', label: t('catTools'), icon: Wrench },
    { id: 'cameras', label: t('catCameras'), icon: Camera },
    { id: 'camping', label: t('catCamping'), icon: Tent },
    { id: 'sports', label: t('catSports'), icon: Dumbbell },
    { id: 'vehicles', label: t('catVehicles'), icon: Car },
    { id: 'events', label: t('catEvents'), icon: PartyPopper },
    { id: 'home', label: t('catHome'), icon: Home }
  ];

  // Filter & sort
  const filteredItems = useMemo(() => {
    return (items || []).filter((item) => {
      if (!item) return false;
      if (item.status && item.status !== 'active') return false;
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedCondition !== 'all' && item.condition !== selectedCondition) return false;
      const price = Number(item.pricePerDay || 0);
      if (minPrice !== '' && price < Number(minPrice)) return false;
      if (maxPrice !== '' && price > Number(maxPrice)) return false;
      
      const loc = (item.location || '').toLowerCase();
      if (selectedCity && !loc.includes(selectedCity.toLowerCase().trim())) return false;
      
      if (query.trim() !== '') {
        const q = query.toLowerCase().trim();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        const matchLoc = loc.includes(q);
        if (!matchTitle && !matchDesc && !matchLoc) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'price_asc') return (a.pricePerDay || 0) - (b.pricePerDay || 0);
      if (sortBy === 'price_desc') return (b.pricePerDay || 0) - (a.pricePerDay || 0);
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); // newest
    });
  }, [items, query, selectedCategory, selectedCondition, selectedCity, minPrice, maxPrice, sortBy]);

  const clearFilters = () => {
    setQuery('');
    setSelectedCategory('all');
    setSelectedCondition('all');
    setSelectedCity('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
  };

  const isFiltered = query !== '' || selectedCategory !== 'all' || selectedCondition !== 'all' || selectedCity !== '' || minPrice !== '' || maxPrice !== '';

  const appliedFilters = [
    selectedCategory !== 'all' ? filterCategories.find((cat) => cat.id === selectedCategory)?.label : null,
    selectedCondition !== 'all' ? l('وضعیت', 'Condition', 'الحالة', '状态') + ': ' + selectedCondition : null,
    selectedCity ? selectedCity : null,
    minPrice !== '' ? l('حداقل', 'Min', 'الحد الأدنى', '最低') + ` ${minPrice} π` : null,
    maxPrice !== '' ? l('حداکثر', 'Max', 'الحد الأقصى', '最高') + ` ${maxPrice} π` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4 pb-16 select-none">
      
      {/* 1. Page title + Live Search Bar with inline filter icon */}
      <div className="space-y-2">
        <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
          {t('discoverTitle')}
        </h1>

        <div className="flex items-center gap-2 w-full">
          {/* Live Search Bar with inline filter icon */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute top-2.5 left-3 rtl:left-auto rtl:right-3 stroke-[2]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('discoverSearchPlaceholder')}
              className="w-full pl-9 pr-9 rtl:pr-9 rtl:pl-9 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute top-2 right-2.5 rtl:right-auto rtl:left-2.5 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Inline Filter Button (Opens filter sheet) */}
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              isFiltered
                ? 'bg-[#26215C] text-white border-[#26215C] dark:bg-[#534AB7]'
                : 'rentora-card text-slate-700 dark:text-slate-200 hover:border-[#534AB7]'
            }`}
            title={t('discoverFilterBtn')}
          >
            <SlidersHorizontal className="w-4 h-4 stroke-[1.8]" />
            <span className="hidden sm:inline">{l('فیلترها', 'Filters', 'الفلاتر', '筛选')}</span>
          </button>
        </div>
      </div>

      {/* Applied filter overview: always visible once the result set is scoped. */}
      {isFiltered && appliedFilters.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5" aria-label={l('فیلترهای فعال', 'Applied filters', 'الفلاتر المطبقة', '已应用筛选')}>
          {appliedFilters.map((label, index) => (
            <span key={label + index} className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#EEEDFE] dark:bg-[#1E1B3D] text-[#26215C] dark:text-[#EEEDFE] px-2.5 py-1 text-[10px] font-semibold">
              <Check className="w-3 h-3" />{label}
            </span>
          ))}
          <button type="button" onClick={clearFilters} className="shrink-0 text-[10px] font-bold text-[#534AB7] dark:text-[#AFA9EC] px-1.5 py-1">{t('btnReset')}</button>
        </div>
      )}

      {/* 2. Row showing Result Count + Sort Control */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 py-1 border-b border-slate-150 dark:border-slate-800">
        <span className="text-[11px] font-medium">
          {l(`${filteredItems.length} کالا یافت شد`, `${filteredItems.length} items found`, `تم العثور على ${filteredItems.length} أغراض`, `共找到 ${filteredItems.length} 件物品`)}
        </span>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">{t('discoverSortBy')}:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151426] text-slate-900 dark:text-white font-semibold text-xs cursor-pointer focus:outline-none"
          >
            <option value="newest">{t('discoverSortNewest')}</option>
            <option value="price_asc">{t('discoverSortPriceLow')}</option>
            <option value="price_desc">{t('discoverSortPriceHigh')}</option>
            <option value="rating">{t('discoverSortRating')}</option>
          </select>
        </div>
      </div>

      {/* 3. Items Grid / Consistent Empty State */}
      {filteredItems.length === 0 ? (
        <EmptyState
          type="search"
          title={t('discoverEmptyTitle')}
          message={t('discoverEmptyDesc')}
          actionLabel={isFiltered ? t('discoverClearFilters') : undefined}
          onAction={isFiltered ? clearFilters : undefined}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {filteredItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onSelect={onSelectItem}
              onRentClick={onRentItem}
            />
          ))}
        </div>
      )}

      {/* 4. Filter Sheet Modal */}
      {filterSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-[#151426] border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-xl p-4 sm:p-5 space-y-4 max-h-[88vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {t('discoverFilterBtn')}
              </span>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category Filter Inside Sheet (with icons) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('discoverFilterCategory')}:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {filterCategories.map(cat => {
                  const Icon = cat.icon;
                  const isSel = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                        isSel
                          ? 'bg-[#26215C] text-white dark:bg-[#534AB7]'
                          : 'bg-slate-50 dark:bg-[#1E1D33] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 stroke-[1.8]" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price range: explicit values avoid an arbitrary hard-coded ceiling. */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {l('بازه قیمت روزانه', 'Daily price range', 'نطاق السعر اليومي', '每日价格范围')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder={l('از π', 'Min π', 'من π', '最低 π')}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1E1D33] text-slate-900 dark:text-white text-xs"
                />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder={l('تا π', 'Max π', 'إلى π', '最高 π')}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1E1D33] text-slate-900 dark:text-white text-xs"
                />
              </div>
            </div>

            {/* Condition Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('itemCondition')}:</label>
              <select
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1E1D33] text-slate-900 dark:text-white text-xs"
              >
                <option value="all">{t('catAll')}</option>
                <option value="like_new">{t('condLikeNew')}</option>
                <option value="good">{t('condGood')}</option>
                <option value="fair">{t('condFair')}</option>
              </select>
            </div>

            {/* City */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('discoverFilterLocation')}:</label>
              <input
                type="text"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                placeholder={l('مثال: تهران، مشهد...', 'e.g. Tehran, Saadat Abad', 'مثال: الرياض، دبي...', '例如：北京市朝阳区')}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1E1D33] text-slate-900 dark:text-white text-xs"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-[#534AB7] dark:text-[#AFA9EC] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 stroke-[2]" />
                <span>{t('btnReset')}</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="btn-primary px-4 py-1.5 text-xs font-bold cursor-pointer"
              >
                {t('btnApply')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
