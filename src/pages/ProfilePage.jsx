import React, { useState, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { getUserReputationSummary } from '../services/reputationService';
import { 
  User, 
  ShieldCheck, 
  Star, 
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
  Globe,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=PioneerAlpha',
  'https://api.dicebear.com/7.x/bottts/svg?seed=PiExplorer',
  'https://api.dicebear.com/7.x/bottts/svg?seed=PiBuilder',
  'https://api.dicebear.com/7.x/bottts/svg?seed=PiCrafter',
  'https://api.dicebear.com/7.x/bottts/svg?seed=CyberPioneer',
  'https://api.dicebear.com/7.x/bottts/svg?seed=FutureMaker'
];

export default function ProfilePage({ onNavigate, onSelectItem, onOpenPublicProfile }) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen, logout, updateProfile, updateUserProfile } = usePiAuth();
  const { items = [], rentals = [], reviews = [] } = useRentora();

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.username || 'pioneer'}`);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const fileInputRef = useRef(null);

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

  const myItems = (items || []).filter(i => 
    i.ownerUid === currentUser?.uid || i.ownerUsername?.toLowerCase() === currentUser?.username?.toLowerCase()
  );
  const myRentals = (rentals || []).filter(r => 
    r.renterUsername?.toLowerCase() === currentUser?.username?.toLowerCase()
  );

  // Dynamic reputation calculation
  const repSummary = getUserReputationSummary(currentUser?.username, rentals, reviews);

  // Handle image upload from device gallery / camera
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setAvatar(compressedDataUrl);

        if (!isEditing) {
          const updater = updateProfile || updateUserProfile;
          if (updater) {
            updater({ avatar: compressedDataUrl });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2500);
          }
        }
        setIsUploadingImage(false);
      };

      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  };

  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setIsSaving(true);
    const updater = updateProfile || updateUserProfile;
    if (updater) {
      try {
        await updater({
          displayName: displayName.trim() || currentUser?.username,
          bio: bio.trim(),
          avatar: avatar || currentUser?.avatar
        });
        setIsEditing(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } catch (err) {
        setProfileError(err?.message || l('خطا در ذخیره پروفایل.', 'Failed to save profile.', 'فشل في حفظ الملف الشخصي.', '保存个人资料失败。'));
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-16 select-none animate-fadeIn">
      
      {/* Hidden File Input for Avatar Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageFileChange}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-slate-900 dark:text-white">
          {t('profileTitle')}
        </h1>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (!isEditing) {
                setDisplayName(currentUser?.displayName || currentUser?.username || '');
                setBio(currentUser?.bio || '');
                setAvatar(currentUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.username}`);
              }
              setIsEditing(!isEditing);
            }}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              isEditing 
                ? 'bg-[#26215C] text-white border-[#26215C]' 
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#534AB7]'
            }`}
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

      {profileError && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{profileError}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-3 rounded-xl badge-trust text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-[#0F6E56] stroke-[2]" />
          <span>{l('اطلاعات و تصویر پروفایل با موفقیت بروزرسانی شد.', 'Profile information and photo updated successfully.', 'تم تحديث معلومات وصورة الملف الشخصي بنجاح.', '个人资料及头像更新成功。')}</span>
        </div>
      )}

      {/* Main Profile Info Card */}
      <div className="p-4 sm:p-5 rounded-2xl rentora-card space-y-4">
        
        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            
            {/* Avatar Change Section in Edit Form */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {l('تصویر پروفایل', 'Profile Picture', 'صورة الملف الشخصي', '个人头像')}
              </label>

              <div className="flex items-center gap-3.5">
                <div className="relative group shrink-0">
                  <img
                    src={avatar || currentUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.username}`}
                    alt=""
                    className="w-18 h-18 rounded-2xl object-cover bg-slate-100 dark:bg-slate-800 border-2 border-[#534AB7] shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="absolute inset-0 rounded-2xl bg-black/45 text-white flex flex-col items-center justify-center opacity-90 group-hover:opacity-100 transition cursor-pointer"
                  >
                    <Camera className="w-5 h-5 mb-0.5" />
                    <span className="text-[9px] font-bold">{l('تغییر عکس', 'Change', 'تغيير', '更换')}</span>
                  </button>
                </div>

                <div className="flex-1 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="btn-secondary px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#534AB7]" />
                    <span>{isUploadingImage ? l('در حال پردازش عکس...', 'Processing...', 'جارٍ المعالجة...', '正在处理...') : l('انتخاب عکس از گالری', 'Upload from Gallery', 'اختيار صورة من المعرض', '从相册选择照片')}</span>
                  </button>
                  <p className="text-[10px] text-slate-400">
                    {l('یا یکی از آواتارهای پیش‌فرض زیر را انتخاب کنید:', 'Or select one of default avatars:', 'أو اختر إحدى الصور الجاهزة:', '或选择以下默认头像：')}
                  </p>
                </div>
              </div>

              {/* Avatar Preset Options */}
              <div className="flex items-center gap-2 pt-1 overflow-x-auto pb-1">
                {AVATAR_PRESETS.map((presetUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatar(presetUrl)}
                    className={`w-9 h-9 rounded-xl border-2 transition shrink-0 p-0.5 bg-slate-100 dark:bg-slate-800 cursor-pointer ${
                      avatar === presetUrl ? 'border-[#534AB7] ring-2 ring-[#534AB7]/30 scale-105' : 'border-transparent hover:border-slate-300'
                    }`}
                  >
                    <img src={presetUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{l('نام نمایشی', 'Display Name', 'الاسم المستعار', '显示名称')}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={currentUser?.username}
                className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{l('بیوگرافی کوتاه', 'Bio', 'نبذة عنك', '个人简介')}</label>
              <textarea
                rows="2"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={l('درباره خودتان و وسایلی که اجاره می‌دهید بنویسید...', 'Write a brief description about yourself...', 'اكتب نبذة عن نفسك وأغراضك...', '填写个人简介...')}
                className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7]"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                className="btn-primary px-5 py-2 text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{t('btnSave')}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                {t('btnCancel')}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start gap-3.5">
            {/* Clickable Avatar with Camera Overlay */}
            <div className="relative group shrink-0">
              <img
                src={currentUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.username}`}
                alt=""
                className="w-16 h-16 rounded-2xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={l('تغییر عکس پروفایل', 'Change profile picture', 'تغيير صورة الملف الشخصي', '更换个人头像')}
                className="absolute -bottom-1 -right-1 rtl:-right-1 rtl:-left-auto ltr:-left-1 ltr:-right-auto w-6 h-6 rounded-lg bg-[#26215C] text-white flex items-center justify-center border-2 border-white dark:border-[#151426] shadow-sm hover:bg-[#534AB7] transition cursor-pointer"
              >
                <Camera className="w-3 h-3 text-white" />
              </button>
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {currentUser?.displayName || currentUser?.username}
                </h2>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-mono" dir="ltr">
                <span className="text-slate-600 dark:text-slate-300">@{currentUser?.username}</span>
                {currentUser?.kycStatus === 'verified' ? (
                  <span className="text-[#0F6E56] dark:text-[#48D2A8] font-bold">✓ KYC Verified</span>
                ) : (
                  <span className="text-slate-400 font-normal">({l('احراز نشده', 'Unverified', 'غير موثق', '未认证')})</span>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                {currentUser?.bio || l('پیشگام تاییدشده شبکه پای در پلتفرم رنتورا.', 'Verified Pi Pioneer on Rentora Marketplace.', 'بايونير موثق في شبكة پای على منصة رنتورا.', 'Rentora 平台经过 Pi 认证的先锋用户。')}
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

    </div>
  );
}
