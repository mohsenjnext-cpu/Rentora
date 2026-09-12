import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { piService } from '../services/piService';
import { 
  ShieldCheck, 
  X, 
  AlertCircle, 
  Coins, 
  Copy, 
  Check, 
  Smartphone,
  FlaskConical
} from 'lucide-react';

export default function PiAuthModal() {
  const { lang, dir, t, l } = useLanguage();
  const { authModalOpen, setAuthModalOpen, loginWithPi, isLoading, authError } = usePiAuth();
  
  const [copied, setCopied] = useState(false);
  const [isInsidePiBrowser, setIsInsidePiBrowser] = useState(() => piService.hasPiSdk());

  useEffect(() => {
    if (authModalOpen) {
      document.body.style.overflow = 'hidden';
      const checkSdk = () => {
        setIsInsidePiBrowser(piService.hasPiSdk());
      };
      checkSdk();
      const t1 = setTimeout(checkSdk, 400);
      const t2 = setTimeout(checkSdk, 1000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [authModalOpen]);

  if (!authModalOpen) return null;

  const handlePiOfficialLogin = async () => {
    await loginWithPi();
  };

  const handleCopyLink = () => {
    try {
      const url = typeof window !== 'undefined' && window.location.origin.includes('pinet.com') 
        ? window.location.href 
        : 'https://rentoraff9805.pinet.com/Rentora';
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-fadeIn select-none">
      <div className="relative w-full max-w-md bg-white dark:bg-[#151426] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6">
        
        {/* Close Button */}
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-4 right-4 rtl:right-auto rtl:left-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#26215C] text-white mb-2 shadow-md p-2">
            <Coins className="w-6 h-6 text-amber-400" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            {l('احراز هویت رسمی در شبکه پای', 'Official Pi Network Authentication', 'المصادقة الرسمية عبر شبكة باي', 'Pi Network 官方权威认证')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {l('ورود مستقیم پیشگامان در شبکه تست‌نت پای', 'Direct Pioneer login on Pi Testnet', 'تسجيل دخول مباشر لرواد باي على شبكة الاختبار', '基于 Pi Testnet 测试网的安全登录通道')}
          </p>
        </div>

        {/* Network Badge: Pi Testnet / Sandbox Only */}
        <div className="mb-3.5 p-2 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold">
            <FlaskConical className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>{l('شبکه تست‌نت پای (Pi Testnet / Sandbox)', 'Pi Testnet / Sandbox Mode', 'شبكة باي التجريبية (Testnet)', 'Pi Testnet 测试网模式')}</span>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {l('فعال', 'Active', 'نشط', '已启用')}
          </span>
        </div>

        {/* Error Alert */}
        {authError && (
          <div className="mb-3.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 stroke-[2] text-rose-600" />
            <span className="leading-relaxed font-medium">{authError}</span>
          </div>
        )}

        {/* Main Content */}
        {isInsidePiBrowser ? (
          /* CASE 1: INSIDE PI BROWSER -> ONE-TAP OFFICIAL AUTH */
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-[#E1F5EE] dark:bg-[#0B382C]/50 border border-[#48D2A8]/30 text-xs text-[#0F6E56] dark:text-[#48D2A8] font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-[#0F6E56] dark:text-[#48D2A8]" />
              <span className="leading-relaxed">
                {l(
                  'محیط رسمی Pi Browser شناسایی شد. روی دکمه زیر کلیک کنید.',
                  'Pi Browser detected. Tap below to authenticate.',
                  'تم التعرف على متصفح باي. اضغط بالأسفل للمصادقة.',
                  '已检测到 Pi 浏览器，点击下方按钮一键登录。'
                )}
              </span>
            </div>

            <button
              onClick={handlePiOfficialLogin}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl btn-primary text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{l('در حال تایید در Pi Browser...', 'Connecting to Pi Network...', 'جارٍ الاتصال بشبكة باي...', '正在连接 Pi 官方网络...')}</span>
                </div>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 stroke-[2] text-emerald-300" />
                  <span>{l('ورود مستقیم با حساب رسمی پای (Pi Network)', 'Sign In with Pi Network', 'تسجيل الدخول الرسمي بحساب باي', '使用 Pi 官方账号直接授权登录')}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* CASE 2: OUTSIDE PI BROWSER -> Inform user to open in Pi Browser */
          <div className="space-y-3">
            
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-300/60 dark:border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
              <div className="flex items-center gap-2 font-black text-amber-800 dark:text-amber-300">
                <Smartphone className="w-4 h-4 shrink-0 text-amber-600" />
                <span>{l('نیاز به اجرای برنامه در Pi Browser', 'Requires Official Pi Browser', 'يتطلب فتح الموقع في متصفح باي الرسمي', '必须在官方 Pi 浏览器中运行')}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                {l(
                  'جهت جلوگیری از هویت‌های جعلی و حفظ نشان معتبر KYC، ورود به رنتورا صرفاً از طریق اپلیکیشن رسمی Pi Browser امکان‌پذیر است.',
                  'To prevent spoofed identities and maintain genuine KYC Pioneer badges, authentication is strictly performed through the official Pi Browser.',
                  'لمنع الحسابات الوهمية وضمان شارة التوثيق الحقيقية KYC، تسجيل الدخول متاح حصرياً عبر متصفح باي الرسمي.',
                  '为杜绝虚假账号并保障真实的 KYC 实名认证特权，平台严格限制仅支持在官方 Pi Browser 应用内进行登录。'
                )}
              </p>
            </div>

            {/* Copy Link Button */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full py-3 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E1D33] text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 hover:border-[#534AB7] transition cursor-pointer shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-[#0F6E56]" />
                  <span className="text-[#0F6E56] font-bold">{l('لینک کپی شد! آن را در Pi Browser باز کنید', 'Link Copied! Open in Pi Browser', 'تم النسخ! افتحه في متصفح باي', '链接已复制！请在 Pi Browser 中打开')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#534AB7]" />
                  <span>{l('کپی لینک سایت جهت باز کردن در Pi Browser', 'Copy Link to open in Pi Browser', 'نسخ رابط الموقع لفتحه في متصفح باي', '复制链接并在 Pi 浏览器中打开')}</span>
                </>
              )}
            </button>

            {/* Try Connect Button */}
            <button
              type="button"
              onClick={handlePiOfficialLogin}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl btn-secondary text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4 text-[#534AB7]" />
              <span>{l('تلاش برای اتصال به Pi SDK', 'Attempt Pi SDK Connection', 'محاولة الاتصال بـ Pi SDK', '尝试连接 Pi SDK')}</span>
            </button>

          </div>
        )}

      </div>
    </div>
  );
}
