import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { ShieldCheck, X, AlertCircle, Coins, ArrowLeft, ArrowRight, UserCheck } from 'lucide-react';

export default function PiAuthModal() {
  const { lang, dir, t, l } = useLanguage();
  const { authModalOpen, setAuthModalOpen, loginWithPi, isLoading, authError } = usePiAuth();
  const [customUsername, setCustomUsername] = useState('');

  useEffect(() => {
    if (authModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setCustomUsername('');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn select-none">
      <div className="relative w-full max-w-md bg-white dark:bg-[#151426] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden p-5 sm:p-6">
        
        {/* Close Button */}
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-4 right-4 rtl:right-auto rtl:left-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#26215C] text-white mb-2 shadow-xs p-2">
            <Coins className="w-6 h-6 text-amber-400" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            {l('احراز هویت در شبکه پای (Pi Network)', 'Pi Network Authentication', 'المصادقة عبر شبكة باي', 'Pi Network 身份认证')}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {l('درگاه سریع و ایمن ورود پیشگامان شبکه پای', 'Fast & secure authentication for Pi Pioneers', 'بوابة سريعة وآمنة للرواد للدخول', 'Pi 先锋快速安全登录通道')}
          </p>
        </div>

        {authError && (
          <div className="mb-3.5 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 stroke-[2]" />
            <span className="leading-relaxed">{authError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          
          {/* 1. Official Pi SDK Login Button */}
          <button
            onClick={handlePiOfficialLogin}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl btn-primary text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 stroke-[2]" />
                <span>{l('ورود خودکار با Pi Browser', 'Connect with Pi Browser', 'اتصال عبر متصفح باي', '通过 Pi 浏览器一键登录')}</span>
              </>
            )}
          </button>

          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-slate-200 dark:border-slate-800 w-full"></div>
            <span className="bg-white dark:bg-[#151426] px-2.5 text-[10px] text-slate-400 uppercase font-bold">
              {l('یا وارد کردن نام کاربری پای', 'Or Enter Pioneer Username', 'أو أدخل اسم المستخدم', '或输入 Pi 用户名登录')}
            </span>
          </div>

          {/* 2. Direct Username Input Form */}
          <form onSubmit={handleCustomSubmit} className="space-y-2">
            <input
              type="text"
              value={customUsername}
              onChange={(e) => setCustomUsername(e.target.value)}
              placeholder="e.g. avina60 or pioneer_2026"
              className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1E1D33] text-slate-900 dark:text-white focus:outline-none focus:border-[#5848E8] text-center font-mono"
              dir="ltr"
            />

            <button
              type="submit"
              disabled={isLoading || !customUsername.trim()}
              className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#5848E8] text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#534AB7]" />
              <span>{l('ورود با این شناسه کاربری', 'Continue with this Username', 'متابعة بهذا الاسم', '以此用户名快速进入')}</span>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
