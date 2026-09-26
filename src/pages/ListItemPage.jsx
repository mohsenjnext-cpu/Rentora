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
  CheckCircle2,
  Lock,
  Phone,
  MessageCircle,
  Clock,
  FileText
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
  const { createItemListing, updateItem, fetchListingContact, items = [] } = useRentora();

  const isEditMode = Boolean(itemToEdit && itemToEdit.id);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('tools');
  const [description, setDescription] = useState('');
  const [pricePerDay, setPricePerDay] = useState('');
  const [deposit, setDeposit] = useState('');
  const [location, setLocation] = useState('');
  const [instantBook, setInstantBook] = useState(true);
  const [images, setImages] = useState([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState(false);
  const [contactLoadError, setContactLoadError] = useState('');
  const [contactRetryNonce, setContactRetryNonce] = useState(0);

  // Private Contact & Coordination State
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [preferredContactMethod, setPreferredContactMethod] = useState('phone');
  const [contactHours, setContactHours] = useState('');
  const [coordinationNotes, setCoordinationNotes] = useState('');

  // Synchronize state when entering Edit mode or changing itemToEdit
  useEffect(() => {
    let active = true;
    setContactLoadError('');
    if (itemToEdit) {
      setTitle(itemToEdit.title || '');
      setCategory(itemToEdit.category || 'tools');
      setDescription(itemToEdit.description || '');
      setPricePerDay(itemToEdit.pricePerDay !== undefined ? String(itemToEdit.pricePerDay) : '');
      setDeposit(itemToEdit.deposit !== undefined ? String(itemToEdit.deposit) : '');
      setLocation(itemToEdit.location || '');
      setInstantBook(itemToEdit.instantBooking ?? itemToEdit.deliveryAvailable ?? true);
      setImages(Array.isArray(itemToEdit.images) ? [...itemToEdit.images] : (itemToEdit.images ? [itemToEdit.images] : []));

      if (itemToEdit.contactInfo) {
        setContactName(itemToEdit.contactInfo.contactName || '');
        setContactPhone(itemToEdit.contactInfo.contactPhone || '');
        setWhatsapp(itemToEdit.contactInfo.whatsapp || '');
        setPreferredContactMethod(itemToEdit.contactInfo.preferredContactMethod || 'phone');
        setContactHours(itemToEdit.contactInfo.contactHours || '');
        setCoordinationNotes(itemToEdit.contactInfo.coordinationNotes || '');
      } else if (itemToEdit.id && fetchListingContact) {
        fetchListingContact(itemToEdit.id).then(c => {
          if (active && c) {
            setContactName(c.contactName || '');
            setContactPhone(c.contactPhone || '');
            setWhatsapp(c.whatsapp || '');
            setPreferredContactMethod(c.preferredContactMethod || 'phone');
            setContactHours(c.contactHours || '');
            setCoordinationNotes(c.coordinationNotes || '');
          }
        }).catch(err => {
          if (active) setContactLoadError(err?.message || l('اطلاعات تماس آگهی بارگذاری نشد. دوباره تلاش کنید.', 'Listing contact details could not be loaded. Try again.', 'تعذر تحميل بيانات اتصال الإعلان. حاول مجدداً.', '无法加载物品联系方式，请重试。'));
        });
      }
    } else {
      setTitle('');
      setCategory('tools');
      setDescription('');
      setPricePerDay('');
      setDeposit('');
      setLocation('');
      setContactName(currentUser?.displayName || currentUser?.username || '');
      setContactPhone(currentUser?.phoneMasked || '');
      setWhatsapp('');
      setPreferredContactMethod('phone');
      setContactHours('۰۹:۰۰ الی ۲۱:۰۰');
      setCoordinationNotes('');
      setInstantBook(true);
      setImages([]);
    }
    setErrorMessage('');
    setSuccessNotice(false);
    return () => { active = false; };
  }, [itemToEdit, currentUser, contactRetryNonce]);

  const categories = [
    { id: 'tools', label: t('catTools'), icon: Wrench },
    { id: 'cameras', label: t('catCameras'), icon: Camera },
    { id: 'camping', label: t('catCamping'), icon: Tent },
    { id: 'sports', label: t('catSports'), icon: Dumbbell },
    { id: 'vehicles', label: t('catVehicles'), icon: Car },
    { id: 'events', label: t('catEvents'), icon: PartyPopper },
    { id: 'home', label: t('catHome'), icon: Home }
  ];

  // Real user photos only. No mock/sample listing imagery is inserted by the UI.
  const presetImages = {};

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
      setErrorMessage(err?.message || l('بارگذاری تصویر ناموفق بود. دوباره تلاش کنید.', 'Image upload failed. Try again.', 'فشل تحميل الصورة. حاول مجدداً.', '图片上传失败，请重试。'));
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
      const contactData = {
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        whatsapp: whatsapp.trim(),
        preferredContactMethod,
        contactHours: contactHours.trim(),
        coordinationNotes: coordinationNotes.trim()
      };

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
          contactInfo: contactData,
          instantBooking: Boolean(instantBook),
          deliveryAvailable: Boolean(instantBook),
          images: finalImages
        });

        setSuccessNotice(true);
        if (onItemUpdated) {
          onItemUpdated(updatedItem || { ...itemToEdit, title, category, description, pricePerDay: parseFloat(pricePerDay), deposit: parseFloat(deposit) || 0, location, contactInfo: contactData, images: finalImages });
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
          contactInfo: contactData,
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
    <div className="w-full max-w-5xl mx-auto space-y-5 pb-20 select-none animate-fadeIn">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
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

      {contactLoadError && isEditMode && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center justify-between gap-3" role="alert">
          <span>{contactLoadError}</span>
          <button type="button" onClick={() => setContactRetryNonce(v => v + 1)} className="shrink-0 underline font-bold cursor-pointer">
            {l('تلاش مجدد', 'Try again', 'حاول مجدداً', '重试')}
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 rounded-2xl rentora-card space-y-5 shadow-sm">

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
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
            rows="4"
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
