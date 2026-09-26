import React, { useMemo, useState } from 'react';
import { Briefcase, Plus, Package, Clock3, CheckCircle2, TrendingUp, Edit3, ToggleLeft, ToggleRight, ChevronRight, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import RentoraButton from '../components/ui/RentoraButton';
import RentoraCard from '../components/ui/RentoraCard';
import RentoraEmptyState from '../components/ui/RentoraEmptyState';

export default function OwnerHubRedesign({ onNavigate, onSelectItem, onEditItem }) {
  const { t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen } = usePiAuth();
  const { items = [], rentals = [], toggleItemStatus, confirmReturnOneTap } = useRentora();
  const [filter, setFilter] = useState('all');
  const [processingId, setProcessingId] = useState(null);

  const myItems = useMemo(() => {
    if (!currentUser) return [];
    const uid = currentUser.uid || currentUser.id;
    const username = String(currentUser.username || '').replace('@', '').toLowerCase();
    return items.filter(item => (uid && item.ownerUid === uid) || (username && String(item.ownerUsername || '').replace('@', '').toLowerCase() === username));
  }, [items, currentUser]);

  const filteredItems = useMemo(() => myItems.filter(item => {
    if (filter === 'active') return !item.status || item.status === 'active';
    if (filter === 'paused') return item.status === 'paused' || item.status === 'inactive';
    return true;
  }), [myItems, filter]);

  const myRentals = useMemo(() => {
    const username = String(currentUser?.username || '').replace('@', '').toLowerCase();
    const uid = currentUser?.uid || currentUser?.id;
    return rentals.filter(r => (uid && (r.ownerUid === uid || r.owner_pi_uid === uid)) || (username && String(r.ownerUsername || '').replace('@', '').toLowerCase() === username));
  }, [rentals, currentUser]);

  const activeCount = myRentals.filter(r => r.status === 'active').length;
  const completed = myRentals.filter(r => r.status === 'completed');
  const earnings = completed.reduce((sum, r) => sum + Number(r.rentalTotal || r.baseAmount || 0), 0);
  const handovers = myRentals.filter(r => r.status === 'confirmed' || r.status === 'active');

  if (!isAuthenticated) {
    return (
      <RentoraCard className="max-w-md mx-auto p-8 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#26215C] dark:text-[#EEEDFE] flex items-center justify-center">
          <Briefcase className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">{t('ownerHubTitle')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('ownerHubSubtitle')}</p>
        <RentoraButton onClick={() => setAuthModalOpen(true)}>{t('navLogin')}</RentoraButton>
      </RentoraCard>
    );
  }

  const handleReturn = async (id) => {
    setProcessingId(id);
    try { await confirmReturnOneTap(id); } catch (_) {} finally { setProcessingId(null); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-16 animate-fadeIn">
      <section className="relative overflow-hidden rounded-3xl bg-[#26215C] text-white p-5 sm:p-7 shadow-sm">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#EEEDFE] text-xs font-bold mb-2"><Briefcase className="w-4 h-4" />{t('ownerHubTitle')}</div>
            <h1 className="text-2xl sm:text-3xl font-black">{t('ownerHubSubtitle')}</h1>
            <p className="text-xs sm:text-sm text-[#DAD7FA] mt-2">{l('داشبورد مالک برای مدیریت آگهی‌ها و اجاره‌ها', 'Your owner workspace for listings and rentals', 'مساحة المالك لإدارة الإعلانات والإيجارات', '管理您的物品与租赁')}</p>
          </div>
          <RentoraButton onClick={() => onNavigate('list-item')} className="!bg-white !text-[#26215C] shrink-0">
            <Plus className="w-4 h-4" />{t('ownerBtnAddGear')}
          </RentoraButton>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          [t('ownerStatsListings'), myItems.length, Package],
          [t('ownerStatsActiveRentals'), activeCount, Clock3],
          [t('ownerStatsCompletedRentals'), completed.length, CheckCircle2],
          [t('ownerStatsRevenue'), earnings.toFixed(2) + ' π', TrendingUp]
        ].map(([label, value, Icon]) => (
          <RentoraCard key={label} className="p-4">
            <Icon className="w-4 h-4 text-[#534AB7] mb-3" />
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
            <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">{value}</div>
          </RentoraCard>
        ))}
      </section>

      {handovers.length > 0 && (
        <RentoraCard className="p-4 sm:p-5 border-amber-200 dark:border-amber-900/60">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <h2 className="font-black text-sm text-slate-900 dark:text-white">{t('ownerPendingRequestsTitle')} ({handovers.length})</h2>
          </div>
          <div className="space-y-2">
            {handovers.slice(0, 4).map(rental => (
              <div key={rental.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 p-3">
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate text-slate-900 dark:text-white">{rental.itemTitle}</div>
                  <div className="text-xs text-slate-500 mt-1" dir="ltr">@{rental.renterUsername} · {rental.startDate} → {rental.endDate}</div>
                </div>
                {rental.status === 'active' && (
                  <RentoraButton size="sm" disabled={processingId === rental.id} onClick={() => handleReturn(rental.id)}>
                    {processingId === rental.id ? '...' : t('btnConfirmReturn')}
                  </RentoraButton>
                )}
              </div>
            ))}
          </div>
        </RentoraCard>
      )}

      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-black text-base text-slate-900 dark:text-white">{t('ownerMyListingsTitle')}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{myItems.length} {l('آگهی', 'listings', 'إعلانات', '个物品')}</p>
          </div>
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800/70 p-1">
            {[
              ['all', t('catAll')],
              ['active', t('ownerToggleActive')],
              ['paused', t('ownerToggleInactive')]
            ].map(([key, label]) => (
              <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key}
                className={"px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer " + (filter === key ? 'bg-white dark:bg-slate-700 text-[#26215C] dark:text-white shadow-sm' : 'text-slate-500')}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <RentoraEmptyState title={l('هنوز آگهی‌ای ندارید', 'No listings yet', 'لا توجد إعلانات بعد', '暂无物品')} description={l('اولین کالای خود را برای اجاره ثبت کنید.', 'Create your first rental listing.', 'أضف أول إعلان للإيجار.', '创建您的第一个租赁物品。')} actionLabel={t('ownerBtnAddGear')} onAction={() => onNavigate('list-item')} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredItems.map(item => {
              const active = !item.status || item.status === 'active';
              return (
                <RentoraCard key={item.id} className="p-3">
                  <div className="flex gap-3">
                    <button type="button" onClick={() => onSelectItem(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer">
                      <img src={item.images?.[0]} alt="" className="w-16 h-16 rounded-xl object-cover bg-slate-100 dark:bg-slate-800" />
                      <span className="min-w-0">
                        <span className="block font-black text-sm truncate text-slate-900 dark:text-white">{item.title}</span>
                        <span className="block mt-1 text-xs font-mono font-bold text-[#0F6E56]">{item.pricePerDay} π / {l('روز', 'day', 'يوم', '天')}</span>
                      </span>
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => onEditItem?.(item)} className="min-h-11 min-w-11 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer" aria-label={l('ویرایش', 'Edit', 'تعديل', '编辑')}>
                        <Edit3 className="w-4 h-4 text-[#534AB7]" />
                      </button>
                      <button type="button" onClick={() => toggleItemStatus(item.id)} className="min-h-11 min-w-11 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer" aria-label={active ? l('توقف موقت', 'Pause', 'إيقاف', '暂停') : l('فعال‌سازی', 'Activate', 'تفعيل', '激活')}>
                        {active ? <ToggleRight className="w-5 h-5 text-[#0F6E56]" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                      </button>
                    </div>
                  </div>
                  <button type="button" onClick={() => onSelectItem(item)} className="w-full min-h-11 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-bold text-[#534AB7] flex items-center justify-end gap-1 cursor-pointer">
                    {l('مشاهده آگهی', 'View listing', 'عرض الإعلان', '查看物品')}<ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </RentoraCard>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
