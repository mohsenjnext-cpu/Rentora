import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { 
  X, 
  ShieldCheck, 
  Coins, 
  Sparkles, 
  AlertCircle, 
  Check, 
  ArrowRight,
  Lock
} from 'lucide-react';

export default function AuthModal() {
  const { lang, dir, t, l } = useLanguage();
  const { 
    isAuthModalOpen, 
    setAuthModalOpen, 
    loginWithPi, 
    loginWithTestnetPioneer, 
    isAuthenticating, 
    authError 
  } = usePiAuth();

  const [sandboxUsername, setSandboxUsername] = useState('');
  const [showSandboxInput, setShowSandboxInput] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSandboxSubmit = (e) => {
    e.preventDefault();
    if (sandboxUsername.trim()) {
      loginWithTestnetPioneer(sandboxUsername.trim());
    }
  };

  return (
    <div 
      onClick={() => setAuthModalOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn select-none"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#151426] rounded-2xl w-full max-w-sm flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl animate-scaleIn overflow-hidden"
      >
        
        {/* Header */}
        <div className="p-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#26215C] text-white flex items-center justify-center">
              <Coins className="w-4 h-4 text-amber-400 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {t('authModalTitle')}
              </h3>
              <p className="text-[10px] text-slate-400">
                {t('authModalSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAuthModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          
          {authError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl banner-purple space-y-1.5 text-center">
            <div className="w-10 h-10 mx-auto rounded-full bg-white/90 dark:bg-[#1E1B3D] text-[#534AB7] flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5 text-[#0F6E56] stroke-[2.2]" />
            </div>
            <h4 className="font-bold text-xs text-[#26215C] dark:text-white">
              {l('ورود مستقیم با شناسه پای', 'Sign in with Pi SDK', 'تسجيل الدخول المباشر بحساب باي', '使用 Pi SDK 原生免密登录')}
            </h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              {l('با یک کلیک و بدون نیاز به رمز عبور، با حساب احراز هویت شده پای خود وارد شوید.', 'Sign in securely with one tap using your KYC-verified Pi account.', 'سجل دخولك بنقرة واحدة وبأمان تام باستخدام حساب باي الموثق.', '一键安全授权，直接连接您的 KYC 认证 Pi 账户。')}
            </p>
          </div>

          {/* Primary Action: Pi Browser SDK Login */}
          <button
            type="button"
            disabled={isAuthenticating}
            onClick={loginWithPi}
            className="btn-primary w-full py-3 text-xs font-black cursor-pointer flex items-center justify-center gap-2 shadow-md"
          >
            <Coins className="w-4 h-4 text-amber-400" />
            <span>{isAuthenticating ? l('در حال اتصال به Pi Network...', 'Connecting to Pi Network...', 'جارٍ الاتصال بشبكة باي...', '正在连接 Pi Network...') : t('authBtnPiBrowser')}</span>
          </button>

          {/* Fallback / Pioneer Test Sandbox */}
          <div className="pt-2 border-t border-slate-150 dark:border-slate-800 space-y-2">
            {!showSandboxInput ? (
              <button
                type="button"
                onClick={() => setShowSandboxInput(true)}
                className="w-full text-center text-[11px] font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
              >
                {t('authBtnSandboxToggle')}
              </button>
            ) : (
              <form onSubmit={handleSandboxSubmit} className="space-y-2 pt-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  {l('نام کاربری پیشگام (تست‌نت / مرورگر عادی)', 'Pioneer username (sandbox / standard browser)', 'اسم مستخدم بايونير (بيئة الاختبار)', '先锋用户名（沙盒测试 / 外部浏览器）')}
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={sandboxUsername}
                    onChange={(e) => setSandboxUsername(e.target.value)}
                    placeholder="e.g. pioneer_2026"
                    className="flex-1 p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121124] text-slate-900 dark:text-white font-mono"
                    dir="ltr"
                  />
                  <button
                    type="submit"
                    className="btn-primary px-3 py-2 text-xs font-bold shrink-0 cursor-pointer"
                  >
                    {l('ورود', 'Sign In', 'دخول', '登录')}
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
