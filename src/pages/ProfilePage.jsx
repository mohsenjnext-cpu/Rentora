import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { getUserReputationSummary } from '../services/reputationService';
import SubscriptionModal from '../components/SubscriptionModal';
import { 
  User, 
  ShieldCheck, 
  Star, 
  Crown, 
  Settings, 
  Share2, 
  Check, 
  LogOut, 
  Edit3, 
  Camera, 
  Save, 
  Coins, 
  Package, 
  Sparkles,
  Zap,
  Globe
} from 'lucide-react';

export default function ProfilePage({ onNavigate, onSelectItem, onOpenSubscription, onOpenPublicProfile }) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen, logout, updateProfile } = usePiAuth();
  const { items = [], rentals = [], reviews = [], isUserPro } = useRentora();

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [subModalOpen, setSubModalOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="py-16 text-center max-w-md mx-auto space-y-4 animate-fadeIn select-none">
        <div className="w-12 h-12 mx-auto rounded-xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#26215C] dark:text-[#EEEDFE] flex items-center justify-center">
          <User className="w-6 h-6 stroke-[1.8]" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('profileTitle')}
        </h2>
        <p className="text-xs text-slate-500">
          {l('برای مشاهده و ویرایش پروفایل خود ابتدا وارد حساب پای شوید.', 'Sign in with Pi to view and edit your profile.', 'سجل الدخول بواسطة حساب باي لعرض وتعديل ملفك الشخصي.', '请使用 Pi 账户登录以查看和编辑个人资料。')}
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="btn-primary px-5 py-2.5 text-xs font-bold cursor-pointer"
        >
          {t('navLogin')}
        </button>
      </div>
    );
  }

  const isPro = isUserPro(currentUser?.username);
  const myItems = (items || []).filter(i => 
    i.ownerUid === currentUser?.uid || i.ownerUsername?.toLowerCase() === currentUser?.username?.toLowerCase()
  );
  const myRentals = (rentals || []).filter(r => 
    r.renterUsername?.toLowerCase() === currentUser?.username?.toLowerCase()
  );

  // Dynamic reputation calculation
  const repSummary = getUserReputationSummary(currentUser?.username, rentals, reviews);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (updateProfile) {
      updateProfile({
        displayName,
        bio,
        avatar
      });
    }
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-16 select-none animate-fadeIn">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-slate-900 dark:text-white">
          {t('profileTitle')}
        </h1>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#534AB7] cursor-pointer"
            title={t('btnEditProfile')}
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#534AB7] cursor-pointer"
            title={t('menuSettings')}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl badge-trust text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-[#0F6E56]" />
          <span>{l('اطلاعات پروفایل با موفقیت بروزرسانی شد.', 'Profile updated successfully.', 'تم تحديث الملف الشخصي بنجاح.', '个人资料更新成功。')}</span>
        </div>
      )}

      {/* Main Profile Info Card */}
      <div className="p-4 sm:p-5 rounded-2xl rentora-card space-y-4">
        
        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{l('نام نمایشی', 'Display Name', 'الاسم المستعار', '显示名称')}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{l('بیوگرافی کوتاه', 'Bio', 'نبذة عنك', '个人简介')}</label>
              <textarea
                rows="2"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="btn-primary px-4 py-2 text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{t('btnSave')}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn-secondary px-3 py-2 text-xs font-semibold cursor-pointer"
              >
                {t('btnCancel')}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start gap-3.5">
            <img
              src={currentUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.username}`}
              alt=""
              className="w-16 h-16 rounded-2xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
            />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {currentUser?.displayName || currentUser?.username}
                </h2>
                {isPro && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400 text-[#26215C] flex items-center gap-0.5">
                    <Crown className="w-2.5 h-2.5" />
                    <span>PRO VIP</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 text-xs text-slate-400 font-mono" dir="ltr">
                <span>@{currentUser?.username}</span>
                <span className="text-[#0F6E56] font-bold">✓ KYC Verified</span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                {currentUser?.bio || l('پیشگام تاییدشده شبکه پای در پلتفرم رنتورا.', 'Verified Pi Pioneer on Rentora Marketplace.', 'بايونير موثق في شبكة باي على منصة رنتورا.', 'Rentora 平台经过 Pi 认证的先锋用户。')}
              </p>
            </div>
          </div>
        )}

        {/* Reputation Score & Stats */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-150 dark:border-slate-800 text-center">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400">{t('itemReviewsTitle')}</span>
            <div className="text-xs font-bold text-amber-500 flex items-center justify-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>{repSummary.formattedScore}</span>
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400">{t('ownerStatsListings')}</span>
            <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
              {myItems.length}
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400">{t('tabRentalHistory')}</span>
            <div className="text-xs font-bold text-[#0F6E56] font-mono">
              {myRentals.length}
            </div>
          </div>
        </div>

      </div>

      {/* Subscription banner */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
        isPro ? 'bg-amber-500/10 border-amber-300 dark:border-amber-500/30' : 'banner-purple'
      }`}>
        <div className="flex items-center gap-2.5">
          <Crown className={`w-6 h-6 ${isPro ? 'text-amber-500' : 'text-[#534AB7]'}`} />
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              {isPro ? t('ownerProBannerTitle') : l('پلن موجر طلایی (Rentora Pro VIP)', 'Rentora Pro VIP Owner', 'عضوية المؤجر الذهبي Pro', '黄金 Pro VIP 房东计划')}
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {isPro ? l('شما از تمام مزایای پلن طلایی بهره‌مندید.', 'Active Pro membership.', 'أنت تتمتع بكافة ميزات العضوية الذهبية.', '您当前已享有全部 Pro 黄金特权。') : l('ثبت نامحدود آگهی و کارمزد ۰٪', 'Unlimited listings & 0% fee', 'إعلانات غير محدودة و 0% عمولة', '无限发布与 0% 佣金优惠')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSubModalOpen(true)}
          className="btn-primary px-3 py-1.5 text-xs font-bold cursor-pointer shrink-0 shadow-xs"
        >
          {isPro ? l('مشاهده پلن', 'View Plan', 'عرض الخطة', '查看权益') : t('ownerProUpgradeBtn')}
        </button>
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onOpenPublicProfile && onOpenPublicProfile(currentUser.username)}
          className="w-full p-3 rounded-xl rentora-card text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-[#534AB7] flex items-center justify-between cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#534AB7]" />
            <span>{l('مشاهده پروفایل عمومی من', 'View My Public Profile', 'عرض ملفي الشخصي العام', '查看我的公开主页')}</span>
          </span>
          <span className="text-[10px] text-slate-400">➔</span>
        </button>

        <button
          type="button"
          onClick={logout}
          className="w-full p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition"
        >
          <LogOut className="w-4 h-4" />
          <span>{t('navLogout')}</span>
        </button>
      </div>

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={subModalOpen}
        onClose={() => setSubModalOpen(false)}
      />

    </div>
  );
}
