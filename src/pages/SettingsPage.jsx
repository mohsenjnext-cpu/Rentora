import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { usePiAuth } from '../context/PiAuthContext';
import { 
  Settings, 
  Globe, 
  Moon, 
  Sun, 
  ShieldCheck, 
  Check, 
  ChevronLeft, 
  ChevronRight,
  HelpCircle,
  FileText,
  Shield,
  Headphones,
  ReceiptText,
  LogOut,
  User,
  LogIn
} from 'lucide-react';

export default function SettingsPage({ 
  onNavigate, 
  onOpenHelp, 
  onOpenSecurity, 
  onOpenSupport 
}) {
  const { lang, dir, t, l, changeLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { 
    currentUser, 
    isAuthenticated, 
    setAuthModalOpen, 
    setIsWalletModalOpen, 
    logout 
  } = usePiAuth();

  const languages = [
    { code: 'fa', name: 'فارسی (Persian)', native: 'فارسی' },
    { code: 'en', name: 'English (US)', native: 'English' },
    { code: 'ar', name: 'العربية (Arabic)', native: 'العربية' },
    { code: 'zh', name: '中文 (Chinese)', native: '中文' }
  ];

  const handleLogout = () => {
    logout();
    if (typeof onNavigate === 'function') {
      onNavigate('home');
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-16 select-none animate-fadeIn">
      
      {/* Header */}
      <div className="flex items-center gap-2.5 p-4 rounded-xl rentora-card">
        <div className="w-9 h-9 rounded-lg bg-[#26215C] text-white flex items-center justify-center shrink-0">
          <Settings className="w-5 h-5 stroke-[2]" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white">
            {t('settingsTitle')}
          </h1>
          <p className="text-[11px] text-slate-400">
            {t('settingsSubtitle')}
          </p>
        </div>
      </div>

      {/* 1. Language Selection */}
      <div className="p-4 rounded-xl rentora-card space-y-3">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
          <Globe className="w-4 h-4 text-[#534AB7]" />
          <span>{t('settingsLanguage')}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {languages.map((lng) => {
            const isSelected = lang === lng.code;
            return (
              <button
                key={lng.code}
                type="button"
                onClick={() => changeLanguage(lng.code)}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                  isSelected
                    ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#26215C] text-[#26215C] dark:text-white shadow-xs font-bold'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-700 dark:text-slate-300 hover:border-[#534AB7]'
                }`}
              >
                <span>{lng.name}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#534AB7] dark:text-white stroke-[2.5]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Theme / Appearance Switcher */}
      <div className="p-4 rounded-xl rentora-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
            {theme === 'dark' ? <Moon className="w-4 h-4 text-[#534AB7]" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <span>{l('حالت شب و روز (تم ظاهری)', 'Theme Appearance', 'المظهر والوضع الليلي', '主题与外观模式')}</span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              theme === 'dark'
                ? 'bg-[#1D1C36] border-slate-700 text-amber-400'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 stroke-[2]" />
                <span>{l('روشن', 'Light', 'فاتح', '浅色')}</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 stroke-[2]" />
                <span>{l('تاریک', 'Dark', 'داكن', '深色')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Help, Security & Support Links */}
      <div className="p-4 rounded-xl rentora-card space-y-2">
        <h3 className="font-bold text-xs text-slate-900 dark:text-white mb-2">
          {t('menuSupport')}
        </h3>

        {/* Security Modal Trigger */}
        <button
          type="button"
          onClick={() => {
            if (typeof onOpenSecurity === 'function') onOpenSecurity();
          }}
          className="w-full p-2.5 rounded-lg border border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#1A1930] flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 transition cursor-pointer"
        >
          <span className="flex items-center gap-2 font-medium">
            <Shield className="w-4 h-4 text-[#0F6E56]" />
            <span>{t('securityModalTitle')}</span>
          </span>
          {dir === 'rtl' ? <ChevronLeft className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </button>

        {/* Support Modal Trigger */}
        <button
          type="button"
          onClick={() => {
            if (typeof onOpenSupport === 'function') onOpenSupport();
          }}
          className="w-full p-2.5 rounded-lg border border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#1A1930] flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 transition cursor-pointer"
        >
          <span className="flex items-center gap-2 font-medium">
            <Headphones className="w-4 h-4 text-[#534AB7]" />
            <span>{t('supportModalTitle')}</span>
          </span>
          {dir === 'rtl' ? <ChevronLeft className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </button>

        {/* Help & Rules Modal Trigger */}
        <button
          type="button"
          onClick={() => {
            if (typeof onOpenHelp === 'function') onOpenHelp('guide');
          }}
          className="w-full p-2.5 rounded-lg border border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#1A1930] flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 transition cursor-pointer"
        >
          <span className="flex items-center gap-2 font-medium">
            <HelpCircle className="w-4 h-4 text-[#534AB7]" />
            <span>{t('helpModalTitle')}</span>
          </span>
          {dir === 'rtl' ? <ChevronLeft className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </button>

        {/* Pi Ledger Trigger */}
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => {
              if (typeof setIsWalletModalOpen === 'function') setIsWalletModalOpen(true);
            }}
            className="w-full p-2.5 rounded-lg border border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#1A1930] flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 transition cursor-pointer"
          >
            <span className="flex items-center gap-2 font-medium">
              <ReceiptText className="w-4 h-4 text-amber-500" />
              <span>{l('سوابق پرداخت و تراکنش‌ها (Pi Ledger)', 'Pi Ledger & Transactions', 'سجل معاملات باي', 'Pi 交易账本')}</span>
            </span>
            {dir === 'rtl' ? <ChevronLeft className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </button>
        )}
      </div>

      {/* 4. Account Actions: Logout or Login */}
      <div className="p-4 rounded-xl rentora-card">
        {isAuthenticated ? (
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('navLogout')}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="btn-primary w-full py-2.5 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
          >
            <LogIn className="w-4 h-4" />
            <span>{t('navLogin')}</span>
          </button>
        )}
      </div>

    </div>
  );
}
