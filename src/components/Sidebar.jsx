import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { usePiAuth } from '../context/PiAuthContext';
import { 
  X, 
  PlusCircle, 
  Clock, 
  Briefcase, 
  LayoutDashboard, 
  User, 
  Settings, 
  LogOut, 
  ShieldCheck, 
  ReceiptText, 
  Moon,
  Sun,
  Globe,
  ChevronDown,
  Check
} from 'lucide-react';

export default function Sidebar({ 
  currentTab = 'home', 
  onNavigate, 
  mobileOpen = false, 
  setMobileOpen
}) {
  const { lang, dir, t, l, changeLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { 
    currentUser, 
    isAuthenticated, 
    isAdmin, 
    logout, 
    setAuthModalOpen, 
    setIsWalletModalOpen 
  } = usePiAuth();

  const [langMenuOpen, setLangMenuOpen] = useState(false);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  if (!mobileOpen) return null;

  const handleNavClick = (tabId, params = null) => {
    if (typeof onNavigate === 'function') {
      onNavigate(tabId, params || {});
    }
    if (typeof setMobileOpen === 'function') {
      setMobileOpen(false);
    }
  };

  const getLanguageLabel = (code) => {
    switch (code) {
      case 'fa': return 'فارسی';
      case 'en': return 'English';
      case 'ar': return 'العربية';
      case 'zh': return '简体中文';
      default: return 'فارسی';
    }
  };

  const handleLogout = () => {
    logout();
    if (typeof setMobileOpen === 'function') {
      setMobileOpen(false);
    }
    if (typeof onNavigate === 'function') {
      onNavigate('home');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex animate-fadeIn select-none">
      
      {/* 1. Backdrop Overlay */}
      <div 
        onClick={() => setMobileOpen(false)}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer z-40"
      />

      {/* 2. Drawer Panel */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`fixed top-0 bottom-0 ${
          dir === 'rtl' ? 'right-0' : 'left-0'
        } w-[84vw] max-w-[320px] bg-white dark:bg-[#121124] border-l rtl:border-l-0 rtl:border-r border-slate-200/80 dark:border-slate-800/80 shadow-xl flex flex-col z-50 overflow-hidden`}
      >
        
        {/* Header: Logo + Close Button */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div 
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-[#26215C] dark:bg-[#534AB7] flex items-center justify-center text-white p-1.5 shrink-0">
              <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
                <circle cx="50" cy="38" r="22" stroke="#FFFFFF" strokeWidth="6"/>
                <path d="M38 38h24M43 38v34M57 38v34" stroke="#FFFFFF" strokeWidth="6"/>
                <circle cx="50" cy="20" r="5" fill="#FACC15"/>
              </svg>
            </div>
            <span className="font-semibold text-base text-[#26215C] dark:text-white leading-none">
              {t('appName')}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5 stroke-[1.8]" />
          </button>
        </div>

        {/* User Status Card */}
        <div className="p-3.5 bg-slate-50/70 dark:bg-[#16152B]/70 border-b border-slate-100 dark:border-slate-800/80">
          {isAuthenticated ? (
            <div className="space-y-2.5">
              <div 
                onClick={() => handleNavClick('profile')}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <img
                  src={currentUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.username}`}
                  alt={currentUser?.username}
                  className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 group-hover:border-[#534AB7] transition"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-xs text-slate-900 dark:text-white truncate group-hover:text-[#534AB7] transition" dir="ltr">
                    @{currentUser?.username}
                  </h4>
                  <div className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md mt-0.5 badge-trust">
                    <ShieldCheck className="w-3 h-3 stroke-[2]" />
                    <span>{t('badgeKycVerified')}</span>
                  </div>
                </div>
              </div>

              {/* Pi Ledger Button */}
              <button
                type="button"
                onClick={() => {
                  setIsWalletModalOpen(true);
                  setMobileOpen(false);
                }}
                className="w-full py-2 px-3 rounded-lg bg-white dark:bg-[#1D1C36] border border-slate-200/80 dark:border-slate-700/80 hover:border-[#534AB7] flex items-center justify-between text-xs transition cursor-pointer"
              >
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                  <ReceiptText className="w-3.5 h-3.5 text-[#534AB7] stroke-[1.8]" />
                  <span>{l('سوابق پرداخت (Pi Ledger)', 'Pi Payment Ledger', 'سجل معاملات باي', 'Pi 交易账本')}</span>
                </div>
                <span className="text-[10px] text-slate-400">❯</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-2 space-y-2">
              <p className="text-xs text-slate-500 font-medium">
                {l('برای ثبت آگهی و رزرو وارد شوید', 'Sign in to post and rent', 'سجل الدخول للنشر والحجز', '登录以发布或租用装备')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setAuthModalOpen(true);
                  setMobileOpen(false);
                }}
                className="btn-primary w-full py-2 px-3 text-xs font-semibold cursor-pointer"
              >
                {t('navLogin')}
              </button>
            </div>
          )}
        </div>

        {/* Main Menu Items */}
        <div className="p-3 overflow-y-auto flex-1 space-y-1 text-xs font-medium">
          
          {/* 1. ثبت آگهی کالا */}
          <button
            type="button"
            onClick={() => handleNavClick('list-item')}
            className="btn-primary w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all cursor-pointer mb-2 font-bold shadow-xs"
          >
            <PlusCircle className="w-4 h-4 stroke-[2]" />
            <span>{t('navListItem')}</span>
          </button>

          {/* 2. پنل موجر / کالاهای من */}
          <button
            type="button"
            onClick={() => handleNavClick('owner-hub')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
              currentTab === 'owner-hub'
                ? 'bg-[#EEEDFE] text-[#26215C] dark:bg-[#1E1B3D] dark:text-[#EEEDFE] font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1C1B30]'
            }`}
          >
            <Briefcase className="w-4 h-4 stroke-[1.8]" />
            <span>{t('navOwnerDashboard')}</span>
          </button>

          {/* 3. سفارشات و رزروهای من */}
          <button
            type="button"
            onClick={() => handleNavClick('activity')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
              currentTab === 'activity'
                ? 'bg-[#EEEDFE] text-[#26215C] dark:bg-[#1E1B3D] dark:text-[#EEEDFE] font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1C1B30]'
            }`}
          >
            <Clock className="w-4 h-4 stroke-[1.8]" />
            <span>{t('navActivity')}</span>
          </button>

          {/* 4. حساب کاربری و پروفایل */}
          <button
            type="button"
            onClick={() => handleNavClick('profile')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
              currentTab === 'profile'
                ? 'bg-[#EEEDFE] text-[#26215C] dark:bg-[#1E1B3D] dark:text-[#EEEDFE] font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1C1B30]'
            }`}
          >
            <User className="w-4 h-4 stroke-[1.8]" />
            <span>{t('navProfile')}</span>
          </button>

          {/* 5. پنل مدیریت رنتورا (Only visible to authorized admins) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => handleNavClick('admin')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
                currentTab === 'admin'
                  ? 'bg-[#26215C] text-white font-bold'
                  : 'text-[#534AB7] dark:text-[#AFA9EC] hover:bg-[#EEEDFE] dark:hover:bg-[#1E1B3D]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 stroke-[1.8]" />
              <span>{t('navAdmin')}</span>
            </button>
          )}

          {/* Divider */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 my-2"></div>

          {/* 6. تنظیمات (Central Settings Hub) */}
          <button
            type="button"
            onClick={() => handleNavClick('settings')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
              currentTab === 'settings'
                ? 'bg-[#EEEDFE] text-[#26215C] dark:bg-[#1E1B3D] dark:text-[#EEEDFE] font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1C1B30]'
            }`}
          >
            <Settings className="w-4 h-4 stroke-[1.8]" />
            <span>{t('navSettings')}</span>
          </button>

          {/* 7. خروج از حساب (Logout) */}
          {isAuthenticated && (
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer font-semibold mt-1"
            >
              <LogOut className="w-4 h-4 stroke-[1.8]" />
              <span>{t('navLogout')}</span>
            </button>
          )}

        </div>

        {/* Footer: Language Switcher Dropdown (fa, en, ar, zh) + Theme Toggle */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/70 dark:bg-[#16152B]/70 relative">
          
          {/* Language Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1D1C36] border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-[#534AB7] stroke-[1.8]" />
              <span>{getLanguageLabel(lang)}</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${langMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Language Picker Dropdown */}
            {langMenuOpen && (
              <div 
                className="absolute bottom-11 right-0 rtl:right-0 rtl:left-auto ltr:left-0 ltr:right-auto w-36 bg-white dark:bg-[#1C1B30] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 z-50 text-xs font-semibold animate-fadeIn"
              >
                <button
                  type="button"
                  onClick={() => { changeLanguage('fa'); setLangMenuOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-right cursor-pointer"
                >
                  <span>فارسی</span>
                  {lang === 'fa' && <Check className="w-3.5 h-3.5 text-[#534AB7]" />}
                </button>
                <button
                  type="button"
                  onClick={() => { changeLanguage('en'); setLangMenuOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-left cursor-pointer"
                >
                  <span>English</span>
                  {lang === 'en' && <Check className="w-3.5 h-3.5 text-[#534AB7]" />}
                </button>
                <button
                  type="button"
                  onClick={() => { changeLanguage('ar'); setLangMenuOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-right cursor-pointer"
                >
                  <span>العربية</span>
                  {lang === 'ar' && <Check className="w-3.5 h-3.5 text-[#534AB7]" />}
                </button>
                <button
                  type="button"
                  onClick={() => { changeLanguage('zh'); setLangMenuOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-left cursor-pointer"
                >
                  <span>简体中文</span>
                  {lang === 'zh' && <Check className="w-3.5 h-3.5 text-[#534AB7]" />}
                </button>
              </div>
            )}
          </div>

          {/* Theme Toggle Icon */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-white dark:bg-[#1D1C36] border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400 stroke-[1.8]" /> : <Moon className="w-4 h-4 text-slate-700 stroke-[1.8]" />}
          </button>

        </div>

      </div>
    </div>
  );
}
