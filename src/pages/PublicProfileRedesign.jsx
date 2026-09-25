import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, MessageCircle, Package, Share2, ShieldCheck, Star } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { getUserReputationSummary } from '../services/reputationService';
import { cloudSyncService } from '../services/cloudSyncService';
import RentoraButton from '../components/ui/RentoraButton';
import RentoraCard from '../components/ui/RentoraCard';
import RentoraEmptyState from '../components/ui/RentoraEmptyState';
import ItemCard from '../components/ItemCard';

export default function PublicProfileRedesign({ username, onBack, onSelectItem, onRentItem, onOpenChat }) {
  const { dir, t, l } = useLanguage();
  const { users = [] } = usePiAuth();
  const { items = [], rentals = [], fetchUserReviews } = useRentora();
  const [remoteUser, setRemoteUser] = useState(null);
  const [reviews, setReviews] = useState(null);
  const target = String(username || '').replace('@', '');
  useEffect(() => {
    let alive = true;
    if (!target) return;
    Promise.all([cloudSyncService.fetchPublicUserProfile(target), fetchUserReviews(target)]).then(([user, data]) => {
      if (!alive) return;
      if (user) setRemoteUser(user);
      if (data) setReviews(data);
    }).catch(() => {});
    return () => { alive = false; };
  }, [target]);
  const user = remoteUser || users.find(u => String(u.username || '').replace('@','').toLowerCase() === target.toLowerCase());
  const listings = useMemo(() => items.filter(i => String(i.ownerUsername || '').replace('@','').toLowerCase() === target.toLowerCase() && (!i.status || i.status === 'active')), [items, target]);
  const reputation = getUserReputationSummary(target, reviews || rentals);
  const share = async () => {
    try { if (navigator.share) await navigator.share({ title: user?.displayName || '@'+target, url: window.location.href }); else await navigator.clipboard.writeText(window.location.href); } catch (_) {}
  };
  return <main dir={dir} className="mx-auto w-full max-w-4xl space-y-4 px-3 pb-32 pt-2 sm:px-5 sm:pb-10">
    <header className="flex items-center justify-between gap-2"><RentoraButton variant="ghost" size="sm" onClick={onBack}><ArrowRight className="rtl:rotate-0 ltr:rotate-180" size={16}/>{t('btnBack')}</RentoraButton><RentoraButton variant="secondary" size="sm" onClick={share}><Share2 size={15}/>{l('اشتراک‌گذاری','Share','مشاركة','分享')}</RentoraButton></header>
    <RentoraCard className="overflow-hidden"><div className="bg-rentora-primary-soft p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><img src={user?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${target}`} alt="" className="h-24 w-24 rounded-rentora-panel border-4 border-rentora-surface object-cover"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black text-rentora-ink" dir="ltr">{user?.displayName || '@'+target}</h1>{user?.kycStatus === 'verified' && <span className="inline-flex items-center gap-1 rounded-rentora-pill bg-rentora-success-soft px-2 py-1 text-xs font-bold text-rentora-success"><ShieldCheck size={13}/>{l('احراز هویت‌شده','Verified','موثق','已认证')}</span>}</div><p className="mt-1 text-sm text-slate-500" dir="ltr">@{target}</p><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{user?.bio || l('عضو بازار همتا‌به‌همتای رنتورا','Rentora P2P marketplace member','عضو سوق رنتورا المباشر','Rentora 点对点市场成员')}</p></div>{onOpenChat && <RentoraButton size="sm" onClick={()=>onOpenChat(null,'user')}><MessageCircle size={15}/>{l('پیام','Message','رسالة','消息')}</RentoraButton>}</div></div><div className="grid grid-cols-3 divide-x divide-rentora-border rtl:divide-x-reverse border-t border-rentora-border"><div className="p-4 text-center"><Star className="mx-auto text-amber-500" size={18} fill="currentColor"/><strong className="mt-1 block text-lg font-black">{reputation.formattedScore}</strong><span className="text-[11px] text-slate-500">{reputation.reviewCount} {l('نظر','reviews','تقييم','评价')}</span></div><div className="p-4 text-center"><Package className="mx-auto text-rentora-primary" size={18}/><strong className="mt-1 block text-lg font-black">{listings.length}</strong><span className="text-[11px] text-slate-500">{l('آگهی فعال','active listings','إعلانات نشطة','在售物品')}</span></div><div className="p-4 text-center"><ShieldCheck className="mx-auto text-rentora-success" size={18}/><strong className="mt-1 block text-lg font-black">{user?.kycStatus === 'verified' ? '✓' : '—'}</strong><span className="text-[11px] text-slate-500">{l('احراز هویت','Identity','الهوية','身份')}</span></div></div></RentoraCard>
    <section><div className="mb-3 flex items-center gap-2"><Package size={18} className="text-rentora-primary"/><h2 className="font-black text-rentora-ink">{l('آگهی‌های فعال','Active listings','الإعلانات النشطة','活跃物品')} ({listings.length})</h2></div>{listings.length===0?<RentoraEmptyState title={l('آگهی فعالی ندارد','No active listings','لا توجد إعلانات نشطة','暂无活跃物品')} description={l('در حال حاضر کالایی برای اجاره منتشر نشده است.','No items are currently listed.','لا توجد أغراض معروضة حالياً.','目前没有发布物品。')}/>:<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{listings.map(item=><ItemCard key={item.id} item={item} onSelect={onSelectItem} onRentClick={onRentItem}/>)}</div>}</section>
  </main>;
}
