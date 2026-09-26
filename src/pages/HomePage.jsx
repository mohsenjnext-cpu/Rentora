import React, { useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRentora } from '../context/RentoraContext';
import { usePiAuth } from '../context/PiAuthContext';
import CategoryBar from '../components/CategoryBar';
import ItemCard from '../components/ItemCard';
import EmptyState from '../components/EmptyState';
import { Search, ShieldCheck, Package, Users, Plus, CheckCircle2, Heart, MapPin, Coins, X, ArrowUpLeft, UserRound } from 'lucide-react';

export default function HomePage({ onNavigate, onSelectItem, onRentItem }) {
  const { t, l } = useLanguage();
  const { items = [], favorites = [], toggleFavorite } = useRentora();
  const { users = [], currentUser } = usePiAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const activeItems = useMemo(
    () => (items || []).filter(i => !i.status || i.status === 'active'),
    [items]
  );
  const featuredItems = activeItems.slice(0, 8);
  const totalPioneersCount = Math.max(users.length, currentUser ? 1 : 0);

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const candidates = activeItems
      .map(item => item.title)
      .filter(Boolean)
      .filter((title, index, list) => list.indexOf(title) === index);
    return (q ? candidates.filter(title => title.toLowerCase().includes(q)) : candidates).slice(0, 5);
  }, [activeItems, searchQuery]);

  const submitSearch = (value = searchQuery) => {
    const query = String(value || '').trim();
    onNavigate('discover', query ? { query } : {});
    setSearchFocused(false);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    submitSearch();
  };

  const searchBox = (mobile = false) => (
    <div className="relative w-full">
      <form
        onSubmit={handleSearchSubmit}
        className={`relative z-20 flex items-center gap-1.5 w-full bg-white dark:bg-[#151426] border border-slate-200 dark:border-slate-700 rounded-2xl p-1.5 shadow-sm transition focus-within:border-[#7F77DD] focus-within:ring-2 focus-within:ring-[#EEEDFE] dark:focus-within:ring-[#292550] ${mobile ? 'h-12' : 'h-14'}`}
      >
        <button type="submit" className="btn-primary h-full px-4 rounded-xl text-[11px] sm:text-xs font-bold shrink-0">
          {t('btnSearch')}
        </button>
        <div className="relative flex-1 h-full">
          <Search className="absolute end-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder={t('homeSearchPlaceholder')}
            aria-label={t('homeSearchPlaceholder')}
            className="w-full h-full bg-transparent border-0 outline-none pe-9 ps-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 text-end"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label={l('پاک کردن جستجو', 'Clear search', 'مسح البحث', '清除搜索')}
              onClick={() => setSearchQuery('')}
              className="absolute start-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </form>

      {searchFocused && (
        <div className="absolute z-30 top-full inset-x-0 mt-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] shadow-xl overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-semibold text-slate-400 text-end">
            {searchQuery.trim()
              ? l('نتایج پیشنهادی', 'Suggestions', 'اقتراحات', '搜索建议')
              : l('جستجو در آگهی‌ها', 'Search listings', 'البحث في الإعلانات', '搜索物品')}
          </div>
          {suggestions.length ? suggestions.map((title) => (
            <button
              key={title}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setSearchQuery(title); submitSearch(title); }}
              className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/5 text-end"
            >
              <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="flex-1 text-xs text-slate-700 dark:text-slate-200 truncate">{title}</span>
              <Search className="w-3.5 h-3.5 text-[var(--primary-mid)] shrink-0" />
            </button>
          )) : (
            <button
              type="button"
              onClick={() => submitSearch()}
              className="w-full px-3 py-3 text-xs text-[var(--primary-mid)] hover:bg-slate-50 dark:hover:bg-white/5 text-end"
            >
              {l('مشاهده همه آگهی‌ها', 'Browse all listings', 'تصفح كل الإعلانات', '浏览全部物品')}
            </button>
          )}
        </div>
      )}
    </div>
  );

  const MobileItemCard = ({ item }) => {
    const isFav = favorites.includes(item.id);
    const myName = (currentUser?.username || '').toLowerCase().replace('@', '').trim();
    const ownerName = (item.ownerUsername || item.owner_username || '').toLowerCase().replace('@', '').trim();
    const isOwner = Boolean(myName && ownerName && myName === ownerName);
    const imageUrl = item.images?.[0] || item.imageUrl || item.image_url;

    return (
      <article
        onClick={() => onSelectItem?.(item)}
        className="bg-white dark:bg-[#151426] border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 overflow-hidden cursor-pointer shadow-sm active:scale-[.99] transition"
      >
        <div className="relative h-32 rounded-xl overflow-hidden bg-[#EEEDFE] dark:bg-[#211E45]">
          {imageUrl ? (
            <img src={imageUrl} alt={item.title || ''} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--primary-mid)]">
              <Package className="w-8 h-8 stroke-[1.5]" />
            </div>
          )}
          {item.ownerKYC && (
            <span className="absolute top-2 start-2 rounded-lg px-1.5 py-1 text-[9px] font-bold badge-trust flex items-center gap-1 shadow-sm">
              <ShieldCheck className="w-2.5 h-2.5" />
              KYC
            </span>
          )}
          <button
            type="button"
            aria-label={t('btnFavorite')}
            onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
            className="absolute top-2 end-2 w-8 h-8 rounded-full bg-[#26215C]/70 text-white backdrop-blur-sm flex items-center justify-center"
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>
        <div className="px-1.5 pt-2 pb-1">
          <div className="text-[9px] text-slate-400 flex items-center justify-end gap-1 truncate">
            <span>{item.location || l('مکان ثبت نشده', 'Location not set', 'الموقع غير محدد', '未设置位置')}</span>
            <MapPin className="w-2.5 h-2.5 shrink-0" />
          </div>
          <h3 className="mt-1 text-[12px] font-bold text-slate-900 dark:text-white text-end truncate">{item.title}</h3>
          <div className="mt-2 flex items-center justify-between gap-1">
            {isOwner ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); onSelectItem?.(item); }} className="btn-primary rounded-lg px-3 py-1.5 text-[10px] font-bold">
                {l('مدیریت', 'Manage', 'إدارة', '管理')}
              </button>
            ) : (
              <button type="button" onClick={(e) => { e.stopPropagation(); onRentItem?.(item); }} className="btn-primary rounded-lg px-3 py-1.5 text-[10px] font-bold flex items-center gap-1">
                <Coins className="w-3 h-3 text-amber-300" />{t('itemBookBtn')}
              </button>
            )}
            <span className="text-[12px] font-black text-[var(--trust-text)] whitespace-nowrap">
              {item.pricePerDay} π <span className="font-normal text-[10px] text-slate-400">/{l('روز', 'day', 'يوم', '天')}</span>
            </span>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="select-none" onClick={() => searchFocused && setSearchFocused(false)}>
      <div className="md:hidden space-y-5 pb-4" onClick={(e) => e.stopPropagation()}>
        <section className="banner-purple rounded-[24px] p-5 min-h-[244px] flex flex-col items-end text-end">
          <div className="flex items-center gap-2 mb-2">
            {currentUser ? <span className="text-[10px] font-semibold text-[var(--primary-mid)]">@{currentUser.username}</span> : <span className="text-[10px] text-slate-500">{l('مهمان', 'Guest', 'زائر', '访客')}</span>}
            <span className="w-2 h-2 rounded-full bg-[var(--trust-text)]" />
          </div>
          <h1 className="text-[26px] leading-[1.4] font-black text-[#26215C] dark:text-white max-w-[320px]">{t('homeHeroTitle')}</h1>
          <p className="mt-1 text-[12px] leading-[1.75] font-semibold text-[#534AB7] dark:text-[#AFA9EC] max-w-[320px]">{t('homeHeroSubtitle')}</p>
          <button type="button" onClick={() => onNavigate('list-item')} className="btn-primary mt-3 h-10 px-5 text-[11px] font-bold inline-flex items-center gap-1.5 self-start">
            <Plus className="w-3.5 h-3.5" /><span>{t('navPostItem')}</span>
          </button>
          <div className="mt-3 w-full">{searchBox(true)}</div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => onNavigate('discover')} className="text-[10px] font-semibold text-[var(--primary-mid)]">{t('homeViewAll')} ›</button>
            <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">{l('کشف سریع', 'Quick discovery', 'اكتشاف سريع', '快速发现')}</h2>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1" dir="ltr">
            {[
              ['all', l('همه', 'All', 'الكل', '全部')],
              ['tools', l('ابزار', 'Tools', 'أدوات', '工具')],
              ['cameras', l('دوربین', 'Cameras', 'كاميرات', '相机')],
              ['sports', l('ورزشی', 'Sports', 'رياضة', '运动')],
              ['vehicles', l('خودرو', 'Vehicles', 'مركبات', '车辆')]
            ].map(([id, label], index) => (
              <button key={id} type="button" onClick={() => onNavigate('discover', { category: id })} className={`h-9 px-4 rounded-full text-[10px] font-semibold whitespace-nowrap ${index === 0 ? 'bg-[#26215C] text-white' : 'bg-white dark:bg-[#151426] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-[var(--trust-bg)] border border-emerald-200/60 dark:border-emerald-900/60 p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/90 dark:bg-[#123F35] text-[var(--trust-text)] flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5" /></div>
          <div className="text-end flex-1">
            <h4 className="text-[12px] font-bold text-[var(--trust-text)]">{t('homeTrustBadgeTitle')}</h4>
            <p className="text-[10px] text-[var(--trust-text)]/80 dark:text-slate-300">{t('homeTrustBadgeDesc')}</p>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2.5">
          <div className="h-[76px] rounded-2xl bg-white dark:bg-[#151426] border border-slate-200 dark:border-slate-800 text-center pt-2.5 shadow-sm"><div className="text-[18px] font-black text-[var(--primary-mid)]">{activeItems.length}</div><div className="text-[9px] text-slate-400 mt-1">{t('homeStatItems')}</div></div>
          <div className="h-[76px] rounded-2xl bg-white dark:bg-[#151426] border border-slate-200 dark:border-slate-800 text-center pt-2.5 shadow-sm"><div className="text-[18px] font-black text-[var(--trust-text)]">{totalPioneersCount}</div><div className="text-[9px] text-slate-400 mt-1">{t('homeStatPioneers')}</div></div>
          <div className="h-[76px] rounded-2xl bg-white dark:bg-[#151426] border border-slate-200 dark:border-slate-800 text-center pt-2.5 shadow-sm"><div className="text-[18px] font-black text-[var(--trust-text)]">۱۰۰٪</div><div className="text-[9px] text-slate-400 mt-1">{t('homeStatHandover')}</div></div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2.5">
            <button type="button" onClick={() => onNavigate('discover')} className="px-2.5 py-1.5 rounded-full bg-[var(--purple-tint)] text-[10px] font-semibold text-[var(--primary-mid)]">{t('homeViewAll')} ›</button>
            <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">{t('homeFeaturedTitle')}</h2>
          </div>
          {featuredItems.length === 0 ? (
            <EmptyState type="package" title={t('homeNoItemsTitle')} message={t('homeNoItemsDesc')} actionLabel={t('homePostFirstItem')} onAction={() => onNavigate('list-item')} />
          ) : (
            <div className="grid grid-cols-2 gap-2.5">{featuredItems.slice(0, 4).map(item => <MobileItemCard key={item.id} item={item} />)}</div>
          )}
        </section>
      </div>

      <div className="hidden md:block space-y-6 pb-12">
        <section className="banner-purple p-7 sm:p-8">
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] font-semibold text-[var(--primary-mid)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--trust-text)]" />
                  {currentUser ? `@${currentUser.username}` : l('ورود به‌عنوان مهمان', 'Browsing as guest', 'التصفح كزائر', '以访客身份浏览')}
                </div>
                <h1 className="text-2xl sm:text-4xl font-black text-[#26215C] dark:text-white leading-tight">{t('homeHeroTitle')}</h1>
                <p className="text-sm text-[#534AB7] dark:text-[#AFA9EC] font-semibold max-w-2xl">{t('homeHeroSubtitle')}</p>
              </div>
              <div className="hidden lg:flex w-14 h-14 rounded-2xl bg-white/70 dark:bg-[#211E45] items-center justify-center text-[var(--primary-mid)] shrink-0">
                <UserRound className="w-7 h-7" />
              </div>
            </div>
            <button type="button" onClick={() => onNavigate('list-item')} className="btn-primary px-4 py-2.5 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm">
              <Plus className="w-4 h-4" /><span>{t('navPostItem')}</span>
            </button>
            {searchBox(false)}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{l('کشف سریع', 'Quick discovery', 'اكتشاف سريع', '快速发现')}</h2>
            <span className="text-[10px] text-slate-400">{l('جستجو و فیلتر در Discover', 'More filters in Discover', 'المزيد من المرشحات في البحث', '更多筛选在发现页')}</span>
          </div>
          <CategoryBar selectedCategory="all" onSelectCategory={(catId) => onNavigate('discover', { category: catId })} />
        </section>

        <section className="p-4 rounded-2xl badge-trust flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/90 dark:bg-[#0B382C] text-[var(--trust-text)] shrink-0"><ShieldCheck className="w-5 h-5" /></div>
            <div>
              <h4 className="font-bold text-xs text-[var(--trust-text)]">{t('homeTrustBadgeTitle')}</h4>
              <p className="text-[11px] text-[var(--trust-text)]/80 dark:text-slate-300">{t('homeTrustBadgeDesc')}</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl rentora-card text-center space-y-1"><Package className="w-5 h-5 mx-auto text-[var(--primary-mid)]" /><div className="text-lg font-black text-slate-900 dark:text-white">{activeItems.length}</div><div className="text-[10px] text-slate-400">{t('homeStatItems')}</div></div>
          <div className="p-4 rounded-2xl rentora-card text-center space-y-1"><Users className="w-5 h-5 mx-auto text-[var(--trust-text)]" /><div className="text-lg font-black text-slate-900 dark:text-white">{totalPioneersCount}</div><div className="text-[10px] text-slate-400">{t('homeStatPioneers')}</div></div>
          <div className="p-4 rounded-2xl rentora-card text-center space-y-1"><CheckCircle2 className="w-5 h-5 mx-auto text-[var(--trust-text)]" /><div className="text-lg font-black text-slate-900 dark:text-white">۱۰۰٪</div><div className="text-[10px] text-slate-400">{t('homeStatHandover')}</div></div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => onNavigate('discover')} className="text-xs font-semibold text-[var(--primary-mid)] hover:underline cursor-pointer">{t('homeViewAll')}</button>
            <div className="text-end">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{t('homeFeaturedTitle')}</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">{l('آگهی‌های فعال', 'Active listings', 'الإعلانات النشطة', '活跃物品')}</p>
            </div>
          </div>
          {featuredItems.length === 0 ? (
            <EmptyState type="package" title={t('homeNoItemsTitle')} message={t('homeNoItemsDesc')} actionLabel={t('homePostFirstItem')} onAction={() => onNavigate('list-item')} />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              {featuredItems.map(item => <ItemCard key={item.id} item={item} onSelect={onSelectItem} onRentClick={onRentItem} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
