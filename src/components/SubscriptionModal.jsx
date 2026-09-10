import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora, SUBSCRIPTION_PLANS } from '../context/RentoraContext';
import { piService } from '../services/piService';
import confetti from 'canvas-confetti';
import { 
  X, 
  Crown, 
  Sparkles, 
  Infinity, 
  Percent, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  LogIn,
  ShieldCheck,
  Smartphone
} from 'lucide-react';

export default function SubscriptionModal({ isOpen, onClose }) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen } = usePiAuth();
  const { purchaseProSubscription, isUserPro } = useRentora();

  const [selectedPlanId, setSelectedPlanId] = useState('plan_monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const isAlreadyPro = isUserPro(currentUser?.username);
  const isInsidePiBrowser = piService.hasPiSdk();

  const handlePurchase = async () => {
    // 1. Strict verification: user MUST be authenticated with Pi account
    if (!isAuthenticated || !currentUser) {
      setErrorMessage(l(
        'جهت خرید اشتراک و کسر پای از کیف پول، ابتدا باید وارد حساب پای خود شوید.',
        'Please sign in with your Pi account first to activate subscription.',
        'يرجى تسجيل الدخول بحساب باي أولاً لتفعيل الاشتراك.',
        '请先使用 Pi 账户登录，以便在 Pi 钱包中确认支付。'
      ));
      setTimeout(() => {
        setAuthModalOpen(true);
      }, 400);
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await purchaseProSubscription(selectedPlanId);
      setSuccessMessage(l(
        'اشتراک طلایی Rentora Pro با موفقیت در شبکه پای تایید و فعال شد!',
        'Rentora Pro VIP Subscription confirmed and activated on Pi Network!',
        'تم تأكيد وتفعيل اشتراك رينتورا برو الذهبي على شبكة باي بنجاح!',
        'Rentora 黄金 Pro VIP 会员已在 Pi 链上成功确认并开通！'
      ));
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err) {
      console.warn('Subscription error:', err);
      setErrorMessage(err.message || l(
        'پرداخت توسط شما لغو شد یا در کیف پول تایید نگردید.',
        'Payment was cancelled or rejected in Pi Wallet.',
        'تم إلغاء الدفع أو رفضه في محفظة باي.',
        '支付已取消或未在 Pi 钱包中获得确认。'
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const getPlanName = (plan) => {
    if (lang === 'fa') return plan.nameFa;
    if (lang === 'ar') return plan.nameFa === 'اشتراک ماهانه Pro (ویژه)' ? 'اشتراك شهري Pro (الأكثر طلباً)' : (plan.nameFa === 'اشتراک سالانه طلایی' ? 'اشتراك سنوي ذهبي' : 'اشتراك أسبوعي Pro');
    if (lang === 'zh') return plan.id === 'plan_monthly' ? '月度 Pro VIP（最受欢迎）' : (plan.id === 'plan_annual' ? '年度黄金 VIP（立省30%）' : '周度 Pro VIP');
    return plan.nameEn;
  };

  const getPlanBadge = (plan) => {
    if (plan.popular) return l('محبوب‌ترین', 'Popular', 'الأكثر طلباً', '最受欢迎');
    if (plan.id === 'plan_annual') return l('به‌صرفه‌ترین', 'Best Value', 'أفضل قيمة', '最高性价比');
    return l('هفتگی', 'Weekly', 'أسبوعي', '周体验');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn select-none">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity cursor-pointer"
      />

      {/* Modal Card */}
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="relative w-full max-w-lg max-h-[92vh] bg-white dark:bg-[#121124] rounded-2xl shadow-2xl border border-amber-300/40 dark:border-amber-500/20 flex flex-col overflow-hidden z-10"
      >
        
        {/* Glowing Header */}
        <div className="p-4 sm:p-5 border-b border-amber-200/60 dark:border-amber-900/40 bg-gradient-to-r from-amber-500/15 via-[#26215C]/10 to-amber-500/15 dark:from-amber-950/40 dark:to-purple-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-[#26215C] flex items-center justify-center shadow-md">
              <Crown className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  {l('ارتقا به موجر طلایی (Rentora Pro)', 'Upgrade to Rentora Pro VIP', 'الترقية للمؤجر الذهبي (Rentora Pro)', '升级为黄金 Pro VIP 房东')}
                </h2>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400 text-[#26215C]">
                  VIP
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-300">
                {t('ownerProBannerDesc')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">

          {/* Success Banner */}
          {successMessage && (
            <div className="p-3 rounded-xl badge-trust text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-[#0F6E56] stroke-[2]" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-5 h-5 shrink-0 stroke-[2] text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Authentication Warning if not logged in */}
          {!isAuthenticated && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-300 text-amber-900 dark:text-amber-300 flex items-center justify-between gap-2">
              <span className="font-semibold">{l('برای پرداخت مستقیم پای، ابتدا به حساب خود متصل شوید.', 'Please sign in with Pi to execute payment.', 'يرجى تسجيل الدخول بحساب باي للمتابعة.', '请先登录 Pi 账户以继续支付。')}</span>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="btn-primary px-3 py-1 text-xs font-bold shrink-0 cursor-pointer"
              >
                {t('navLogin')}
              </button>
            </div>
          )}

          {/* Current Pro Active Banner */}
          {isAlreadyPro && (
            <div className="p-3 rounded-xl badge-trust flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500 fill-amber-400" />
                <span className="font-bold text-[#0F6E56]">{l('حساب شما در حال حاضر Pro فعال است!', 'Your account has active Pro VIP status!', 'حسابك لديه اشتراك Pro فعال حالياً!', '您的账户当前已是有效的 Pro VIP 状态！')}</span>
              </div>
            </div>
          )}

          {/* Plan Selector Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {SUBSCRIPTION_PLANS.map(plan => {
              const isSelected = selectedPlanId === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`relative p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#26215C] dark:border-amber-400 bg-amber-50/40 dark:bg-[#1E1B3D] shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151426] hover:border-slate-300'
                  }`}
                >
                  <span className={`absolute -top-2.5 right-3 rtl:right-3 rtl:left-auto ltr:left-3 ltr:right-auto text-[9px] font-black px-2 py-0.5 rounded-full shadow-2xs ${
                    plan.popular 
                      ? 'bg-[#26215C] text-white dark:bg-amber-400 dark:text-[#26215C]' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}>
                    {getPlanBadge(plan)}
                  </span>

                  <div className="space-y-1">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">{getPlanName(plan)}</h4>
                    <div className="flex items-baseline gap-1 pt-1">
                      <span className="text-xl font-black text-[#26215C] dark:text-amber-300 font-mono">{plan.pricePi}</span>
                      <span className="text-xs font-bold text-slate-500 font-mono">π</span>
                    </div>
                  </div>

                  <div className="pt-2 text-[10px] text-slate-400">
                    {plan.durationDays} {l('روز دسترسی نامحدود', 'days full access', 'أيام وصول غير محدود', '天尊享权益')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Benefits List */}
          <div className="p-4 rounded-xl rentora-card space-y-2.5">
            <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500 stroke-[2]" />
              <span>{l('مزایای اختصاصی پلن موجر حرفه‌ای (Rentora Pro):', 'Exclusive Pro VIP Owner Privileges:', 'المزايا الحصرية لخطة المؤجر المحترف (Pro):', '黄金 Pro VIP 房东专属特权：')}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#E1F5EE] text-[#0F6E56] flex items-center justify-center shrink-0">
                  <Infinity className="w-3 h-3 stroke-[2.2]" />
                </div>
                <span>{l('ثبت آگهی نامحدود (بدون سقف ۳ تایی)', 'Unlimited item listings (No 3-item cap)', 'نشر إعلانات غير محدود (بدون حد 3 أغراض)', '无限件物品发布（突破3件免费上限）')}</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#E1F5EE] text-[#0F6E56] flex items-center justify-center shrink-0">
                  <Percent className="w-3 h-3 stroke-[2.2]" />
                </div>
                <span>{l('صفر درصد کارمزد پلتفرم در تمام رزروها', '0% platform fee on all bookings', '0% رسوم منصة على كافة الحجوزات', '全单享受 0% 平台服务费特权')}</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#E1F5EE] text-[#0F6E56] flex items-center justify-center shrink-0">
                  <Crown className="w-3 h-3 stroke-[2.2] text-amber-500" />
                </div>
                <span>{l('بج طلایی فروشگاه معتبر «Pro Verified»', 'Exclusive «Pro Verified» Golden Badge', 'شارة متجر ذهبي معتمد «Pro Verified»', '独享「Pro Verified」黄金认证尊贵标识')}</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#E1F5EE] text-[#0F6E56] flex items-center justify-center shrink-0">
                  <Zap className="w-3 h-3 stroke-[2.2]" />
                </div>
                <span>{l('نردبان خودکار و نمایش در صدر نتایج', 'Priority ranking at top of search', 'أولوية الظهور في صدارة نتائج البحث', '搜索结果置顶与搜索权重优先推荐')}</span>
              </div>
            </div>
          </div>

          {/* Pi Network Direct Payment Notice */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1A1930] border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
            <Smartphone className="w-4 h-4 text-[#534AB7] shrink-0" />
            <span>{l(
              'تراکنش خرید اشتراک مستقیماً در کیف پول رسمی Pi Browser با کسر پای تسویه می‌گردد.',
              'Subscription payment settles directly from your Pi Wallet inside Pi Browser.',
              'تتم تسوية عملية الشراء مباشرة من محفظة باي الرسمية داخل متصفح Pi Browser.',
              '会员支付将直接在 Pi Browser 的官方 Pi 钱包中完成扣除与链上结算。'
            )}</span>
          </div>

        </div>

        {/* Footer Checkout */}
        <div className="p-4 border-t border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-[#16152B]/70">
          <div>
            <span className="text-[10px] text-slate-400 block">{l('مبلغ قابل پرداخت با کیف پول پای:', 'Payment with Pi Wallet:', 'المبلغ المطلوب عبر محفظة باي:', '通过 Pi 钱包支付金额：')}</span>
            <span className="text-base font-black text-[#26215C] dark:text-amber-300 font-mono">
              {SUBSCRIPTION_PLANS.find(p => p.id === selectedPlanId)?.pricePi} π
            </span>
          </div>

          <button
            type="button"
            disabled={isProcessing}
            onClick={handlePurchase}
            className="btn-primary px-5 py-2.5 text-xs font-black cursor-pointer flex items-center gap-2 bg-gradient-to-r from-[#26215C] to-[#534AB7] shadow-sm disabled:opacity-50"
          >
            <Crown className="w-4 h-4 text-amber-400 stroke-[2.2]" />
            <span>{isProcessing ? l('در حال اتصال به کیف پول پای...', 'Opening Pi Wallet...', 'جارٍ فتح محفظة باي...', '正在打开 Pi 钱包...') : l('تایید و پرداخت با کیف پول پای', 'Confirm & Pay with Pi Wallet', 'تأكيد ودفع عبر محفظة باي', '确认并通过 Pi 钱包支付')}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
