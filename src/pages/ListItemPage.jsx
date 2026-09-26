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

        {/* Private Contact & Coordination Details Section */}
        <div className="p-4 rounded-xl rentora-card space-y-3.5 border border-[#534AB7]/30 bg-gradient-to-b from-white to-[#EEEDFE]/15 dark:from-[#121124] dark:to-[#181630]">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#534AB7] dark:text-[#AFA9EC] shrink-0 mt-0.5">
              <Lock className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {l('اطلاعات تماس و هماهنگی (محرمانه پس از رزرو)', 'Contact & Coordination (Private)', 'بيانات التواصل والتنسيق (خاصة بعد الحجز)', '联系与交接信息（预订后解锁）')}
                </h3>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#0F6E56]/15 text-[#0F6E56] dark:text-[#48D2A8]">
                  Private
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {l(
                  '🔒 این اطلاعات در آگهی عمومی نمایش داده نمی‌شود و تنها پس از پرداخت قطعی کارمزد توسط مستأجر برای وی فعال می‌گردد.',
                  '🔒 Private details are hidden publicly and only unlocked for the renter after confirmed booking fee payment.',
                  '🔒 هذه البيانات سرية ولن تظهر للعامة، وتتاح فقط للمستأجر بعد تأكيد دفع عمولة الحجز.',
                  '🔒 此信息对外隐藏，仅在租客成功支付平台服务费后对其解锁显示。'
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Contact Name */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {l('نام رابط / شخص پاسخگو', 'Contact Name / Person', 'اسم جهة الاتصال', '联系人姓名')}
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder={currentUser?.displayName || currentUser?.username || 'مثال: علی رضایی'}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7]"
              />
            </div>

            {/* Contact Phone */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {l('شماره تلفن مستقیم', 'Contact Phone Number', 'رقم الهاتف المباشر', '联系电话')}
              </label>
              <div className="relative">
                <input
                  type="tel"
                  dir="ltr"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="09123456789"
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white font-mono focus:outline-none focus:border-[#534AB7]"
                />
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute top-3 right-3 rtl:right-auto rtl:left-3" />
              </div>
            </div>

            {/* WhatsApp */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {l('واتساپ (اختیاری)', 'WhatsApp (Optional)', 'واتساب (اختياري)', 'WhatsApp（选填）')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  dir="ltr"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="09123456789 / wa.me/..."
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white font-mono focus:outline-none focus:border-[#534AB7]"
                />
                <MessageCircle className="w-3.5 h-3.5 text-slate-400 absolute top-3 right-3 rtl:right-auto rtl:left-3" />
              </div>
            </div>

            {/* Preferred Contact Method */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {l('روش ترجیحی ارتباط', 'Preferred Contact Method', 'طريقة التواصل المفضلة', '首选沟通方式')}
              </label>
              <select
                value={preferredContactMethod}
                onChange={(e) => setPreferredContactMethod(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7]"
              >
                <option value="phone">{l('تماس تلفنی', 'Phone Call', 'اتصال هاتفي', '电话通话')}</option>
                <option value="whatsapp">{l('پیام در واتساپ', 'WhatsApp Message', 'واتساب', 'WhatsApp')}</option>
                <option value="chat">{l('چت درون‌برنامه رنتورا', 'Rentora In-App Chat', 'دردشة رنتورا', '应用内聊天')}</option>
                <option value="both">{l('تماس تلفنی و واتساپ', 'Phone & WhatsApp', 'هاتف وواتساب', '电话与WhatsApp均可')}</option>
              </select>
            </div>
          </div>

          {/* Contact Hours */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-[#534AB7]" />
              <span>{l('ساعات پاسخگویی و تماس', 'Contact Hours', 'أوقات الاتصال المتاحة', '接听时间段')}</span>
            </label>
            <input
              type="text"
              value={contactHours}
              onChange={(e) => setContactHours(e.target.value)}
              placeholder="مثال: همه‌روزه از ۹ صبح الی ۹ شب"
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7]"
            />
          </div>

          {/* Coordination Notes */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
              <FileText className="w-3.5 h-3.5 text-[#534AB7]" />
              <span>{l('توضیحات و دستورالعمل هماهنگی تحویل', 'Handover & Coordination Notes', 'ملاحظات التنسيق والاستلام', '交付与交接附加说明')}</span>
            </label>
            <textarea
              rows="3"
              value={coordinationNotes}
              onChange={(e) => setCoordinationNotes(e.target.value)}
              placeholder={l('مثال: لطفاً ۲ ساعت قبل از مراجعه هماهنگ بفرمایید. همراه داشتن کارت شناسایی الزامی است.', 'e.g., Please call 2 hours before pickup. ID required.', 'مثال: يرجى الاتصال قبل ساعتين من الحضور. يلزم إحضار الهوية.', '例如：请提前2小时联系确认，自提时请携带有效证件。')}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7]"
            ></textarea>
          </div>
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