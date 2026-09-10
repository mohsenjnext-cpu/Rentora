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
  ChevronDown,
  ChevronUp,
  User,
  ExternalLink
} from 'lucide-react';

export default function PiAuthModal() {
  const { lang, dir, t, l } = useLanguage();
  const { authModalOpen, setAuthModalOpen, loginWithPi, isLoading, authError } = usePiAuth();
  
  const [customUsername, setCustomUsername] = useState('');
  const [copied, setCopied] = useState(false);
  const [showDemoBox, setShowDemoBox] = useState(false);

  const isInsidePiBrowser = piService.hasPiSdk();

  useEffect(() => {
    if (authModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setCustomUsername('');
      setShowDemoBox(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [authModalOpen]);

  if (!authModalOpen) return null;

  const handlePiOfficialLogin = async () => {
    await loginWithPi();
  };

  const handleCustomSubmit = async (e) => {
    e.preventDefault();
    if (!customUsername.trim()) return;
    await loginWithPi(customUsername.trim());
  };

  const handleCopyLink = () => {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : 'https://rentora-6zs.pages.dev';
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
            {l('ورود به شبکه پای (Pi Network)', 'Sign in with Pi Network', 'تسجيل الدخول عبر شبكة باي', 'Pi Network 官方登录')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {l('احراز هویت رسمی و بدون نیاز به کلمه عبور', 'Official passwordless Pioneer authentication', 'توثيق رسمي وآمن بدون كلمة مرور', '官方无密码安全授权认证')}
          </p>
        </div>

        {/* Error Alert */}
        {authError && (
          <div className="mb-3.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 stroke-[2] text-rose-600" />
            <span className="leading-relaxed font-medium">{authError}</span>
          </div>
        )}

        {/* CASE 1: INSIDE PI BROWSER (Native Official Login) */}
        {isInsidePiBrowser ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-[#E1F5EE] dark:bg-[#0B382C]/50 border border-[#48D2A8]/30 text-xs text-[#0F6E56] dark:text-[#48D2A8] font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{l('اتصال به Pi Browser برقرار است. با کلیک روی دکمه زیر وارد شوید.', 'Pi Browser detected. Tap below to authenticate.', 'متصفح باي متصل. اضغط للدخول بحسابك.', '已成功检测到 Pi 浏览器环境，点击下方按钮一键授权。')}</span>
            </div>

            <button
              onClick={handlePiOfficialLogin}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl btn-primary text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{l('در حال تایید در Pi Browser...', 'Waiting for Pi Browser...', 'جارٍ التحقق في متصفح باي...', '正在等待 Pi 浏览器授权...')}</span>
                </div>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 stroke-[2] text-emerald-300" />
                  <span>{l('ورود مستقیم با حساب رسمی پای', 'Authenticate with Pi Network', 'تسجيل الدخول بحساب باي الرسمي', '使用 Pi 官方账号直接登录')}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* CASE 2: OUTSIDE PI BROWSER (Inform user to open in Pi Browser) */
          <div className="space-y-3">
            
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-300/60 dark:border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <Smartphone className="w-4 h-4 shrink-0 text-amber-600" />
                <span>{l('نیاز به اجرای برنامه در Pi Browser', 'Requires Pi Browser', 'يتطلب فتح الموقع في متصفح باي', '需在 Pi Browser 中运行')}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                {l(
                  'جهت حفظ امنیت تراکنش‌ها و تایید هویت بلاکچینی (KYC)، ورود به رنتورا صرفاً از طریق اپلیکیشن Pi Browser انجام می‌شود.',
                  'To ensure transaction security and verified KYC Pioneer status, please open this app inside the official Pi Browser.',
                  'لضمان أمان المعاملات وتوثيق الهوية KYC، يرجى فتح رينتورا من داخل تطبيق متصفح باي الرسمي.',
                  '为保障交易安全与官方区块链实名认证（KYC），请在官方 Pi Browser 应用内打开此链接登录。'
                )}
              </p>
            </div>

            {/* Copy Link Button */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E1D33] text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 hover:border-[#534AB7] transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-[#0F6E56]" />
                  <span className="text-[#0F6E56]">{l('لینک کپی شد! در Pi Browser پیست کنید', 'Link Copied! Paste in Pi Browser', 'تم النسخ! الصقه في متصفح باي', '链接已复制！请在 Pi Browser 中粘贴打开')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#534AB7]" />
                  <span>{l('کپی آدرس سایت جهت باز کردن در Pi Browser', 'Copy Link to open in Pi Browser', 'نسخ رابط الموقع لفتحه في متصفح باي', '复制链接并在 Pi 浏览器中打开')}</span>
                </>
              )}
            </button>

            {/* Try Authenticate anyway button in case Pi Browser bridge is present */}
            <button
              onClick={handlePiOfficialLogin}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl btn-primary text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{l('تلاش برای اتصال به Pi SDK', 'Connect to Pi SDK', 'محاولة الاتصال بحساب باي', '尝试连接 Pi SDK')}</span>
                </>
              )}
            </button>

            {/* Test Demo Mode (Explicitly Marked as Unverified) */}
            <div className="pt-2 border-t border-slate-150 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDemoBox(!showDemoBox)}
                className="w-full text-center text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>{l('ورود آزمایشی پیش‌نمایش (بدون تگ KYC)', 'Demo Preview Login (Unverified)', 'دخول تجريبي للمعاينة (بدون توثيق)', '测试预览登录（无官方KYC标识）')}</span>
                {showDemoBox ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showDemoBox && (
                <form onSubmit={handleCustomSubmit} className="mt-2.5 space-y-2 animate-fadeIn">
                  <input
                    type="text"
                    value={customUsername}
                    onChange={(e) => setCustomUsername(e.target.value)}
                    placeholder="e.g. pioneer_tester"
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#121124] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7] text-center"
                    dir="ltr"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !customUsername.trim()}
                    className="w-full py-2 px-3 rounded-lg bg-slate-100 dark:bg-[#1E1D33] text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer hover:bg-slate-200 dark:hover:bg-[#26215C]"
                  >
                    {l('ورود تستی (احراز هویت نشده)', 'Continue as Demo (Unverified)', 'متابعة كحساب تجريبي', '以未认证测试身份进入')}
                  </button>
                </form>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
