import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { cloudSyncService } from '../services/cloudSyncService';
import RentoraModal from './ui/RentoraModal';
import RentoraButton from './ui/RentoraButton';
import RentoraInput from './ui/RentoraInput';
import RentoraAlert from './ui/RentoraAlert';
import confetti from 'canvas-confetti';
import {
  X,
  Coins,
  Calendar,
  MapPin,
  AlertCircle,
  Check,
  ShieldCheck,
  Receipt,
  Copy,
  ArrowRight,
  Sparkles,
  PhoneCall,
  Phone,
  MessageCircle,
  CheckCircle2,
  FileText,
  Info
} from 'lucide-react';

export default function BookingModal({ item, isOpen, onClose, onBookingSuccess }) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen } = usePiAuth();
  const { executePiPaymentForRental, fetchRentalContact } = useRentora();

  const getInitialDates = () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() + 1);
    const end = new Date(today);
    end.setDate(today.getDate() + 4);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  };

  const [dates, setDates] = useState(getInitialDates);
  const [notes, setNotes] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmedBookingData, setConfirmedBookingData] = useState(null);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [serverQuote, setServerQuote] = useState(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDates(getInitialDates());
      setErrorMessage('');
      setConfirmedBookingData(null);
      setAgreeTerms(false);
    }
  }, [isOpen]);

  // Fetch authoritative server quote whenever dates or item change
  useEffect(() => {
    if (!isOpen || !item?.id || !dates.startDate || !dates.endDate) return;
    if (new Date(dates.endDate) <= new Date(dates.startDate)) {
      setServerQuote(null);
      return;
    }

    let isMounted = true;
    setIsLoadingQuote(true);
    setErrorMessage('');

    cloudSyncService.createRentalQuote({
      listingId: item.id,
      startDate: dates.startDate,
      endDate: dates.endDate
    })
      .then(quote => {
        if (isMounted) {
          setServerQuote(quote);
          setIsLoadingQuote(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setIsLoadingQuote(false);
          setServerQuote(null);
          setErrorMessage(err?.message || l('دریافت قیمت نهایی از سرور ناموفق بود. دوباره تلاش کنید.', 'Unable to load the authoritative server quote. Please try again.', 'تعذر تحميل السعر المعتمد من الخادم. حاول مرة أخرى.', '无法加载服务器权威报价，请重试。'));
        }
      });

    return () => { isMounted = false; };
  }, [isOpen, item?.id, dates.startDate, dates.endDate]);

  if (!isOpen || !item) return null;

  const dailyPrice = serverQuote?.pricePerDay;
  const daysCount = serverQuote?.daysCount;
  const rentoraFee = serverQuote?.platformFee;
  const rentalTotal = serverQuote?.baseRentalAmount;
  const deposit = serverQuote?.depositAmount;
  const totalObligation = rentalTotal !== undefined && deposit !== undefined ? rentalTotal + deposit : null;
  const platformFeePercentage = serverQuote?.platformFeePercentage ?? 5;
  const hasAuthoritativeQuote = Boolean(serverQuote?.quoteId);

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }

    const myName = (currentUser?.username || '').toLowerCase().replace('@', '').trim();
    const ownerName = (item?.ownerUsername || item?.owner_username || '').toLowerCase().replace('@', '').trim();
    if ((myName && ownerName && myName === ownerName) || (item?.ownerUid && currentUser?.uid && item.ownerUid === currentUser.uid)) {
      setErrorMessage(l(
        'شما مالک این کالا هستید و نمی‌توانید آگهی خودتان را اجاره کنید.',
        'You cannot rent your own listing.',
        'لا يمكنك استئجار غرضك الخاص.',
        '您无法租赁自己发布的物品。'
      ));
      return;
    }

    if (!agreeTerms) {
      setErrorMessage(l(
        'لطفاً قوانین تحویل مستقیم و شرایط توافقنامه اجاره را تایید کنید.',
        'Please agree to direct handover rules and rental terms.',
        'يرجى الموافقة على شروط التسليم وقواعد الإيجار المباشر.',
        '请确认并同意当面交接与租赁协议。'
      ));
      return;
    }

    if (new Date(dates.endDate) <= new Date(dates.startDate)) {
      setErrorMessage(l(
        'تاریخ بازگشت کالا باید پس از تاریخ تحویل باشد.',
        'Return date must be after pickup date.',
        'يجب أن يكون تاريخ الإرجاع بعد تاريخ الاستلام.',
        '归还日期必须晚于取货交付日期。'
      ));
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Authoritative Server Rental Creation (using Quote or Server calculation)
      let persistedRental;
      try {
        if (serverQuote?.quoteId) {
          persistedRental = await cloudSyncService.createRental({ quoteId: serverQuote.quoteId });
        } else {
          persistedRental = await cloudSyncService.createRental({
            listingId: item.id,
            startDate: dates.startDate,
            endDate: dates.endDate
          });
        }
      } catch (createErr) {
        throw createErr;
      }

      if (!serverQuote?.quoteId) {
        throw new Error(l(
          'پیش‌فاکتور معتبر از سرور دریافت نشده است.',
          'A valid server quote is required before booking.',
          'يجب الحصول على عرض سعر معتمد من الخادم قبل الحجز.',
          '预订前必须先取得有效的服务器报价。'
        ));
      }

      if (!persistedRental?.id) throw new Error('ثبت رزرو در سرور ناموفق بود.');

      // 2. Pay ONLY Rentora Platform Fee via Official Pi SDK.
      const paymentResult = await executePiPaymentForRental(persistedRental.id, persistedRental);

      // 3. Fetch verified private contact details after payment settlement.
      let contact = null;
      try {
        contact = await fetchRentalContact(persistedRental.id);
      } catch (_) {}

      // 4. Success state showing formal Rental Agreement and unlocked private contact.
      setConfirmedBookingData({
        rental: persistedRental,
        paymentResult,
        contact
      });

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      if (onBookingSuccess) {
        onBookingSuccess(persistedRental);
      }
    } catch (err) {
      console.error('[Booking Error]', err);
      setErrorMessage(err.message || l(
        'پرداخت کارمزد پای با خطا مواجه شد.',
        'Pi fee payment failed.',
        'فشلت عملية دفع کارمزد باي.',
        'Pi 平台费支付失败，请稍后重试。'
      ));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPhone = (phone) => {
    try {
      navigator.clipboard.writeText(phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch (e) {}
  };

  return (
    <RentoraModal
      open={isOpen && Boolean(item)}
      onClose={onClose}
      title={t('bookingModalTitle')}
      description={l('محاسبه شفاف و پرداخت آنلاین کارمزد در شبکه پای', 'Transparent quote with Pi fee payment', 'حساب شفاف ودفع عمولة رنتورا عبر باي', '明晰透明报价，在线支付 Pi 平台费')}
      size="md"
      closeOnBackdrop={!isSubmitting}
      closeOnEscape={!isSubmitting}
      className="select-none"
    >
      <div className="space-y-4 text-xs">
          {confirmedBookingData ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-xl badge-trust text-center space-y-2 border border-[#0F6E56]/30">
                <div className="w-12 h-12 mx-auto rounded-full bg-white dark:bg-[#0B382C] text-[#0F6E56] flex items-center justify-center shadow-xs"><CheckCircle2 className="w-7 h-7 stroke-[2]" /></div>
                <h4 className="font-bold text-base text-[#0F6E56] dark:text-[#48D2A8]">{l('رزرو شما با موفقیت تایید شد!', 'Booking Confirmed Successfully!', 'تم تأكيد الحجز بنجاح!', '预订已成功确认！')}</h4>
                <p className="text-xs text-[#0F6E56]/90 dark:text-slate-200">{l('کارمزد رنتورا از طریق Pi Payment پرداخت و قرارداد اجاره صادر گردید.', 'Rentora fee paid via Pi Payment. Rental agreement issued.', 'تم دفع عمولة رنتورا وإصدار عقد الإيجار.', '已通过 Pi 支付平台费，租赁协议已生成。')}</p>
              </div>

              <div className="p-4 rounded-xl rentora-card space-y-3 border-2 border-[#534AB7]/30 bg-gradient-to-b from-white to-[#EEEDFE]/20 dark:from-[#121124] dark:to-[#1C1B33]/40">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs sm:text-sm"><FileText className="w-4 h-4 text-[#534AB7]" /><span>{l('خلاصه توافقنامه اجاره', 'Rental Agreement Summary', 'ملخص عقد الإيجار', '租赁协议摘要')}</span></div>
                  <span className="font-mono text-xs font-black text-[#534AB7] dark:text-[#AFA9EC] bg-[#EEEDFE] dark:bg-[#26215C] px-2 py-0.5 rounded-lg">#{confirmedBookingData.rental.bookingNumber || confirmedBookingData.rental.id.substring(0, 10)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                  <div><span className="text-[10px] text-slate-400 block">{l('موجر (مالک):', 'Owner:', 'المؤجر:', '物主：')}</span><strong className="font-mono text-slate-900 dark:text-white" dir="ltr">@{confirmedBookingData.rental.ownerUsername}</strong></div>
                  <div><span className="text-[10px] text-slate-400 block">{l('مستاجر:', 'Renter:', 'المستأجر:', '租客：')}</span><strong className="font-mono text-slate-900 dark:text-white" dir="ltr">@{confirmedBookingData.rental.renterUsername}</strong></div>
                </div>
                <div className="space-y-1.5 pt-2 border-t border-slate-150 dark:border-slate-800 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">{l('کالا و مدت:', 'Item & Period:', 'الغرض والمدة:', '物品及租期：')}</span><span className="font-semibold text-slate-900 dark:text-white">{item.title} ({daysCount ?? '—'} {l('روز', 'days', 'أيام', '天')})</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">{l('مبلغ کرایه (تسویه مستقیم در محل):', 'Rental (Direct P2P):', 'الإيجار (مباشر يداً بيد):', '租金（线下当面结清）：')}</span><strong className="font-mono text-slate-900 dark:text-white">{rentalTotal ?? '—'} π</strong></div>
                  {deposit > 0 && <div className="flex justify-between"><span className="text-slate-500">{l('ودیعه امانی (تسویه مستقیم در محل):', 'Deposit (Direct P2P):', 'التأمين (مباشر يداً بيد):', '押金（线下当面交接）：')}</span><strong className="font-mono text-slate-900 dark:text-white">{deposit ?? '—'} π</strong></div>}
                  <div className="flex justify-between pt-1 border-t border-slate-150 dark:border-slate-800 text-[#0F6E56] dark:text-[#48D2A8] font-bold"><span>{l('کارمزد رنتورا (پرداخت آنلاین):', 'Rentora Fee (Paid Online):', 'عمولة رنتورا (مدفوعة):', 'Rentora 平台费（已在线支付）：')}</span><span className="font-mono">✓ {rentoraFee ?? '—'} π ({l('تاییدشده در پای', 'Pi Confirmed', 'مؤكدة', 'Pi 链上已确认')})</span></div>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed flex items-start gap-1.5"><Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" /><span>{l('توجه: مبلغ کرایه و ودیعه مستقیماً بین موجر و مستأجر در زمان تحویل تسویه می‌شود و توسط رنتورا نگهداری نمی‌شود.', 'Notice: Rental and deposit are settled directly between owner and renter and are not held by Rentora.', 'تنبيه: يُسوى الإيجار والتأمين مباشرة بين المؤجر والمستأجر عند الاستلام ولا تحتفظ بها رنتورا.', '提示：租金与押金均由双方当面直接结清，Rentora 不代收或托管任何资金。')}</span></div>
              </div>

              <div className="p-4 rounded-xl rentora-card space-y-3 border border-[#0F6E56]/30 bg-gradient-to-b from-white to-emerald-500/5 dark:from-[#121124] dark:to-emerald-950/10">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-150 dark:border-slate-800"><div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"><Phone className="w-4 h-4" /></div><div><h5 className="font-bold text-xs text-slate-900 dark:text-white">{l('اطلاعات تماس و هماهنگی مالک (آزادشده)', 'Unlocked Owner Contact Details', 'بيانات التواصل المفعلة مع المؤجر', '物主已解锁联系方式')}</h5><span className="text-[10px] text-[#0F6E56] dark:text-[#48D2A8] font-semibold">✓ {l('پرداخت تایید شد - اطلاعات تماس فعال گردید', 'Payment confirmed - Contact info active', 'تم تأكيد الدفع - البيانات نشطة', '已确认支付 - 联系方式已解锁')}</span></div></div>
                {confirmedBookingData.contact?.contactName && <div className="flex justify-between items-center text-xs"><span className="text-slate-500">{l('نام رابط:', 'Contact Name:', 'اسم جهة الاتصال:', '联系人：')}</span><strong className="text-slate-900 dark:text-white">{confirmedBookingData.contact.contactName}</strong></div>}
                {confirmedBookingData.contact?.contactPhone && <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800"><div><span className="text-[10px] text-slate-400 block">{l('شماره تماس مستقیم:', 'Phone:', 'الهاتف:', '电话：')}</span><strong className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">{confirmedBookingData.contact.contactPhone}</strong></div><div className="flex items-center gap-1.5"><button type="button" onClick={() => handleCopyPhone(confirmedBookingData.contact.contactPhone)} className="px-2 py-1 rounded bg-[#EEEDFE] dark:bg-[#26215C] text-[#26215C] dark:text-[#EEEDFE] text-[10px] font-bold cursor-pointer">{copiedPhone ? l('کپی شد', 'Copied', 'تم النسخ', '已复制') : l('کپی', 'Copy', 'نسخ', '复制')}</button><a href={`tel:${confirmedBookingData.contact.contactPhone}`} className="btn-primary px-2.5 py-1 text-[11px] font-bold flex items-center gap-1"><Phone className="w-3 h-3" /><span>{l('تماس', 'Call', 'اتصال', '拨打')}</span></a></div></div>}
                {confirmedBookingData.contact?.whatsapp && <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800"><div><span className="text-[10px] text-slate-400 block">{l('واتساپ:', 'WhatsApp:', 'واتساب:', 'WhatsApp：')}</span><strong className="font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">{confirmedBookingData.contact.whatsapp}</strong></div><a href={confirmedBookingData.contact.whatsapp.startsWith('http') ? confirmedBookingData.contact.whatsapp : `https://wa.me/${confirmedBookingData.contact.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1"><MessageCircle className="w-3 h-3" /><span>{l('پیام', 'Chat', 'مراسلة', '发消息')}</span></a></div>}
                {confirmedBookingData.contact?.coordinationNotes && <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#18172E] border border-slate-200 dark:border-slate-800 text-[11px] space-y-0.5"><span className="text-[10px] font-bold text-slate-500 block">{l('راهنمای تحویل:', 'Handover Notes:', 'ملاحظات الاستلام:', '交接说明：')}</span><p className="text-slate-800 dark:text-slate-200 whitespace-pre-line">{confirmedBookingData.contact.coordinationNotes}</p></div>}
              </div>
              <RentoraButton type="button" onClick={onClose} className="w-full">
                {l('مشاهده در بخش فعالیت‌ها', 'View in Activity', 'عرض في قسم النشاطات', '在活动列表中查看')}
              </RentoraButton>
            </div>
          ) : (
            <form onSubmit={handleCreateBooking} className="space-y-4">
              <div className="p-3 rounded-xl rentora-card flex items-center gap-3"><img src={item.images?.[0] || 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=900&auto=format&fit=crop&q=80'} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0" /><div className="min-w-0 flex-1"><h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">{item.title}</h4><div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5"><span className="font-mono text-[#0F6E56] dark:text-[#48D2A8] font-bold">{dailyPrice ?? '—'} π / {l('روز', 'day', 'يوم', '天')}</span><span>•</span><span className="truncate">{item.location || '—'}</span></div></div></div>
              {errorMessage && <RentoraAlert tone="error">{errorMessage}</RentoraAlert>}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300"><Calendar className="w-3.5 h-3.5 text-[#534AB7]" /><span>{t('bookingDatesLabel')}</span></div>
                <div className="grid grid-cols-2 gap-2.5">
                  <RentoraInput type="date" label={t('bookingStartDate')} value={dates.startDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setDates(prev => ({ ...prev, startDate: e.target.value }))} />
                  <RentoraInput type="date" label={t('bookingEndDate')} value={dates.endDate} min={dates.startDate} onChange={(e) => setDates(prev => ({ ...prev, endDate: e.target.value }))} />
                </div>
              </div>
              <div className="p-3.5 rounded-xl rentora-card space-y-2 border border-slate-150 dark:border-slate-800"><div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200 pb-1.5 border-b border-slate-150 dark:border-slate-800"><span>{t('priceBreakdown')}</span><span className="text-[#534AB7] dark:text-[#AFA9EC] font-bold font-mono">{daysCount} {l('روز', 'days', 'أيام', '天')}</span></div><div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300"><div><span>{l(`مبلغ اجاره (${daysCount} روز × ${dailyPrice} π):`, `Rental Total (${daysCount} days):`, `إجمالي الإيجار (${daysCount} أيام):`, `租金总额 (${daysCount} 天):`)}</span><span className="text-[10px] text-slate-400 block">{l('➔ تسویه مستقیم با مالک در محل تحویل', '➔ Direct P2P payment at pickup', '➔ دفع مباشر للمؤجر عند الاستلام', '➔ 线下当面直接向物主结清')}</span></div><span className="font-mono font-bold text-slate-900 dark:text-white">{rentalTotal} π</span></div>{deposit > 0 && <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300"><div><span>{t('securityDeposit')}:</span><span className="text-[10px] text-slate-400 block">{l('➔ امانت نقدی مستقیم - عودت در زمان بازگشت کالا', '➔ Direct P2P deposit - returned at handover', '➔ تأمين نقدي يُعاد مباشرة عند الإرجاع', '➔ 线下当面押金 - 完好归还时退回')}</span></div><span className="font-mono font-bold text-slate-900 dark:text-white">{deposit} π</span></div>}<div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800 font-medium"><span>{l('تعهد تسویه مستقیم با مالک:', 'Total direct P2P obligation:', 'إجمالي المستحق للمؤجر:', '与物主线下应结总额：')}</span><span className="font-mono font-bold text-slate-700 dark:text-slate-200">{totalObligation ?? '—'} π</span></div><div className="flex justify-between text-[11px] text-[#534AB7] dark:text-[#AFA9EC] font-semibold pt-2 border-t border-slate-200 dark:border-slate-700"><div><span>{t('platformFee')} ({platformFeePercentage}٪):</span><span className="text-[10px] text-slate-400 block">{l('➔ پرداخت آنلاین با کیف پول پای (تنها پرداخت آنلاین)', '➔ Paid online via Pi Wallet (Only online fee)', '➔ دفع أونلاين عبر محفظة باي', '➔ 通过 Pi 钱包在线支付（唯一在线费用）')}</span></div><span className="font-mono font-black text-[#0F6E56] dark:text-[#48D2A8] text-xs">{rentoraFee} π</span></div></div>
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-900 dark:text-amber-300 leading-relaxed flex items-start gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" /><span>{l('شفاف‌سازی مالی: اجاره و ودیعه مستقیماً بین مالک و مستأجر تسویه می‌شود و توسط رنتورا نگهداری نمی‌شود.', 'Financial Notice: Rental and deposit are settled directly between owner and renter and are not held by Rentora.', 'توضيح مالي: يُسوى الإيجار والتأمين مباشرة بين المؤجر والمستأجر ولا تحتفظ بها رنتورا.', '资金说明：租金与押金均由物主与租客当面直接结清，Rentora 不持有任何托管资金。')}</span></div>
              <label className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer"><input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-0.5 rounded accent-[#26215C] dark:accent-[#534AB7] cursor-pointer" /><span>{l('قوانین تحویل مستقیم حضوری و پرداخت کارمزد پلتفرم را تایید می‌کنم.', 'I accept direct handover rules and platform fee payment.', 'أوافق على قواعد التسليم المباشر ودفع عمولة المنصة.', '我确认知晓当面交接规则并同意支付平台服务费。')}</span></label>
              <RentoraButton type="submit" disabled={isSubmitting || isLoadingQuote || !hasAuthoritativeQuote} loading={isSubmitting} className="w-full">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>{isSubmitting ? l('در حال اتصال به کیف پول پای...', 'Connecting to Pi Wallet...', 'جارٍ الاتصال بمحفظة باي...', '正在调起 Pi 钱包支付...') : (rentoraFee === 0 ? l('تایید و ثبت رزرو رایگان', 'Confirm Free Booking', 'تأكيد الحجز المجاني', '确认免费预订') : l(`پرداخت کارمزد رنتورا با پای (${rentoraFee} π)`, `Pay Rentora Fee with Pi (${rentoraFee} π)`, `دفع عمولة رنتورا عبر باي (${rentoraFee} π)`, `通过 Pi 支付平台费 (${rentoraFee} π)`))}</span>
              </RentoraButton>
            </form>
          )}
      </div>
    </RentoraModal>
  );
}
