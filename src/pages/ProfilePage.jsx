import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { getUserReputationSummary } from '../services/reputationService';
import { cloudSyncService } from '../services/cloudSyncService';
import { User, ShieldCheck, Star, Settings, Globe, LogOut, Edit3, Camera, Save, Package, CheckCircle2, AlertCircle, CalendarDays } from 'lucide-react';

function Avatar({ src, username, className = 'w-20 h-20' }) {
  return src ? <img src={src} alt="" className={className + ' rounded-2xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'} /> :
    <div className={className + ' rounded-2xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#534AB7] dark:text-[#EEEDFE] flex items-center justify-center font-bold text-2xl border border-slate-200 dark:border-slate-700'}>{(username || 'P').charAt(0).toUpperCase()}</div>;
}

export default function ProfilePage({ onNavigate, onSelectItem, onOpenPublicProfile }) {
  const { t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen, logout, updateProfile, updateUserProfile } = usePiAuth();
  const { items = [], rentals = [], fetchUserReviews } = useRentora();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [userReviewsData, setUserReviewsData] = useState(null);
  const [reviewLoadError, setReviewLoadError] = useState('');
  const [reviewRetryNonce, setReviewRetryNonce] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.username) return;
    let mounted = true;
    setReviewLoadError('');
    fetchUserReviews(currentUser.username)
      .then(data => {
        if (!mounted) return;
        if (data) setUserReviewsData(data);
        else setReviewLoadError(l('داده‌های اعتبار کاربر دریافت نشد.', 'Unable to load reputation data.', 'تعذر تحميل بيانات السمعة.', '无法加载信誉数据。'));
      })
      .catch(err => {
        if (!mounted) return;
        setReviewLoadError(err?.message || l('خطا در بارگذاری اعتبار کاربر.', 'Failed to load reputation data.', 'فشل تحميل بيانات السمعة.', '加载信誉数据失败。'));
      });
    return () => { mounted = false; };
  }, [currentUser?.username, fetchUserReviews, reviewRetryNonce]);

  useEffect(() => {
    setDisplayName(currentUser?.displayName || currentUser?.username || '');
    setBio(currentUser?.bio || '');
    setAvatar(currentUser?.avatar || '');
  }, [currentUser?.displayName, currentUser?.username, currentUser?.bio, currentUser?.avatar]);

  const myItems = useMemo(() => (items || []).filter(i =>
    i.ownerUid === currentUser?.uid || i.ownerUsername?.toLowerCase() === currentUser?.username?.toLowerCase()
  ), [items, currentUser?.uid, currentUser?.username]);
  const myRentals = useMemo(() => (rentals || []).filter(r =>
    r.renterUsername?.toLowerCase() === currentUser?.username?.toLowerCase()
  ), [rentals, currentUser?.username]);

  const rentalHistoryCount = useMemo(() => (myRentals || []).filter(r =>
    ['completed', 'cancelled', 'rejected', 'disputed'].includes(String(r.status || '').toLowerCase())
  ).length, [myRentals]);

  const activeRentalCount = useMemo(() => (myRentals || []).filter(r =>
    ['draft', 'pending_payment', 'payment_approved', 'confirmed', 'active', 'requested', 'accepted'].includes(String(r.status || '').toLowerCase())
  ).length, [myRentals]);

  const rep = getUserReputationSummary(currentUser?.username, userReviewsData || rentals);

  if (!isAuthenticated) return (
    <div className="max-w-md mx-auto py-16 text-center space-y-4">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#534AB7] flex items-center justify-center"><User className="w-7 h-7" /></div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('profileTitle')}</h1>
      <p className="text-xs text-slate-500">{l('برای مشاهده پروفایل وارد حساب پای شوید.', 'Sign in with Pi to view your profile.', 'سجل الدخول لعرض ملفك الشخصي.', '请登录 Pi 查看个人资料。')}</p>
      <button type="button" onClick={() => setAuthModalOpen(true)} className="btn-primary px-5 py-2.5 text-xs font-bold">{t('navLogin')}</button>
    </div>
  );

  const save = async (e) => {
    e.preventDefault(); setProfileError(''); setIsSaving(true);
    try {
      const updater = updateProfile || updateUserProfile;
      if (updater) await updater({ displayName: displayName.trim() || currentUser.username, bio: bio.trim(), avatar: avatar || null });
      setIsEditing(false); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) { setProfileError(err?.message || l('خطا در ذخیره پروفایل.', 'Failed to save profile.', 'فشل حفظ الملف الشخصي.', '保存个人资料失败。')); }
    finally { setIsSaving(false); }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsUploadingImage(true); setProfileError('');
    try {
      const url = await cloudSyncService.compressImage(file, 400, 0.85);
      if (!url || url.startsWith('data:')) {
        throw new Error(l('آپلود سرور تصویر انجام نشد. تصویر محلی ذخیره نشد.', 'The server did not persist the image. The local image was not saved.', 'تعذر حفظ الصورة على الخادم. لم يتم حفظ الصورة محلياً.', '服务器未保存图片，本地图片不会被保存。'));
      }
      const updater = updateProfile || updateUserProfile;
      if (updater && !isEditing) await updater({ avatar: url });
      setAvatar(url);
      setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) { setProfileError(err?.message || l('آپلود تصویر ناموفق بود.', 'Profile photo upload failed.', 'فشل رفع الصورة.', '头像上传失败。')); }
    finally { setIsUploadingImage(false); e.target.value = ''; }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 pb-16 animate-fadeIn">
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} className="hidden" />
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-semibold text-[#534AB7]">{l('هویت و اعتبار', 'Identity & trust', 'الهوية والثقة', '身份与信任')}</p><h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('profileTitle')}</h1></div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setIsEditing(v => !v)} className="btn-secondary px-3 py-2 text-xs font-bold flex items-center gap-1.5"><Edit3 className="w-4 h-4" />{t('btnEditProfile')}</button>
          <button type="button" onClick={() => onNavigate('settings')} aria-label={l('تنظیمات پروفایل', 'Profile settings', 'إعدادات الملف الشخصي', '个人资料设置')} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700"><Settings aria-hidden="true" className="w-4 h-4" /></button>
        </div>
      </div>
      {profileError && <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 text-xs font-bold flex gap-2"><AlertCircle className="w-4 h-4" />{profileError}</div>}
      {saveSuccess && <div className="p-3 rounded-xl badge-trust text-xs font-bold flex gap-2"><CheckCircle2 className="w-4 h-4" />{l('پروفایل بروزرسانی شد.', 'Profile updated successfully.', 'تم تحديث الملف الشخصي.', '个人资料已更新。')}</div>}

      <section className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-5">
        <div className="rentora-card rounded-3xl p-5 sm:p-7">
          {isEditing ? <form onSubmit={save} className="space-y-5">
            <div className="flex items-center gap-4"><Avatar src={avatar} username={currentUser.username} className="w-20 h-20" /><button type="button" disabled={isUploadingImage} onClick={() => fileInputRef.current?.click()} className="btn-secondary px-3 py-2 text-xs font-bold flex items-center gap-2"><Camera className="w-4 h-4" />{isUploadingImage ? l('در حال پردازش...', 'Processing...', 'جارٍ المعالجة...', '处理中...') : l('انتخاب تصویر', 'Choose photo', 'اختيار صورة', '选择头像')}</button></div>
            
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{l('نام نمایشی', 'Display name', 'الاسم المعروض', '显示名称')}<input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={80} className="w-full mt-1 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white text-sm" /></label>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{l('بیو', 'Bio', 'نبذة', '简介')}<textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={500} rows="3" className="w-full mt-1 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white text-sm" /></label>
            <div className="flex gap-2"><button disabled={isSaving} className="btn-primary px-5 py-2 text-xs font-bold flex gap-2"><Save className="w-4 h-4" />{isSaving ? l('در حال ذخیره...', 'Saving...', 'جارٍ الحفظ...', '保存中...') : t('btnSave')}</button><button type="button" onClick={() => setIsEditing(false)} className="btn-secondary px-4 py-2 text-xs font-bold">{t('btnCancel')}</button></div>
          </form> : <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="relative shrink-0"><Avatar src={currentUser.avatar} username={currentUser.username} className="w-24 h-24" /><button type="button" onClick={() => fileInputRef.current?.click()} aria-label={l('تغییر تصویر پروفایل', 'Change profile photo', 'تغيير صورة الملف الشخصي', '更换头像')} className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-[#26215C] text-white border-2 border-white dark:border-[#151426] flex items-center justify-center"><Camera aria-hidden="true" className="w-4 h-4" /></button></div>
            <div className="min-w-0 flex-1"><h2 className="text-2xl font-bold text-slate-900 dark:text-white">{currentUser.displayName || currentUser.username}</h2><p className="text-sm text-slate-500" dir="ltr">@{currentUser.username}</p><div className="mt-2 flex flex-wrap gap-2">{currentUser.kycStatus === 'verified' && <span className="badge-trust px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />KYC Verified</span>}<span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{l('پروفایل عمومی', 'Public profile', 'ملف عام', '公开主页')}</span></div><p className="text-sm text-slate-500 dark:text-slate-400 mt-3 max-w-2xl">{currentUser.bio || l('پروفایل معتبر کاربر Rentora.', 'Rentora member profile.', 'ملف عضو Rentora.', 'Rentora 用户资料。')}</p></div>
          </div>}
          {reviewLoadError && <div role="alert" className="mt-5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-between gap-3"><span>{reviewLoadError}</span><button type="button" onClick={() => setReviewRetryNonce(v => v + 1)} className="shrink-0 btn-secondary px-3 py-1.5 text-[11px] font-bold">{l('تلاش مجدد', 'Try again', 'حاول مجدداً', '重试')}</button></div>}
          <div className="grid grid-cols-3 gap-2 mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
            <div className="text-center"><div className="text-lg font-bold text-amber-500 flex justify-center gap-1"><Star className="w-4 h-4 fill-amber-400 mt-1" />{rep.formattedScore}</div><span className="text-[11px] text-slate-400">{t('itemReviewsTitle')}</span></div>
            <div className="text-center"><div className="text-lg font-bold">{rep.reviewCount}</div><span className="text-[11px] text-slate-400">{l('نظرات', 'Reviews', 'المراجعات', '评价')}</span></div>
            <div className="text-center"><div className="text-lg font-bold">{myItems.length}</div><span className="text-[11px] text-slate-400">{t('ownerStatsListings')}</span></div>
          </div>
        </div>
        <div className="rounded-3xl bg-[#EEEDFE] dark:bg-[#26215C] p-5 space-y-3"><p className="text-xs font-bold text-[#26215C] dark:text-white">{l('پروفایل عمومی', 'Public profile', 'الملف العام', '公开主页')}</p><p className="text-xs text-slate-600 dark:text-slate-300">{l('آنچه دیگران از هویت، اعتبار و آگهی‌های فعال شما می‌بینند.', 'What other people can see about your identity, reputation and active listings.', 'ما يمكن للآخرين رؤيته عن هويتك وسمعتك وإعلاناتك.', '其他人可以看到你的身份、信誉和活跃物品。')}</p><button type="button" onClick={() => onOpenPublicProfile?.(currentUser.username)} className="w-full bg-[#26215C] text-white rounded-xl py-2.5 text-xs font-bold flex justify-center gap-2"><Globe className="w-4 h-4" />{l('مشاهده پروفایل عمومی', 'View public profile', 'عرض الملف العام', '查看公开主页')}</button></div>
      </section>

      <section><div className="flex items-center justify-between mb-3"><h2 className="text-lg font-bold text-slate-900 dark:text-white flex gap-2"><Package className="w-5 h-5 text-[#534AB7]" />{l('آگهی‌های من', 'My items', 'إعلاناتي', '我的物品')}</h2><button type="button" onClick={() => onNavigate('owner-hub')} aria-label={l('مدیریت آگهی‌های من', 'Manage my listings', 'إدارة إعلاناتي', '管理我的发布')} className="text-xs font-bold text-[#534AB7]">{l('مدیریت', 'Manage', 'إدارة', '管理')}</button></div>{myItems.length ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{myItems.slice(0,8).map(item => <button type="button" key={item.id} onClick={() => onSelectItem(item)} className="rentora-card rounded-2xl overflow-hidden text-start"><div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800">{item.images?.[0] || item.imageUrl || item.image_url ? <img src={item.images?.[0] || item.imageUrl || item.image_url} alt="" className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center"><Package className="w-8 h-8 text-slate-300" /></div>}</div><div className="p-3"><p className="text-xs font-bold truncate text-slate-900 dark:text-white">{item.title || item.name}</p></div></button>)}</div> : <div className="rentora-card rounded-2xl p-8 text-center text-xs text-slate-400">{l('هنوز آگهی فعالی ندارید.', 'No active listings yet.', 'لا توجد إعلانات نشطة.', '暂无活跃物品。')}</div>}</section>

      <section className="rentora-card rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <CalendarDays className="w-4 h-4 text-[#534AB7]" />
          <h2 className="text-sm font-bold">{l('اجاره‌های من', 'My rentals', 'إيجاراتي', '我的租赁')}</h2>
          <span className="ms-auto text-xs text-slate-400">{myRentals.length}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button type="button" onClick={() => onNavigate('activity')} className="rounded-xl border border-[#534AB7]/20 bg-[#EEEDFE]/60 dark:bg-[#26215C]/50 p-2.5 text-start cursor-pointer hover:border-[#534AB7]/40 transition">
            <span className="block text-[10px] text-slate-500 dark:text-slate-400">{l('در حال انجام', 'Active', 'نشطة', '进行中')}</span>
            <strong className="block mt-0.5 text-base font-black text-[#534AB7] dark:text-[#AFA9EC]">{activeRentalCount}</strong>
          </button>
          <button type="button" onClick={() => onNavigate('activity')} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 p-2.5 text-start cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition">
            <span className="block text-[10px] text-slate-500 dark:text-slate-400">{l('سوابق', 'History', 'السجل', '历史')}</span>
            <strong className="block mt-0.5 text-base font-black text-slate-700 dark:text-slate-200">{rentalHistoryCount}</strong>
          </button>
        </div>{myRentals.length ? <div className="space-y-2">{myRentals.slice(0,4).map(r => <div key={r.id || r.bookingNumber} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold truncate">{r.itemTitle || r.title || r.listingTitle || l('اجاره', 'Rental', 'إيجار', '租赁')}</p><p className="text-[10px] text-slate-400">{r.status || 'pending'}</p></div><span className="text-[10px] font-mono text-slate-500">{r.startDate || r.start_date || ''}</span></div>)}</div> : <p className="text-xs text-slate-400 text-center py-4">{l('هنوز اجاره‌ای ندارید.', 'No rentals yet.', 'لا توجد إيجارات بعد.', '暂无租赁记录。')}</p>}</section>
      <button type="button" onClick={logout} className="w-full py-3 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 text-xs font-bold flex justify-center gap-2"><LogOut className="w-4 h-4" />{t('navLogout')}</button>
    </div>
  );
}