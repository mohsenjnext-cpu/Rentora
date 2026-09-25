import React, { useEffect, useState } from 'react';
import { PlusCircle, Upload, Trash2, Check, AlertCircle, ArrowRight, Wrench, Camera, Tent, Dumbbell, Car, PartyPopper, Home, MapPin, ShieldCheck, Info, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { cloudSyncService } from '../services/cloudSyncService';
import RentoraCard from '../components/ui/RentoraCard';
import RentoraButton from '../components/ui/RentoraButton';

export default function ListItemRedesign({ itemToEdit = null, onCancelEdit, onItemUpdated, onItemCreated, onNavigate }) {
  const { dir, t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen } = usePiAuth();
  const { createItemListing, updateItem, fetchListingContact } = useRentora();
  const edit = Boolean(itemToEdit?.id);
  const [form, setForm] = useState({ title:'', category:'tools', description:'', pricePerDay:'', deposit:'', location:'', instantBook:true });
  const [images, setImages] = useState([]);
  const [contact, setContact] = useState({ contactName:'', contactPhone:'', whatsapp:'', preferredContactMethod:'phone', contactHours:'', coordinationNotes:'' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const categories = [
    ['tools', t('catTools'), Wrench], ['cameras', t('catCameras'), Camera], ['camping', t('catCamping'), Tent],
    ['sports', t('catSports'), Dumbbell], ['vehicles', t('catVehicles'), Car], ['events', t('catEvents'), PartyPopper], ['home', t('catHome'), Home]
  ];

  useEffect(() => {
    let alive = true;
    if (!itemToEdit) {
      setForm({ title:'', category:'tools', description:'', pricePerDay:'', deposit:'', location:'', instantBook:true });
      setImages([]);
      setContact({ contactName: currentUser?.displayName || currentUser?.username || '', contactPhone: currentUser?.phoneMasked || '', whatsapp:'', preferredContactMethod:'phone', contactHours:'', coordinationNotes:'' });
      return () => { alive = false; };
    }
    setForm({
      title:itemToEdit.title || '', category:itemToEdit.category || 'tools', description:itemToEdit.description || '',
      pricePerDay:itemToEdit.pricePerDay == null ? '' : String(itemToEdit.pricePerDay), deposit:itemToEdit.deposit == null ? '' : String(itemToEdit.deposit),
      location:itemToEdit.location || '', instantBook:itemToEdit.instantBooking ?? itemToEdit.deliveryAvailable ?? true
    });
    setImages(Array.isArray(itemToEdit.images) ? itemToEdit.images : itemToEdit.images ? [itemToEdit.images] : []);
    const existing = itemToEdit.contactInfo;
    if (existing) setContact({ ...contact, ...existing });
    else if (itemToEdit.id && fetchListingContact) fetchListingContact(itemToEdit.id).then(data => { if (alive && data) setContact(prev => ({...prev, ...data})); }).catch(() => {});
    return () => { alive = false; };
  }, [itemToEdit, currentUser]);

  const set = (key, value) => setForm(prev => ({...prev, [key]:value}));

  const uploadImages = async (event) => {
    const files = Array.from(event.target.files || []);
    const remaining = Math.max(0, 6 - images.length);
    for (const file of files.slice(0, remaining)) {
      try {
        const url = await cloudSyncService.compressImage(file, 1200, 0.78);
        setImages(prev => [...prev, url].slice(0, 6));
      } catch (e) { setError(e.message || l('تصویر معتبر نیست.', 'Invalid image.', 'صورة غير صالحة.', '图片无效。')); }
    }
    event.target.value = '';
  };

  const submit = async (event) => {
    event.preventDefault(); setError(''); setSuccess(false);
    if (!form.title.trim()) return setError(l('عنوان آگهی را وارد کنید.', 'Enter a listing title.', 'أدخل عنوان الإعلان.', '请输入物品标题。'));
    if (!form.description.trim()) return setError(l('توضیحات آگهی را وارد کنید.', 'Enter a description.', 'أدخل وصف الإعلان.', '请输入描述。'));
    if (!Number.isFinite(Number(form.pricePerDay)) || Number(form.pricePerDay) <= 0) return setError(l('کرایه روزانه باید بیشتر از صفر باشد.', 'Daily rental price must be greater than zero.', 'يجب أن يكون سعر الإيجار اليومي أكبر من صفر.', '每日租金必须大于零。'));
    if (!Number.isFinite(Number(form.deposit)) || Number(form.deposit) < 0) return setError(l('مبلغ ودیعه معتبر نیست.', 'Deposit must be zero or greater.', 'قيمة الوديعة غير صالحة.', '押金不能为负数。'));
    if (!form.location.trim()) return setError(l('محل تحویل را وارد کنید.', 'Enter the handover location.', 'أدخل موقع التسليم.', '请输入交接地点。'));
    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(), category: form.category, description: form.description.trim(),
        pricePerDay: Number(form.pricePerDay), deposit: Number(form.deposit), location: form.location.trim(),
        instantBooking: Boolean(form.instantBook), deliveryAvailable: Boolean(form.instantBook), instantBook: Boolean(form.instantBook),
        images, contactInfo: { ...contact, contactName: contact.contactName.trim(), contactPhone: contact.contactPhone.trim(), whatsapp: contact.whatsapp.trim(), contactHours: contact.contactHours.trim(), coordinationNotes: contact.coordinationNotes.trim() }
      };
      const result = edit ? await updateItem(itemToEdit.id, payload) : await createItemListing(payload);
      setSuccess(true);
      if (edit) onItemUpdated?.(result || {...itemToEdit, ...payload});
      else onItemCreated?.(result);
      setTimeout(() => onNavigate?.(edit ? 'owner-hub' : 'item-detail'), 700);
    } catch (e) { setError(e.message || l('ذخیره آگهی ناموفق بود.', 'Could not save listing.', 'تعذر حفظ الإعلان.', '保存失败。')); }
    finally { setBusy(false); }
  };

  if (!isAuthenticated) return <RentoraCard className="max-w-lg mx-auto p-8 text-center space-y-4"><PlusCircle className="w-10 h-10 mx-auto text-[#534AB7]" /><h1 className="text-lg font-black">{t('listItemTitle')}</h1><p className="text-xs text-slate-500">{l('برای ثبت آگهی ابتدا با Pi وارد شوید.', 'Sign in with Pi to create a listing.', 'سجل الدخول بباي لإنشاء إعلان.', '请使用 Pi 登录后发布物品。')}</p><RentoraButton onClick={() => setAuthModalOpen(true)} className="mx-auto">{t('navLogin')}</RentoraButton></RentoraCard>;

  return (
    <div dir={dir} className="max-w-3xl mx-auto pb-20 space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onCancelEdit?.()} className="min-w-11 min-h-11 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center cursor-pointer"><ArrowRight className={dir === 'rtl' ? '' : 'rotate-180'} /></button>
        <div><h1 className="text-xl font-black text-slate-900 dark:text-white">{edit ? l('ویرایش آگهی', 'Edit Listing', 'تعديل الإعلان', '编辑物品') : t('listItemTitle')}</h1><p className="text-xs text-slate-500">{l('اطلاعات را وارد کنید؛ مبلغ و وضعیت نهایی توسط سرور اعتبارسنجی می‌شود.', 'Submit the details; final amounts and state are validated by the server.', 'يتم التحقق من المبالغ والحالة نهائياً على الخادم.', '金额与最终状态由服务器验证。')}</p></div>
      </div>

      {error && <div role="alert" className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
      {success && <div role="status" className="p-3 rounded-2xl badge-trust text-xs font-bold flex gap-2"><Check className="w-4 h-4" />{l('آگهی با موفقیت ذخیره شد.', 'Listing saved successfully.', 'تم حفظ الإعلان بنجاح.', '物品保存成功。')}</div>}

      <form onSubmit={submit} className="space-y-4">
        <RentoraCard className="p-4 sm:p-5 space-y-4">
          <h2 className="font-black text-sm">{l('اطلاعات آگهی', 'Listing details', 'بيانات الإعلان', '物品信息')}</h2>
          <label className="block text-xs font-bold">{t('fieldItemTitle')} *
            <input required value={form.title} onChange={e=>set('title',e.target.value)} className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 text-sm" />
          </label>
          <div><span className="text-xs font-bold">{t('fieldCategory')} *</span><div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">{categories.map(([id,label,Icon])=><button key={id} type="button" onClick={()=>set('category',id)} className={`min-h-11 rounded-xl border px-2 flex items-center gap-2 text-xs font-bold cursor-pointer ${form.category===id?'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#26215C]':'border-slate-200 dark:border-slate-800'}`}><Icon className="w-4 h-4 shrink-0"/><span className="truncate">{label}</span></button>)}</div></div>
          <label className="block text-xs font-bold">{l('توضیحات', 'Description', 'الوصف', '描述')} *
            <textarea required rows="5" value={form.description} onChange={e=>set('description',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-3 text-sm resize-y" />
          </label>
        </RentoraCard>

        <RentoraCard className="p-4 sm:p-5 space-y-4">
          <div className="flex items-start gap-2"><ShieldCheck className="w-5 h-5 text-[#0F6E56] shrink-0"/><div><h2 className="font-black text-sm">{l('قیمت و شرایط', 'Pricing & terms', 'السعر والشروط', '价格与条款')}</h2><p className="text-[11px] text-slate-500 mt-1">{l('اجاره و ودیعه مستقیماً بین طرفین تسویه می‌شود. Rentora وجه را نگهداری نمی‌کند.', 'Rent and deposit are settled directly between parties. Rentora does not hold escrow funds.', 'يتم التسوية مباشرة بين الطرفين. Rentora لا تحتفظ بالأموال كضمان.', '租金与押金由双方直接结算，Rentora 不托管资金。')}</p></div></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-xs font-bold">{t('fieldPricePerDay')} *<div className="relative"><input required type="number" min="0.001" step="0.001" value={form.pricePerDay} onChange={e=>set('pricePerDay',e.target.value)} className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 pr-8 text-sm"/><span className="absolute right-3 top-4 text-xs font-black">π</span></div></label>
            <label className="block text-xs font-bold">{t('fieldDeposit')}<div className="relative"><input required type="number" min="0" step="0.001" value={form.deposit} onChange={e=>set('deposit',e.target.value)} className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 pr-8 text-sm"/><span className="absolute right-3 top-4 text-xs font-black">π</span></div></label>
          </div>
          <label className="flex items-center gap-3 min-h-11 text-xs font-bold cursor-pointer"><input type="checkbox" checked={form.instantBook} onChange={e=>set('instantBook',e.target.checked)} className="w-4 h-4"/>{l('آماده برای هماهنگی سریع تحویل', 'Available for fast handover coordination', 'متاح للتنسيق السريع للتسليم', '支持快速交接协调')}</label>
          <div className="flex gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-[11px] text-amber-800 dark:text-amber-200"><Info className="w-4 h-4 shrink-0"/>{l('این مبلغ پیشنهادی است؛ اعتبار نهایی داده‌ها و مالکیت آگهی با سرور است.', 'These are submitted values; final validation and listing ownership remain server-authoritative.', 'القيم المدخلة تخضع للتحقق النهائي من الخادم.', '提交值将由服务器进行最终验证。')}</div>
        </RentoraCard>

        <RentoraCard className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2"><MapPin className="w-5 h-5 text-[#534AB7]"/><h2 className="font-black text-sm">{l('محل تحویل', 'Handover location', 'موقع التسليم', '交接地点')}</h2></div>
          <input required value={form.location} onChange={e=>set('location',e.target.value)} placeholder={l('شهر، منطقه', 'City, neighborhood', 'المدينة، المنطقة', '城市、区域')} className="w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 text-sm"/>
        </RentoraCard>

        <RentoraCard className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between"><div><h2 className="font-black text-sm">{l('تصاویر آگهی', 'Listing photos', 'صور الإعلان', '物品图片')}</h2><p className="text-[11px] text-slate-500">{l('حداکثر ۶ تصویر واقعی، JPEG/PNG/WebP.', 'Up to 6 real JPEG/PNG/WebP images.', 'حتى 6 صور JPEG/PNG/WebP.', '最多 6 张 JPEG/PNG/WebP 图片。')}</p></div><ImageIcon className="w-5 h-5 text-slate-400"/></div>
          <label className="min-h-24 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#534AB7]"><Upload className="w-6 h-6"/><span className="text-xs font-bold">{l('انتخاب تصاویر', 'Choose photos', 'اختر الصور', '选择图片')}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadImages} className="hidden"/></label>
          {images.length > 0 && <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{images.map((src,i)=><div key={`${src}-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800"><img src={src} alt={l(`تصویر ${i+1}`, `Photo ${i+1}`, `صورة ${i+1}`, `图片 ${i+1}`)} className="w-full h-full object-cover"/><button type="button" onClick={()=>setImages(prev=>prev.filter((_,x)=>x!==i))} className="absolute top-2 right-2 w-9 h-9 rounded-xl bg-black/60 text-white flex items-center justify-center cursor-pointer"><Trash2 className="w-4 h-4"/></button></div>)}</div>}
        </RentoraCard>

        <RentoraCard className="p-4 sm:p-5 space-y-4">
          <h2 className="font-black text-sm">{l('هماهنگی خصوصی', 'Private coordination', 'التنسيق الخاص', '私密协调')}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <input value={contact.contactName} onChange={e=>setContact({...contact,contactName:e.target.value})} placeholder={l('نام تماس','Contact name','اسم جهة الاتصال','联系人姓名')} className="min-h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 text-sm"/>
            <input value={contact.contactPhone} onChange={e=>setContact({...contact,contactPhone:e.target.value})} placeholder={l('شماره تماس','Phone','رقم الهاتف','联系电话')} className="min-h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 text-sm"/>
            <input value={contact.whatsapp} onChange={e=>setContact({...contact,whatsapp:e.target.value})} placeholder="WhatsApp" className="min-h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 text-sm"/>
            <input value={contact.contactHours} onChange={e=>setContact({...contact,contactHours:e.target.value})} placeholder={l('ساعات پاسخگویی','Contact hours','ساعات الاتصال','联系时间')} className="min-h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 text-sm"/>
          </div>
          <textarea value={contact.coordinationNotes} onChange={e=>setContact({...contact,coordinationNotes:e.target.value})} rows="3" placeholder={l('یادداشت هماهنگی تحویل','Handover coordination notes','ملاحظات التسليم','交接备注')} className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-3 text-sm"/>
          <p className="text-[11px] text-slate-500">{l('اطلاعات تماس خصوصی است و طبق مجوزهای سرور فقط در زمینه مجاز نمایش داده می‌شود.', 'Contact details are private and server-gated for authorized contexts.', 'بيانات الاتصال خاصة ومقيدة من الخادم.', '联系方式为私密信息，仅在服务器授权场景显示。')}</p>
        </RentoraCard>

        <RentoraButton type="submit" disabled={busy} className="w-full min-h-12 justify-center">{busy ? l('در حال ذخیره...', 'Saving...', 'جارٍ الحفظ...', '正在保存...') : edit ? l('ذخیره تغییرات', 'Save changes', 'حفظ التغييرات', '保存修改') : l('انتشار آگهی', 'Publish listing', 'نشر الإعلان', '发布物品')}<Check className="w-4 h-4"/></RentoraButton>
      </form>
    </div>
  );
}
