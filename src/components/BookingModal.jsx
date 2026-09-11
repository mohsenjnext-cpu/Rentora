import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { RENTAL_STATES } from '../services/rentalStateMachine';
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
  CheckCircle2,
  FileText,
  Info
} from 'lucide-react';

export default function BookingModal({ item, isOpen, onClose, onBookingSuccess }) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen } = usePiAuth();
  const { 
    calculatePricing, 
    createRentalBooking, 
    executePiPaymentForRental
  } = useRentora();

  // Initial dates helper (tomorrow to +3 days)
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

  useEffect(() => {
    if (isOpen) {
      setDates(getInitialDates());
      setErrorMessage('');
      setConfirmedBookingData(null);
      setAgreeTerms(false);
    }
  }, [isOpen]);

  if (!isOpen || !item) return null;

  // Calculate live financial quote using integer-based engine
  const pricing = calculatePricing({
    pricePerDay: item.pricePerDay,
    dailyRate: item.pricePerDay,
    startDate: dates.startDate,
    endDate: dates.endDate,
    securityDeposit: item.deposit || 0,
    ownerUsername: item.ownerUsername
  });

  const rentoraFee = pricing.rentoraFee !== undefined ? pricing.rentoraFee : (pricing.totalPlatformFee || 0);
  const rentalTotal = pricing.rentalTotal !== undefined ? pricing.rentalTotal : pricing.baseRentalAmount;
  const deposit = pricing.deposit !== undefined ? pricing.deposit : (pricing.securityDeposit || 0);
  const totalObligation = pricing.totalRentalObligation !== undefined ? pricing.totalRentalObligation : (rentalTotal + deposit);

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }

    const myName = (currentUser?.username || '').toLowerCase().replace('@', '').trim();
    const ownerName = (item?.ownerUsername || '').toLowerCase().replace('@', '').trim();
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
      // 1. Create Draft Booking with formal Rental Agreement
      const draftRental = await createRentalBooking({
        item,
        itemId: item.id,
        startDate: dates.startDate,
        endDate: dates.endDate,
        daysCount: pricing.daysCount,
        notes
      });

      // 2. Pay ONLY Rentora Platform Fee via Official Pi SDK
      const paymentResult = await executePiPaymentForRental(draftRental.id, draftRental);

      // 3. Success state showing formal Rental Agreement
      setConfirmedBookingData({
        rental: draftRental,
        paymentResult,
        ownerPhone: item.phoneContact || "+98 912 345 6789"
      });

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      if (onBookingSuccess) {
        onBookingSuccess(draftRental);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn select-none">
      
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity cursor-pointer"
      />

      {/* Modal Dialog */}
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="relative w-full max-w-lg max-h-[92vh] bg-white dark:bg-[#121124] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden z-10"
      >
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-[#16152B]/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#26215C] text-white flex items-center justify-center shadow-xs">
              <Coins className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {t('bookingModalTitle')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {l('محاسبه شفاف و پرداخت آنلاین کارمزد در شبکه پای', 'Transparent quote with Pi fee payment', 'حساب شفاف ودفع عمولة رنتورا عبر باي', '明晰透明报价，在线支付 Pi 平台费')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">

          {/* If Booking Confirmed: Show Formal Rental Agreement */}
          {confirmedBookingData ? (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Top Success Badge */}
              <div className="p-4 rounded-xl badge-trust text-center space-y-2 border border-[#0F6E56]/30">
                <div className="w-12 h-12 mx-auto rounded-full bg-white dark:bg-[#0B382C] text-[#0F6E56] flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-7 h-7 stroke-[2]" />
                </div>
                <h4 className="font-bold text-base text-[#0F6E56] dark:text-[#48D2A8]">
                  {l('رزرو شما با موفقیت تایید شد!', 'Booking Confirmed Successfully!', 'تم تأكيد الحجز بنجاح!', '预订已成功确认！')}
                </h4>
                <p className="text-xs text-[#0F6E56]/90 dark:text-slate-200">
                  {l('کارمزد رنتورا از طریق Pi Payment پرداخت و قرارداد اجاره صادر گردید.', 'Rentora fee paid via Pi Payment. Rental agreement issued.', 'تم دفع عمولة رنتورا وإصدار عقد الإيجار.', '已通过 Pi 支付平台费，租赁协议已生成。')}
                </p>
              </div>

              {/* Formal Rental Agreement / Booking Summary Card */}
              <div className="p-4 rounded-xl rentora-card space-y-3 border-2 border-[#534AB7]/30 bg-gradient-to-b from-white to-[#EEEDFE]/20 dark:from-[#121124] dark:to-[#1C1B33]/40">
                
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                    <FileText className="w-4 h-4 text-[#534AB7]" />
                    <span>{l('خلاصه توافقنامه اجاره', 'Rental Agreement Summary', 'ملخص عقد الإيجار', '租赁协议摘要')}</span>
                  </div>
                  <span className="font-mono text-xs font-black text-[#534AB7] dark:text-[#AFA9EC] bg-[#EEEDFE] dark:bg-[#26215C] px-2 py-0.5 rounded-lg">
                    #{confirmedBookingData.rental.bookingNumber || confirmedBookingData.rental.id.substring(0, 10)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{l('موجر (مالک):', 'Owner:', 'المؤجر:', '物主：')}</span>
                    <strong className="font-mono text-slate-900 dark:text-white" dir="ltr">@{confirmedBookingData.rental.ownerUsername}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{l('مستاجر:', 'Renter:', 'المستأجر:', '租客：')}</span>
                    <strong className="font-mono text-slate-900 dark:text-white" dir="ltr">@{confirmedBookingData.rental.renterUsername}</strong>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-150 dark:border-slate-800 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{l('کالا و مدت:', 'Item & Period:', 'الغرض والمدة:', '物品及租期：')}</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{item.title} ({pricing.daysCount} {l('روز', 'days', 'أيام', '天')})</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">{l('مبلغ کرایه (تسویه مستقیم در محل):', 'Rental (Direct P2P):', 'الإيجار (مباشر يداً بيد):', '租金（线下当面结清）：')}</span>
                    <strong className="font-mono text-slate-900 dark:text-white">{rentalTotal} π</strong>
                  </div>

                  {deposit > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">{l('ودیعه امانی (تسویه مستقیم در محل):', 'Deposit (Direct P2P):', 'التأمين (مباشر يداً بيد):', '押金（线下当面交接）：')}</span>
                      <strong className="font-mono text-slate-900 dark:text-white">{deposit} π</strong>
                    </div>
                  )}

                  <div className="flex justify-between pt-1 border-t border-slate-150 dark:border-slate-800 text-[#0F6E56] dark:text-[#48D2A8] font-bold">
                    <span>{l('کارمزد رنتورا (پرداخت آنلاین):', 'Rentora Fee (Paid Online):', 'عمولة رنتورا (مدفوعة):', 'Rentora 平台费（已在线支付）：')}</span>
                    <span className="font-mono">✓ {rentoraFee} π ({l('تاییدشده در پای', 'Pi Confirmed', 'مؤكدة', 'Pi 链上已确认')})</span>
                  </div>
                </div>

                {/* Important Notice */}
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    {l(
                      'توجه: مبلغ کرایه و ودیعه مستقیماً بین موجر و مستأجر در زمان تحویل تسویه می‌شود و توسط رنتورا نگهداری نمی‌شود.',
                      'Notice: Rental and deposit are settled directly between owner and renter and are not held by Rentora.',
                      'تنبيه: يُسوى الإيجار والتأمين مباشرة بين المؤجر والمستأجر عند الاستلام ولا تحتفظ بها رنتورا.',
                      '提示：租金与押金均由双方当面直接结清，Rentora 不代收或托管任何资金。'
                    )}
                  </span>
                </div>

              </div>

              {/* Owner Contact Card */}
              <div className="p-4 rounded-xl rentora-card space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">{l('شماره هماهنگی تحویل با موجر:', 'Owner Phone for Handover:', 'رقم التواصل للتسليم:', '物主联系电话：')}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                      {confirmedBookingData.ownerPhone}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyPhone(confirmedBookingData.ownerPhone)}
                      className="px-2 py-1 rounded bg-[#EEEDFE] dark:bg-[#26215C] text-[#26215C] dark:text-[#EEEDFE] text-[10px] font-bold cursor-pointer"
                    >
                      {copiedPhone ? l('کپی شد', 'Copied', 'تم النسخ', '已复制') : l('کپی', 'Copy', 'نسخ', '复制')}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="btn-primary w-full py-2.5 text-xs font-bold cursor-pointer"
              >
                {l('مشاهده در بخش فعالیت‌ها', 'View in Activity', 'عرض في قسم النشاطات', '在活动列表中查看')}
              </button>

            </div>
          ) : (
            
            /* Booking Form */
            <form onSubmit={handleCreateBooking} className="space-y-4">

              {/* Item Card Overview */}
              <div className="p-3 rounded-xl rentora-card flex items-center gap-3">
                <img
                  src={item.images?.[0] || 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=900&auto=format&fit=crop&q=80'}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">{item.title}</h4>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <span className="font-mono text-[#0F6E56] dark:text-[#48D2A8] font-bold">{item.pricePerDay} π / {l('روز', 'day', 'يوم', '天')}</span>
                    <span>•</span>
                    <span className="truncate">{item.location || 'ایران'}</span>
                  </div>
                </div>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Dates Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#534AB7]" />
                  <span>{t('bookingDatesLabel')}</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">{t('bookingStartDate')}</span>
                    <input
                      type="date"
                      value={dates.startDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setDates(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">{t('bookingEndDate')}</span>
                    <input
                      type="date"
                      value={dates.endDate}
                      min={dates.startDate}
                      onChange={(e) => setDates(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Financial Calculation Breakdown Card (P2P Model) */}
              <div className="p-3.5 rounded-xl rentora-card space-y-2 border border-slate-150 dark:border-slate-800">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200 pb-1.5 border-b border-slate-150 dark:border-slate-800">
                  <span>{t('priceBreakdown')}</span>
                  <span className="text-[#534AB7] dark:text-[#AFA9EC] font-bold font-mono">{pricing.daysCount} {l('روز', 'days', 'أيام', '天')}</span>
                </div>

                {/* Rental Total */}
                <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                  <div>
                    <span>{l(`مبلغ اجاره (${pricing.daysCount} روز × ${item.pricePerDay} π):`, `Rental Total (${pricing.daysCount} days):`, `إجمالي الإيجار (${pricing.daysCount} أيام):`, `租金总额 (${pricing.daysCount} 天):`)}</span>
                    <span className="text-[10px] text-slate-400 block">{l('➔ تسویه مستقیم با مالک در محل تحویل', '➔ Direct P2P payment at pickup', '➔ دفع مباشر للمؤجر عند الاستلام', '➔ 线下当面直接向物主结清')}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{rentalTotal} π</span>
                </div>

                {/* Security Deposit */}
                {deposit > 0 && (
                  <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                    <div>
                      <span>{t('securityDeposit')}:</span>
                      <span className="text-[10px] text-slate-400 block">{l('➔ امانت نقدی مستقیم - عودت در زمان بازگشت کالا', '➔ Direct P2P deposit - returned at handover', '➔ تأمين نقدي يُعاد مباشرة عند الإرجاع', '➔ 线下当面押金 - 完好归还时退回')}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{deposit} π</span>
                  </div>
                )}

                {/* Total Rental Obligation Summary */}
                <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800 font-medium">
                  <span>{l('تعهد تسویه مستقیم با مالک:', 'Total direct P2P obligation:', 'إجمالي المستحق للمؤجر:', '与物主线下应结总额：')}</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{totalObligation} π</span>
                </div>

                {/* Rentora Platform Fee */}
                <div className="flex justify-between text-[11px] text-[#534AB7] dark:text-[#AFA9EC] font-semibold pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <span>{t('platformFee')} ({pricing.platformFeePercentage}٪):</span>
                    <span className="text-[10px] text-slate-400 block">
                      {l('➔ پرداخت آنلاین با کیف پول پای (تنها پرداخت آنلاین)', '➔ Paid online via Pi Wallet (Only online fee)', '➔ دفع أونلاين عبر محفظة باي', '➔ 通过 Pi 钱包在线支付（唯一在线费用）')}
                    </span>
                  </div>
                  <span className="font-mono font-black text-[#0F6E56] dark:text-[#48D2A8] text-xs">
                    {rentoraFee} π
                  </span>
                </div>
              </div>

              {/* Explicit P2P Disclaimer */}
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-900 dark:text-amber-300 leading-relaxed flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  {l(
                    'شفاف‌سازی مالی: اجاره و ودیعه مستقیماً بین مالک و مستأجر تسویه می‌شود و توسط رنتورا نگهداری نمی‌شود.',
                    'Financial Notice: Rental and deposit are settled directly between owner and renter and are not held by Rentora.',
                    'توضيح مالي: يُسوى الإيجار والتأمين مباشرة بين المؤجر والمستأجر ولا تحتفظ بها رنتورا.',
                    '资金说明：租金与押金均由物主与租客当面直接结清，Rentora 不持有任何托管资金。'
                  )}
                </span>
              </div>

              {/* Agreement Checkbox */}
              <label className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded accent-[#26215C] dark:accent-[#534AB7] cursor-pointer"
                />
                <span>
                  {l(
                    'قوانین تحویل مستقیم حضوری و پرداخت کارمزد پلتفرم را تایید می‌کنم.',
                    'I accept direct handover rules and platform fee payment.',
                    'أوافق على قواعد التسليم المباشر ودفع عمولة المنصة.',
                    '我确认知晓当面交接规则并同意支付平台服务费。'
                  )}
                </span>
              </label>

              {/* Submit CTA Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-2.5 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Coins className="w-4 h-4 text-amber-400" />
                <span>
                  {isSubmitting 
                    ? l('در حال اتصال به کیف پول پای...', 'Connecting to Pi Wallet...', 'جارٍ الاتصال بمحفظة باي...', '正在调起 Pi 钱包支付...') 
                    : (rentoraFee === 0 
                        ? l('تایید و ثبت رزرو رایگان', 'Confirm Free Booking', 'تأكيد الحجز المجاني', '确认免费预订') 
                        : l(`پرداخت کارمزد رنتورا با پای (${rentoraFee} π)`, `Pay Rentora Fee with Pi (${rentoraFee} π)`, `دفع عمولة رنتورا عبر باي (${rentoraFee} π)`, `通过 Pi 支付平台费 (${rentoraFee} π)`))}
                </span>
              </button>

            </form>
          )}

        </div>

      </div>
    </div>
  );
}
