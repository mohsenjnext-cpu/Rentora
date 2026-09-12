import React, { useState, useEffect } from 'react';
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
  ArrowRight,
  Wrench,
  Camera,
  Tent,
  Dumbbell,
  Car,
  PartyPopper,
  Home,
  Edit3,
  Image as ImageIcon,
  Link as LinkIcon,
  Star,
  CheckCircle2
} from 'lucide-react';

export default function ListItemPage({ 
  itemToEdit = null,
  onCancelEdit,
  onItemUpdated,
  onItemCreated,
  onNavigate
}) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen } = usePiAuth();
  const { createItemListing, updateItem, items = [] } = useRentora();

  const isEditMode = Boolean(itemToEdit && itemToEdit.id);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('tools');
  const [description, setDescription] = useState('');
  const [pricePerDay, setPricePerDay] = useState('');
  const [deposit, setDeposit] = useState('');
  const [location, setLocation] = useState('');
  const [phoneContact, setPhoneContact] = useState('');
  const [instantBook, setInstantBook] = useState(true);
  const [images, setImages] = useState([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState(false);

  // Synchronize state when entering Edit mode or changing itemToEdit
  useEffect(() => {
    if (itemToEdit) {
      setTitle(itemToEdit.title || '');
      setCategory(itemToEdit.category || 'tools');
      setDescription(itemToEdit.description || '');
      setPricePerDay(itemToEdit.pricePerDay !== undefined ? String(itemToEdit.pricePerDay) : '');
      setDeposit(itemToEdit.deposit !== undefined ? String(itemToEdit.deposit) : '');
      setLocation(itemToEdit.location || '');
      setPhoneContact(itemToEdit.phoneContact || '');
      setInstantBook(itemToEdit.instantBooking ?? itemToEdit.deliveryAvailable ?? true);
      setImages(Array.isArray(itemToEdit.images) ? [...itemToEdit.images] : (itemToEdit.images ? [itemToEdit.images] : []));
    } else {
      setTitle('');
      setCategory('tools');
      setDescription('');
      setPricePerDay('');
      setDeposit('');
      setLocation('');
      setPhoneContact(currentUser?.phoneMasked || '');
      setInstantBook(true);
      setImages([]);
    }
    setErrorMessage('');
    setSuccessNotice(false);
  }, [itemToEdit, currentUser]);

  const categories = [
    { id: 'tools', label: t('catTools'), icon: Wrench },
    { id: 'cameras', label: t('catCameras'), icon: Camera },
    { id: 'camping', label: t('catCamping'), icon: Tent },
    { id: 'sports', label: t('catSports'), icon: Dumbbell },
    { id: 'vehicles', label: t('catVehicles'), icon: Car },
    { id: 'events', label: t('catEvents'), icon: PartyPopper },
    { id: 'home', label: t('catHome'), icon: Home }
  ];

  const presetImages = {
    tools: [
      'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=900&auto=format&fit=crop&q=80'
    ],
    cameras: [
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=900&auto=format&fit=crop&q=80'
    ],
    camping: [
      'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=900&auto=format&fit=crop&q=80'
    ],
    sports: [
      'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=900&auto=format&fit=crop&q=80'
    ],
    vehicles: [
      'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=900&auto=format&fit=crop&q=80'
    ],
    events: [
      'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=900&auto=format&fit=crop&q=80'
    ],
    home: [
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900&auto=format&fit=crop&q=80'
    ]
  };

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
          {l('برای ثبت و ویرایش آگهی‌های خود ابتدا وارد حساب پای شوید.', 'Sign in with your Pi account to create or edit listings.', 'سجل الدخول بواسطة حساب باي لإنشاء أو تعديل إعلاناتك.', '请登录 Pi 账户以发布或编辑闲置物品。')}
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

  const userListingsCount = (items || []).filter(
    i => i.ownerUsername?.toLowerCase() === currentUser?.username?.toLowerCase()
  ).length;

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      const remainingSlots = Math.max(0, 6 - images.length);
      const toUpload = files.slice(0, remainingSlots);
      const compressedImages = await Promise.all(
        toUpload.map(file => cloudSyncService.compressImage(file, 800, 0.7))
      );
      setImages(prev => [...prev, ...compressedImages].slice(0, 6));
    } catch (err) {
      console.warn('[Image Upload Note]', err);
    }
  };

  const handleAddImageUrl = (e) => {
    e?.preventDefault();
    if (!imageUrlInput.trim()) return;
    if (images.length >= 6) {
      setErrorMessage(l('حداکثر می‌توانید ۶ تصویر برای آگهی انتخاب کنید.', 'You can add up to 6 images.', 'يمكنك إضافة ما يصل إلى 6 صور كحد أقصى.', '最多可添加6张图片。'));
      return;
    }
    setImages(prev => [...prev, imageUrlInput.trim()]);
    setImageUrlInput('');
    setShowUrlInput(false);
  };

  const handleAddPresetImage = (url) => {
    if (images.includes(url)) return;
    if (images.length >= 6) return;
    setImages(prev => [...prev, url]);
  };

  const handleRemoveImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSetPrimaryImage = (index) => {
    if (index === 0 || index >= images.length) return;
    setImages(prev => {
      const target = prev[index];
      const rest = prev.filter((_, i) => i !== index);
      return [target, ...rest];
    });
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
      if (isEditMode) {
        // Edit Mode
        const finalImages = images.length > 0 
          ? images 
          : [presetImages[category]?.[0] || presetImages.tools[0]];

        const updatedItem = await updateItem(itemToEdit.id, {
          title: title.trim(),
          category,
          description: description.trim(),
          pricePerDay: parseFloat(pricePerDay),
          deposit: parseFloat(deposit) || 0,
          location: location.trim(),
          city: location.split('،')?.[0]?.trim() || location.trim(),
          phoneContact: phoneContact.trim(),
          instantBooking: Boolean(instantBook),
          deliveryAvailable: Boolean(instantBook),
          images: finalImages
        });

        setSuccessNotice(true);
        if (onItemUpdated) {
          onItemUpdated(updatedItem || { ...itemToEdit, title, category, description, pricePerDay: parseFloat(pricePerDay), deposit: parseFloat(deposit) || 0, location, images: finalImages });
        }

        setTimeout(() => {
          if (onNavigate) onNavigate('owner-hub');
        }, 1200);
      } else {
        // Create Mode
        const newItem = await createItemListing({
          title: title.trim(),
          category,
          description: description.trim(),
          pricePerDay: parseFloat(pricePerDay),
          deposit: parseFloat(deposit) || 0,
          location: location.trim(),
          phoneContact: phoneContact.trim(),
          instantBook: Boolean(instantBook),
          images: images
        });

        setSuccessNotice(true);
        if (onItemCreated) onItemCreated(newItem);

        setTimeout(() => {
          if (onNavigate) onNavigate('owner-hub');
        }, 1200);
      }
    } catch (err) {
      setErrorMessage(err.message || l('خطا در پردازش آگهی.', 'Failed to process listing.', 'فشل في معالجة الإعلان.', '处理失败，请重试。'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-20 select-none animate-fadeIn">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {isEditMode && (
            <button
              type="button"
              onClick={onCancelEdit || (() => onNavigate && onNavigate('owner-hub'))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              title={t('btnBack')}
            >
              <ArrowRight className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-0' : 'rotate-180'}`} />
            </button>
          )}

          <div className="w-8 h-8 rounded-lg bg-[#26215C] text-white flex items-center justify-center shrink-0">
            {isEditMode ? <Edit3 className="w-4 h-4 stroke-[2]" /> : <PlusCircle className="w-4 h-4 stroke-[2]" />}
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">
              {isEditMode 
                ? l('ویرایش آگهی', 'Edit Listing', 'تعديل الإعلان', '编辑物品') 
                : t('listItemTitle')}
            </h1>
            <p className="text-[11px] text-slate-400">
              {isEditMode
                ? l('ویرایش مشخصات، قیمت، شرایط و مدیریت عکس‌های آگهی', 'Update listing details, pricing, and photos', 'تعديل بيانات وسعر وصور الإعلان', '更新物品信息、租金及管理图片')
                : t('listItemSubtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Success Notice */}
      {successNotice && (
        <div className="p-3 rounded-xl badge-trust text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-[#0F6E56] stroke-[2]" />
          <span>
            {isEditMode
              ? l('تغییرات آگهی با موفقیت ذخیره و در شبکه منتشر شد!', 'Listing updated and synced successfully!', 'تم حفظ وتحديث الإعلان بنجاح!', '物品信息修改成功并已同步！')
              : l('آگهی شما با موفقیت منتشر شد!', 'Listing published successfully!', 'تم نشر إعلانك بنجاح!', '您的物品已成功发布上架！')}
          </span>
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

        {/* Images Upload & Management Section */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-[#534AB7]" />
                <span>{t('fieldImages')} ({images.length}/6)</span>
              </label>
              <p className="text-[10px] text-slate-400">
                {l('تصویر اول به عنوان کاور اصلی آگهی نمایش داده می‌شود. می‌توانید تصاویر را حذف یا اضافه کنید.', 'First image is the main cover. You can add or delete photos freely.', 'الصورة الأولى هي الغلاف الرئيسي. يمكنك حذف أو إضافة الصور بحرية.', '首张为封面主图，支持自由添加与删除。')}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="text-[11px] font-semibold text-[#534AB7] dark:text-[#AFA9EC] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <LinkIcon className="w-3 h-3" />
              <span>{showUrlInput ? l('بستن لینک', 'Close URL', 'إغلاق الرابط', '关闭链接') : l('افزودن با لینک', 'Add by URL', 'إضافة عبر رابط', '通过链接添加')}</span>
            </button>
          </div>

          {/* Direct URL Input Bar */}
          {showUrlInput && (
            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-[#19182D] border border-slate-200 dark:border-slate-700 animate-fadeIn">
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="flex-1 p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121124] text-slate-900 dark:text-white font-mono focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="btn-primary px-3 py-1.5 text-xs font-bold cursor-pointer"
              >
                {l('افزودن', 'Add', 'إضافة', '添加')}
              </button>
            </div>
          )}

          {/* Images Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {images.map((img, idx) => (
              <div 
                key={idx} 
                className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-2xs"
              >
                <img src={img} alt="" className="w-full h-full object-cover" />

                {/* Primary Badge */}
                {idx === 0 ? (
                  <span className="absolute top-1 left-1 rtl:left-auto rtl:right-1 px-1.5 py-0.5 rounded bg-[#26215C]/90 text-amber-300 text-[8px] font-black flex items-center gap-0.5 shadow">
                    <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                    <span>{l('کاور', 'Cover', 'غلاف', '封面')}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetPrimaryImage(idx)}
                    className="absolute top-1 left-1 rtl:left-auto rtl:right-1 opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-slate-900/80 text-white text-[8px] font-bold transition cursor-pointer"
                    title={l('تنظیم به عنوان عکس اصلی', 'Set as Cover', 'تعيين كغلاف', '设为主图')}
                  >
                    {l('کاور شود', 'Set Cover', 'تعيين', '设封面')}
                  </button>
                )}

                {/* Delete Photo Button (حذف عکس) */}
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute top-1 right-1 rtl:right-auto rtl:left-1 p-1 rounded-full bg-rose-600/90 text-white shadow-md hover:bg-rose-700 transition cursor-pointer"
                  title={l('حذف عکس', 'Delete photo', 'حذف الصورة', '删除图片')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            {/* Upload Button */}
            {images.length < 6 && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#534AB7] flex flex-col items-center justify-center gap-1 cursor-pointer transition bg-slate-50/50 dark:bg-[#16152B]/40 group">
                <Upload className="w-4 h-4 text-slate-400 group-hover:text-[#534AB7] transition" />
                <span className="text-[10px] text-slate-400 font-semibold group-hover:text-slate-600 dark:group-hover:text-slate-200">
                  {l('+ افزودن عکس', '+ Add Photo', '+ إضافة صورة', '+ 添加图片')}
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Quick preset suggestion photos for this category */}
          {presetImages[category] && presetImages[category].length > 0 && images.length < 6 && (
            <div className="pt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400">{l('عکس‌های نمونه:', 'Sample photos:', 'صور مقترحة:', '推荐示例图：')}</span>
              {presetImages[category].map((presetUrl, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => handleAddPresetImage(presetUrl)}
                  disabled={images.includes(presetUrl)}
                  className={`text-[9px] px-2 py-0.5 rounded-md border font-medium cursor-pointer transition ${
                    images.includes(presetUrl)
                      ? 'opacity-40 border-slate-200 dark:border-slate-800 text-slate-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#534AB7]'
                  }`}
                >
                  + {l(`نمونه ${pIdx + 1}`, `Sample ${pIdx + 1}`, `عينة ${pIdx + 1}`, `示例 ${pIdx + 1}`)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Submit & Cancel Action Buttons */}
        <div className="pt-2 flex items-center gap-2">
          {isEditMode && (
            <button
              type="button"
              onClick={onCancelEdit || (() => onNavigate && onNavigate('owner-hub'))}
              className="btn-secondary flex-1 py-2.5 text-xs font-bold cursor-pointer text-center"
            >
              {l('انصراف', 'Cancel', 'إلغاء', '取消')}
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`btn-primary flex-1 py-2.5 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
              isEditMode ? 'bg-[#26215C] dark:bg-[#534AB7]' : ''
            }`}
          >
            {isEditMode ? (
              <>
                <CheckCircle2 className="w-4 h-4 stroke-[2]" />
                <span>{isSubmitting ? l('در حال ذخیره...', 'Saving...', 'جارٍ الحفظ...', '正在保存...') : l('ذخیره تغییرات آگهی', 'Save Changes', 'حفظ التعديلات', '保存修改')}</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4 stroke-[2]" />
                <span>{isSubmitting ? l('در حال انتشار...', 'Publishing...', 'جارٍ النشر...', '正在发布...') : t('btnSubmitListing')}</span>
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  );
}
