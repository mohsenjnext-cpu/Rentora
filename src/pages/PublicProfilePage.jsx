import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { getUserReputationSummary } from '../services/reputationService';
import { cloudSyncService } from '../services/cloudSyncService';
import ItemCard from '../components/ItemCard';
import ReportModal from '../components/ReportModal';
import { ArrowRight, ShieldCheck, Star, Package, MessageSquare, Share2, Flag, UserX } from 'lucide-react';

function Avatar({ src, username }) {
  return src ? <img src={src} alt="" className="w-24 h-24 rounded-3xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" /> :
    <div className="w-24 h-24 rounded-3xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#534AB7] dark:text-[#EEEDFE] flex items-center justify-center font-bold text-3xl">{(username || 'P').charAt(0).toUpperCase()}</div>;
}

export default function PublicProfilePage({ username, onBack, onSelectItem, onRentItem, onOpenChat }) {
  const { dir, t, l } = useLanguage();
  const { users = [], currentUser } = usePiAuth();
  const { items = [], rentals = [], fetchUserReviews } = useRentora();
  const [userReviewsData, setUserReviewsData] = useState(null);
  const [remoteUser, setRemoteUser] = useState(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState('');
  const [reviewsLoadError, setReviewsLoadError] = useState('');
  const [retryNonce, setRetryNonce] = useState(0);
  const targetUsername = String(username || '').replace('@', '').trim();

  useEffect(() => {
    if (!targetUsername) return;
    let mounted = true;
    setProfileLoadError('');
    setReviewsLoadError('');
    cloudSyncService.fetchPublicUserProfile(targetUsername)
      .then(u => {
        if (!mounted) return;
        if (u) setRemoteUser(u);
        else setProfileLoadError(l('پروفایل پیدا نشد.', 'Public profile could not be found.', 'تعذر العثور على الملف العام.', '找不到公开主页。'));
      })
      .catch((error) => {
        if (mounted) setProfileLoadError(error?.message || l('دریافت پروفایل ناموفق بود.', 'Could not load the public profile.', 'تعذر تحميل الملف العام.', '无法加载公开主页。'));
      });
    fetchUserReviews(targetUsername)
      .then(data => {
        if (!mounted) return;
        if (data) setUserReviewsData(data);
      })
      .catch((error) => {
        if (mounted) setReviewsLoadError(error?.message || l('دریافت نظرات ناموفق بود.', 'Could not load reviews.', 'تعذر تحميل المراجعات.', '无法加载评价。'));
      });
    return () => { mounted = false; };
  }, [targetUsername, fetchUserReviews, retryNonce]);

  const targetUser = remoteUser || users.find(u => u.username?.toLowerCase() === targetUsername.toLowerCase());
  const userItems = useMemo(() => (items || []).filter(i =>
    i.ownerUsername?.toLowerCase() === targetUsername.toLowerCase() && (!i.status || i.status === 'active')
  ), [items, targetUsername]);
  const rep = getUserReputationSummary(targetUsername, userReviewsData || rentals);
  const isSelf = currentUser?.username?.toLowerCase() === targetUsername.toLowerCase();

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 pb-16 animate-fadeIn">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#534AB7]"><ArrowRight className={'w-4 h-4 ' + (dir === 'rtl' ? '' : 'rotate-180')} />{t('btnBack')}</button>
        <div className="flex gap-2">
          {!isSelf && <button type="button" onClick={() => onOpenChat?.(null)} className="btn-secondary px-3 py-2 text-xs font-bold flex items-center gap-1.5"><MessageSquare className="w-4 h-4" />{l('گفتگو', 'Chat', 'محادثة', '聊天')}</button>}
          <button type="button" onClick={() => setIsReportOpen(true)} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700" title={l('گزارش', 'Report', 'إبلاغ', '举报')}><Flag className="w-4 h-4" /></button>
          <button type="button" onClick={() => { try { navigator.share?.({ title: targetUser?.displayName || targetUsername, text: '@' + targetUsername }); } catch {} }} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700" title={l('اشتراک‌گذاری', 'Share', 'مشاركة', '分享')}><Share2 className="w-4 h-4" /></button>
        </div>
      </div>

      {(profileLoadError || reviewsLoadError) && (
        <div role="alert" className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-between gap-3">
          <span>{profileLoadError || reviewsLoadError}</span>
          <button type="button" onClick={() => setRetryNonce(v => v + 1)} className="shrink-0 btn-secondary px-3 py-1.5 text-[11px] font-bold">
            {l('تلاش مجدد', 'Try again', 'حاول مجدداً', '重试')}
          </button>
        </div>
      )}

      <section className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-5">
        <div className="rentora-card rounded-3xl p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <Avatar src={targetUser?.avatar} username={targetUsername} />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{targetUser?.displayName || '@' + targetUsername}</h1>
              <p className="text-sm text-slate-500" dir="ltr">@{targetUsername}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {targetUser?.kycStatus === 'verified' && <span className="badge-trust px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />KYC Verified</span>}
                <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{l('پروفایل عمومی', 'Public profile', 'ملف عام', '公开主页')}</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 max-w-2xl">{targetUser?.bio || l('عضو جامعه Rentora.', 'Rentora community member.', 'عضو مجتمع Rentora.', 'Rentora 社区成员。')}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
            <div className="text-center"><div className="text-lg font-bold text-amber-500 flex justify-center gap-1"><Star className="w-4 h-4 fill-amber-400 mt-1" />{rep.formattedScore}</div><span className="text-[11px] text-slate-400">{t('itemReviewsTitle')}</span></div>
            <div className="text-center"><div className="text-lg font-bold">{rep.reviewCount}</div><span className="text-[11px] text-slate-400">{l('نظرات', 'Reviews', 'المراجعات', '评价')}</span></div>
            <div className="text-center"><div className="text-lg font-bold">{userItems.length}</div><span className="text-[11px] text-slate-400">{t('ownerStatsListings')}</span></div>
          </div>
        </div>
        <div className="rounded-3xl bg-[#EEEDFE] dark:bg-[#26215C] p-5 space-y-3"><p className="text-xs font-bold text-[#26215C] dark:text-white">{l('اعتماد در معامله', 'Trust for rentals', 'الثقة في الإيجار', '租赁信任')}</p><p className="text-xs leading-5 text-slate-600 dark:text-slate-300">{l('اطلاعات عمومی، KYC و امتیازها برای کمک به تصمیم‌گیری قبل از هماهنگی اجاره نمایش داده می‌شوند.', 'Public identity, KYC and reputation help people assess a rental before coordinating.', 'تساعد الهوية العامة وKYC والسمعة في تقييم الإيجار قبل التنسيق.', '公开身份、KYC 和信誉帮助用户在租赁前了解对方。')}</p></div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3"><h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Package className="w-5 h-5 text-[#534AB7]" />{l('آگهی‌های فعال', 'Active listings', 'الإعلانات النشطة', '活跃物品')} <span className="text-xs text-slate-400">({userItems.length})</span></h2></div>
        {userItems.length ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{userItems.map(item => <ItemCard key={item.id} item={item} onSelect={onSelectItem} onRentClick={onRentItem} />)}</div> :
          <div className="rentora-card rounded-2xl p-10 text-center space-y-2"><UserX className="w-8 h-8 mx-auto text-slate-300" /><p className="text-xs text-slate-400">{l('این کاربر در حال حاضر آگهی فعال ندارد.', 'No active listings currently.', 'لا توجد إعلانات نشطة حالياً.', '该用户目前没有活跃物品。')}</p></div>}
      </section>

      {reviewsLoadError ? (
        <section className="rentora-card rounded-2xl p-4" role="status">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400">{reviewsLoadError}</span>
            <button type="button" onClick={() => setRetryNonce(v => v + 1)} className="btn-secondary px-3 py-1.5 text-[11px] font-bold">{l('تلاش مجدد', 'Try again', 'حاول مجدداً', '重试')}</button>
          </div>
        </section>
      ) : rep.reviewCount > 0 && <section className="rentora-card rounded-2xl p-4"><div className="flex items-center gap-2 mb-3"><Star className="w-4 h-4 text-amber-500 fill-amber-400" /><h2 className="text-sm font-bold">{l('اعتبار و نظرات', 'Reputation & reviews', 'السمعة والمراجعات', '信誉与评价')}</h2></div><div className="flex items-center gap-2 text-xs"><span className="font-bold text-amber-500">{rep.formattedScore}</span><span className="text-slate-400">({rep.reviewCount} {l('نظر', 'reviews', 'مراجعة', '条评价')})</span></div></section>}

      {isReportOpen && <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} targetType="user" targetId={targetUser?.uid || targetUser?.id || targetUsername} />}
    </div>
  );
}
