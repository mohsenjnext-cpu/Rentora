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
  LogIn,
  Lock,
  MessageSquare,
  Sparkles
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
        <div className="w-9 h-9 rounded-lg bg-[#26215C] text-white flex items-center justify-center shrink-0 shadow-sm">
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

      {/* 1. Help, Security & Support Sections (Primary Hub) */}
      <div className="p-4 rounded-xl rentora-card space-y-2.5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#534AB7]" />
            <span>{l('راهنما، امنیت و پشتیبانی رنتورا', 'Help, Security & Support', 'الدليل والأمان والدعم الفني', '使用指南、安全保障与服务支持')}</span>
          </h3>
        </div>

        {/* 1.1 امنیت (Security Center) */}
        <button
          type="button"
          onClick={() => {
            if (typeof onOpenSecurity === 'function') onOpenSecurity();
          }}
          className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#151426] hover:border-[#0F6E56] hover:bg-emerald-50/20 dark:hover:bg-[#0E241E]/30 flex items-center justify-between text-xs transition cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E1F5EE] dark:bg-[#0B382C] text-[#0F6E56] dark:text-[#48D2A8] flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Shield className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="text-right rtl:text-right ltr:text-left">
              <div className="font-bold text-slate-900 dark:text-white text-xs">
                {t('securityModalTitle')}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {l('احراز هویت غیرمتمرکز، تایید دوطرفه و حفظ حریم خصوصی', 'Decentralized auth, two-way confirmation & privacy', 'المصادقة اللامركزية وحماية الخصوصية', '去中心化鉴权、双向交接确认与隐私保护')}
              </p>
            </div>
          </div>
          {dir === 'rtl' ? <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-[#0F6E56] transition shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0F6E56] transition shrink-0" />}
        </button>

        {/* 1.2 قوانین و راهنما (Rules & Help Center) */}
        <button
          type="button"
          onClick={() => {
            if (typeof onOpenHelp === 'function') onOpenHelp('guide');
          }}
          className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#151426] hover:border-[#534AB7] hover:bg-purple-50/20 dark:hover:bg-[#1E1B3D]/30 flex items-center justify-between text-xs transition cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#EEEDFE] dark:bg-[#26215C] text-[#534AB7] dark:text-[#EEEDFE] flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <HelpCircle className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="text-right rtl:text-right ltr:text-left">
              <div className="font-bold text-slate-900 dark:text-white text-xs">
                {t('helpModalTitle')}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {l('راهنمای تسویه، قوانین اجاره و ضوابط ودیعه نقدی', 'Settlement structure, rental rules & deposit terms', 'هيكلية الدفع وقوانين التأمين النقدي', '费用拆分说明、租赁规则与押金安全')}
              </p>
            </div>
          </div>
          {dir === 'rtl' ? <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-[#534AB7] transition shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#534AB7] transition shrink-0" />}
        </button>

        {/* 1.3 بخش پشتیبانی (Support & Helpdesk) */}
        <button
          type="button"
          onClick={() => {
            if (typeof onOpenSupport === 'function') onOpenSupport();
          }}
          className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#151426] hover:border-amber-400 hover:bg-amber-50/20 dark:hover:bg-[#2D2415]/30 flex items-center justify-between text-xs transition cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Headphones className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="text-right rtl:text-right ltr:text-left">
              <div className="font-bold text-slate-900 dark:text-white text-xs">
                {t('supportModalTitle')}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {l('ارسال تیکت، ارتباط با تیم فنی و رسیدگی به گزارش‌ها', 'Submit ticket, contact tech team & report review', 'إرسال تذكرة والتواصل مع الفريق الفني', '提交工单、联系在线客服与纠纷申诉')}
              </p>
            </div>
          </div>
          {dir === 'rtl' ? <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition shrink-0" />}
        </button>

        {/* 1.4 سوابق پرداخت (Pi Ledger) */}
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => {
              if (typeof setIsWalletModalOpen === 'function') setIsWalletModalOpen(true);
            }}
            className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#151426] hover:border-slate-400 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 transition cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                <ReceiptText className="w-4 h-4 stroke-[2]" />
              </div>
              <div className="text-right rtl:text-right ltr:text-left">
                <div className="font-bold text-slate-900 dark:text-white text-xs">
                  {l('سوابق پرداخت و تراکنش‌ها (Pi Ledger)', 'Pi Ledger & Transactions', 'سجل معاملات باي', 'Pi 交易账本')}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {l('مشاهده تراکنش‌های ثبت‌شده در بلاکچین پای', 'View blockchain transactions history', 'عرض سجل المعاملات على البلوكشين', '查看链上交易记录与支付凭单')}
                </p>
              </div>
            </div>
            {dir === 'rtl' ? <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
          </button>
        )}
      </div>

      {/* 2. Language Selection */}
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

      {/* 3. Theme / Appearance Switcher */}
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
