import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { cloudSyncService } from '../services/cloudSyncService';
import { 
  PlusCircle, 
  Upload, 
  Trash2, 
  AlertCircle, 
  Check, 
  Crown, 
  ShieldCheck, 
  Zap, 
  Sparkles,
  ArrowRight,
  Wrench,
  Camera,
  Tent,
  Dumbbell,
  Car,
  PartyPopper,
  Home,
  Package
} from 'lucide-react';

export default function ListItemPage({ onNavigate, onItemCreated, onOpenSubscription }) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen } = usePiAuth();
  const { createItemListing, items = [], isUserPro } = useRentora();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('tools');
  const [description, setDescription] = useState('');
  const [pricePerDay, setPricePerDay] = useState('');
  const [deposit, setDeposit] = useState('');
  const [location, setLocation] = useState('');
  const [phoneContact, setPhoneContact] = useState(currentUser?.phoneMasked || '');
  const [instantBook, setInstantBook] = useState(true);
  const [images, setImages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState(false);

  const categories = [
    { id: 'tools', label: t('catTools'), icon: Wrench },
    { id: 'cameras', label: t('catCameras'), icon: Camera },
    { id: 'camping', label: t('catCamping'), icon: Tent },
    { id: 'sports', label: t('catSports'), icon: Dumbbell },
    { id: 'vehicles', label: t('catVehicles'), icon: Car },
    { id: 'events', label: t('catEvents'), icon: PartyPopper },
    { id: 'home', label: t('catHome'), icon: Home }
  ];

  if (!isAuthenticated) {
    return (
      <div className="py-16 text-center max-w-md mx-auto space-y-4 animate-fadeIn select-none">
        <div className="w-12 h-12 mx-auto rounded-xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#26215C] dark:text-[#EEEDFE] flex items-center justify-center">
          <PlusCircle className="w-6 h-6 stroke-[1.8]" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('listItemTitle')}
        </h2>
        <p className="text-xs text-slate-500">
          {l('برای ثبت آگهی و اجاره دادن وسایل خود ابتدا وارد حساب پای شوید.', 'Sign in with your Pi account to list items for rent.', 'سجل الدخول بواسطة حساب باي لعرض أجهزتك للإيجار.', '请使用 Pi 账户登录以发布闲置物品。')}
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

  const userIsPro = isUserPro(currentUser?.username);
  const userListingsCount = (items || []).filter(
    i => i.ownerUsername?.toLowerCase() === currentUser?.username?.toLowerCase()
  ).length;

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      const compressedImages = await Promise.all(
        files.slice(0, 4).map(file => cloudSyncService.compressImage(file, 800, 0.7))
      );
      setImages(prev => [...prev, ...compressedImages].slice(0, 4));
    } catch (err) {
      console.warn('[Image Upload Note]', err);
    }
  };

  const handleRemoveImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage(l('لطفاً عنوان کالا را وارد کنید.', 'Please enter an item title.', 'يرجى إدخال عنوان الإعلان.', '请输入物品标题。'));
      return;
    }

    if (!pricePerDay || parseFloat(pricePerDay) <= 0) {
      setErrorMessage(l('لطفاً مبلغ معتبر کرایه روزانه به پای (π) را وارد کنید.', 'Please enter a valid daily rental price in Pi.', 'يرجى إدخال سعر إيجار يومي صحيح بعملة باي.', '请输入有效的每日 Pi 租金。'));
      return;
    }

    if (!location.trim()) {
      setErrorMessage(l('لطفاً شهر و منطقه تحویل را وارد کنید.', 'Please enter pickup city and neighborhood.', 'يرجى إدخال المدينة ومنطقة الاستلام.', '请输入交接城市与地段。'));
      return;
    }

    setIsSubmitting(true);

    try {
      const newItem = await createItemListing({
        title,
        category,
        description,
        pricePerDay: parseFloat(pricePerDay),
        deposit: parseFloat(deposit) || 0,
        location,
        phoneContact,
        instantBook,
        images
      });

      setSuccessNotice(true);
      if (onItemCreated) onItemCreated(newItem);

      setTimeout(() => {
        onNavigate('owner-hub');
      }, 1500);
    } catch (err) {
      setErrorMessage(err.message || l('خطا در ثبت آگهی.', 'Failed to create listing.', 'فشل نشر الإعلان.', '发布失败，请重试。'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-16 select-none animate-fadeIn">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#26215C] text-white flex items-center justify-center">
            <PlusCircle className="w-4 h-4 stroke-[2]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">
              {t('listItemTitle')}
            </h1>
            <p className="text-[11px] text-slate-400">
              {t('listItemSubtitle')}
            </p>
          </div>
        </div>

        {/* Pro status badge */}
        {userIsPro ? (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-400 text-[#26215C] flex items-center gap-1 shadow-2xs">
            <Crown className="w-3 h-3" />
            <span>PRO VIP</span>
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 font-medium">
            {userListingsCount}/3 {l('آگهی رایگان', 'free listings', 'إعلانات مجانية', '件免费额度')}
          </span>
        )}
      </div>

      {/* Free limit banner if user reached 3 items and is not Pro */}
      {!userIsPro && userListingsCount >= 3 && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400 dark:border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="font-bold flex items-center gap-1">
              <Crown className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{l('سقف ۳ آگهی رایگان تکمیل شده است', 'Free 3-item limit reached', 'وصلت للحد الأقصى (3 إعلانات)', '已达3件免费发布上限')}</span>
            </span>
            <p className="text-[10px] text-amber-800 dark:text-amber-400">
              {l('برای ثبت نامحدود و ۰٪ کارمزد، به موجر طلایی ارتقا دهید.', 'Upgrade to Pro VIP for unlimited listings and 0% commission.', 'قم بالترقية لحساب Pro لنشر غير محدود وبدون عمولة.', '升级为黄金 Pro VIP 即可享受无限发布与 0% 手续费。')}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSubscription}
            className="btn-primary px-3 py-1.5 text-[11px] font-bold shrink-0 cursor-pointer"
          >
            {t('ownerProUpgradeBtn')}
          </button>
        </div>
      )}

      {/* Success Notice */}
      {successNotice && (
        <div className="p-3 rounded-xl badge-trust text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-[#0F6E56] stroke-[2]" />
          <span>{l('آگهی شما با موفقیت منتشر شد!', 'Listing published successfully!', 'تم نشر إعلانك بنجاح!', '您的物品已成功发布上架！')}</span>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 stroke-[2]" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 sm:p-5 rounded-2xl rentora-card space-y-4">
        
        {/* Title */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('fieldItemTitle')} *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('fieldItemTitlePlaceholder')}
            className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7]"
          />
        </div>

        {/* Category Picker (Icons Select) */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('fieldCategory')} *</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1.5">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                    isSelected
                      ? 'bg-[#26215C] text-white dark:bg-[#534AB7] border-[#26215C] dark:border-[#534AB7] shadow-xs'
                      : 'bg-slate-50 dark:bg-[#1E1D33] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#534AB7]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 stroke-[1.8] shrink-0" />
                  <span className="truncate">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Daily Price & Security Deposit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('fieldPricePerDay')} *</label>
            <div className="relative mt-1">
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={pricePerDay}
                onChange={(e) => setPricePerDay(e.target.value)}
                placeholder="0.5"
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white font-mono focus:outline-none focus:border-[#534AB7]"
              />
              <span className="absolute top-2.5 right-3 rtl:right-auto rtl:left-3 text-xs font-black text-[#0F6E56] font-mono">π</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('fieldDeposit')}</label>
            <div className="relative mt-1">
              <input
                type="number"
                step="0.001"
                min="0"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder="0"
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white font-mono focus:outline-none focus:border-[#534AB7]"
              />
              <span className="absolute top-2.5 right-3 rtl:right-auto rtl:left-3 text-xs font-black text-slate-400 font-mono">π</span>
            </div>
          </div>
        </div>

        {/* Location & Neighborhood */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('fieldLocation')} *</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t('fieldLocationPlaceholder')}
            className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7]"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('fieldDescription')}</label>
          <textarea
            rows="3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('fieldDescriptionPlaceholder')}
            className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7]"
          ></textarea>
        </div>

        {/* Images Upload */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('fieldImages')}</label>
          <p className="text-[10px] text-slate-400">{t('fieldImagesDesc')}</p>

          <div className="grid grid-cols-4 gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-rose-600 text-white shadow cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            {images.length < 4 && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#534AB7] flex flex-col items-center justify-center gap-1 cursor-pointer transition bg-slate-50/50 dark:bg-[#16152B]/40">
                <Upload className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] text-slate-400 font-semibold">{l('+ افزودن', '+ Add', '+ إضافة', '+ 上传')}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full py-2.5 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-sm"
        >
          <PlusCircle className="w-4 h-4 stroke-[2]" />
          <span>{isSubmitting ? l('در حال انتشار...', 'Publishing...', 'جارٍ النشر...', '正在发布...') : t('btnSubmitListing')}</span>
        </button>

      </form>

    </div>
  );
}
