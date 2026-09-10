import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
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
  Crown
} from 'lucide-react';

export default function BookingModal({ item, isOpen, onClose, onBookingSuccess }) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen } = usePiAuth();
  const { 
    calculatePricing, 
    createRentalBooking, 
    executePiPaymentForRental,
    isUserPro
  } = useRentora();

  // Booking Form State
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 4);

  const [startDate, setStartDate] = useState(tomorrow.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(nextWeek.toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmedBookingData, setConfirmedBookingData] = useState(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  if (!isOpen || !item) return null;

  const isOwnerPro = item.ownerIsPro || isUserPro(item.ownerUsername);

  // Calculate live financials
  const pricing = calculatePricing({
    dailyRate: item.pricePerDay,
    startDate,
    endDate,
    securityDeposit: item.deposit || 0,
    ownerUsername: item.ownerUsername
  });

  const commissionFee = pricing.totalPlatformFee || 0;

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }

    if (!agreeTerms) {
      setErrorMessage(l(
        'لطفاً قوانین تحویل حضوری و شرایط اجاره را تأیید کنید.',
        'Please agree to the handover rules and rental terms.',
        'يرجى الموافقة على شروط التسليم وقواعد الإيجار.',
        '请确认并同意交接规则与租赁条款。'
      ));
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setErrorMessage(l(
        'تاریخ بازگشت باید پس از تاریخ تحویل باشد.',
        'Return date must be after pickup date.',
        'يجب أن يكون تاريخ الإرجاع بعد تاريخ الاستلام.',
        '归还日期必须晚于取货交付日期。'
      ));
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Create Draft Booking State
      const draftRental = await createRentalBooking({
        item,
        startDate,
        endDate,
        notes
      });

      // 2. Trigger Pi SDK Payment for the platform booking fee
      const paymentResult = await executePiPaymentForRental(draftRental.id, draftRental);

      // 3. Success state
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
        'پرداخت و رزرو با خطا مواجه شد.',
        'Booking payment failed.',
        'فشلت عملية الحجز والدفع.',
        '预订支付失败，请稍后重试。'
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
                {l('محاسبه شفاف هزینه‌ها و پرداخت آنلاین کارمزد در شبکه پای', 'Transparent pricing with Pi settlement', 'حساب شفاف للتكاليف ودفع العمولة بواسطة باي', '费用明细透明，通过 Pi 钱包安全预订')}
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

          {/* If Booking Confirmed: Show Success View */}
          {confirmedBookingData ? (
            <div className="space-y-4 animate-fadeIn">
              
              <div className="p-4 rounded-xl badge-trust text-center space-y-2 border border-[#0F6E56]/30">
                <div className="w-12 h-12 mx-auto rounded-full bg-white dark:bg-[#0B382C] text-[#0F6E56] flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-7 h-7 stroke-[2]" />
                </div>
                <h4 className="font-bold text-base text-[#0F6E56] dark:text-[#48D2A8]">
                  {t('bookingSuccessTitle')}
                </h4>
                <p className="text-xs text-[#0F6E56]/90 dark:text-slate-200">
                  {t('bookingSuccessSubtitle')}
                </p>
              </div>

              {/* Owner Contact Card */}
              <div className="p-4 rounded-xl rentora-card space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">{l('شماره هماهنگی با موجر:', 'Owner Phone Number:', 'رقم التواصل مع المؤجر:', '物主联系电话：')}</span>
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

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-900 dark:text-amber-300 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>{l('دستورالعمل تحویل امن حضوری:', 'Secure Handover Instructions:', 'إرشادات التسليم الآمن يداً بيد:', '当面安全交接指南：')}</span>
                  </div>
                  <p className="opacity-90">
                    {t('twoWayHandoverInstructions')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="btn-primary w-full py-2.5 text-xs font-bold cursor-pointer"
              >
                {t('activityTitle')}
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
                      value={startDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">{t('bookingEndDate')}</span>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Financial Calculation Breakdown Card */}
              <div className="p-3.5 rounded-xl rentora-card space-y-2 border border-slate-150 dark:border-slate-800">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200 pb-1.5 border-b border-slate-150 dark:border-slate-800">
                  <span>{t('priceBreakdown')}</span>
                  <span className="text-[#534AB7] dark:text-[#AFA9EC] font-bold">{pricing.daysCount} {l('روز', 'days', 'أيام', '天')}</span>
                </div>

                <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                  <div>
                    <span>{l(`کرایه کل (${pricing.daysCount} روز × ${item.pricePerDay} π):`, `Rental Total (${pricing.daysCount} days):`, `إجمالي الإيجار (${pricing.daysCount} أيام):`, `租金总额 (${pricing.daysCount} 天):`)}</span>
                    <span className="text-[10px] text-slate-400 block">{l('(پرداخت نقدی در محل تحویل)', '(paid in cash at pickup)', '(دفع نقدي عند الاستلام)', '(线下当面现金结清)')}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{pricing.baseRentalAmount} π</span>
                </div>

                {item.deposit > 0 && (
                  <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                    <div>
                      <span>{t('securityDeposit')}</span>
                      <span className="text-[10px] text-slate-400 block">{l('(امانت نقدی در محل - عودت هنگام بازگشت)', '(cash deposit at pickup - refunded on return)', '(تأمين نقدي يُعاد عند الإرجاع)', '(现金押金 - 完好归还时当面退回)')}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{item.deposit} π</span>
                  </div>
                )}

                <div className="flex justify-between text-[11px] text-[#534AB7] dark:text-[#AFA9EC] font-semibold pt-1 border-t border-slate-150 dark:border-slate-800">
                  <div>
                    <span>{t('platformFee')} ({pricing.platformFeePercentage}٪):</span>
                    <span className="text-[10px] text-slate-400 block">
                      {isOwnerPro 
                        ? l('موجر طلایی Pro (۰٪ کارمزد)', 'Pro VIP Owner (0% fee)', 'مؤجر برو الذهبي (0% عمولة)', '黄金 Pro VIP 房东 (0% 手续费)') 
                        : l('(پرداخت آنلاین با کیف پول پای)', '(paid online via Pi Wallet)', '(دفع أونلاين عبر محفظة باي)', '(在线通过 Pi 钱包支付)')}
                    </span>
                  </div>
                  <span className="font-mono font-black text-[#0F6E56] dark:text-[#48D2A8] text-xs">
                    {commissionFee} π
                  </span>
                </div>
              </div>

              {/* Legal Deposit Disclaimer */}
              <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-50 dark:bg-[#16152B] p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                {t('itemDirectHandoverNotice')}
              </p>

              {/* Agreement Checkbox */}
              <label className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded accent-[#26215C] dark:accent-[#534AB7] cursor-pointer"
                />
                <span>
                  {t('agreeToTerms')}
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
                    : (commissionFee === 0 
                        ? l('تایید و ثبت رزرو رایگان', 'Confirm Free Booking', 'تأكيد الحجز المجاني', '确认免费预订') 
                        : l(`پرداخت آنلاین کارمزد (${commissionFee} π)`, `Pay Online Commission (${commissionFee} π)`, `دفع العمولة أونلاين (${commissionFee} π)`, `在线支付平台费 (${commissionFee} π)`))}
                </span>
              </button>

            </form>
          )}

        </div>

      </div>
    </div>
  );
}
