import React from 'react';
import { Settings, Globe, Moon, Sun, Shield, HelpCircle, Headphones, ReceiptText, LogOut, LogIn, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { usePiAuth } from '../context/PiAuthContext';
import RentoraCard from '../components/ui/RentoraCard';
import RentoraButton from '../components/ui/RentoraButton';

export default function SettingsRedesign({ onNavigate, onOpenHelp, onOpenSecurity, onOpenSupport }) {
  const { lang, dir, t, l, changeLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, setAuthModalOpen, setIsWalletModalOpen, logout } = usePiAuth();
  const Arrow = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const languages = [
    { code: 'fa', label: 'فارسی' },
    { code: 'en', label: 'English' },
    { code: 'ar', label: 'العربية' },
    { code: 'zh', label: '中文' }
  ];
  const open = (fn, ...args) => typeof fn === 'function' && fn(...args);
  const handleLogout = () => { logout(); open(onNavigate, 'home'); };

  const rows = [
    { icon: Shield, title: t('securityModalTitle'), text: l('احراز هویت و حریم خصوصی', 'Identity and privacy', 'الهوية والخصوصية', '身份与隐私'), action: () => open(onOpenSecurity) },
    { icon: HelpCircle, title: t('helpModalTitle'), text: l('قوانین، اجاره و تسویه', 'Rules, rental and settlement', 'القواعد والدفع', '规则、租赁与结算'), action: () => open(onOpenHelp, 'guide') },
    { icon: Headphones, title: t('supportModalTitle'), text: l('پشتیبانی و رسیدگی به گزارش‌ها', 'Support and reports', 'الدعم والبلاغات', '客服与申诉'), action: () => open(onOpenSupport) }
  ];

  return (
    <div dir={dir} className="max-w-2xl mx-auto pb-16 space-y-4 animate-fadeIn">
      <RentoraCard className="p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#534AB7] flex items-center justify-center"><Settings className="w-5 h-5" /></div>
          <div><h1 className="text-lg font-black text-slate-900 dark:text-white">{t('settingsTitle')}</h1><p className="text-xs text-slate-500">{t('settingsSubtitle')}</p></div>
        </div>
      </RentoraCard>

      <RentoraCard className="p-4 space-y-2">
        <h2 className="text-sm font-black text-slate-900 dark:text-white">{l('مرکز تنظیمات و امنیت', 'Settings & Security', 'الإعدادات والأمان', '设置与安全')}</h2>
        {rows.map(({ icon: Icon, title, text, action }) => (
          <button key={title} type="button" onClick={action} className="w-full min-h-11 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-3 text-start hover:border-[#534AB7] transition cursor-pointer">
            <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
            <span className="flex-1"><span className="block text-xs font-black text-slate-900 dark:text-white">{title}</span><span className="block text-[11px] text-slate-500 mt-0.5">{text}</span></span>
            <Arrow className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        ))}
        {isAuthenticated && (
          <button type="button" onClick={() => setIsWalletModalOpen(true)} className="w-full min-h-11 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-3 text-start cursor-pointer">
            <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><ReceiptText className="w-4 h-4" /></span>
            <span className="flex-1"><span className="block text-xs font-black text-slate-900 dark:text-white">{l('سوابق پرداخت و تراکنش‌ها', 'Pi Ledger & Transactions', 'سجل المعاملات', 'Pi 交易账本')}</span><span className="block text-[11px] text-slate-500">{l('مشاهده سوابق پرداخت ثبت‌شده', 'View recorded payment history', 'عرض سجل الدفع', '查看支付记录')}</span></span>
            <Arrow className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </RentoraCard>

      <RentoraCard className="p-4">
        <div className="flex items-center gap-2 mb-3"><Globe className="w-4 h-4 text-[#534AB7]" /><h2 className="text-sm font-black text-slate-900 dark:text-white">{t('settingsLanguage')}</h2></div>
        <div className="grid grid-cols-2 gap-2">
          {languages.map(({ code, label }) => <button key={code} type="button" onClick={() => changeLanguage(code)} className={`min-h-11 rounded-2xl border px-3 text-xs font-bold transition cursor-pointer ${lang === code ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#26215C]' : 'border-slate-200 dark:border-slate-800'}`}>{label}</button>)}
        </div>
      </RentoraCard>

      <RentoraCard className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2"><Sun className="w-4 h-4" /><span className="text-sm font-black text-slate-900 dark:text-white">{l('حالت ظاهری', 'Appearance', 'المظهر', '外观')}</span></div>
        <RentoraButton type="button" variant="secondary" onClick={toggleTheme} className="min-h-11">{theme === 'dark' ? <><Sun className="w-4 h-4" />{l('روشن', 'Light', 'فاتح', '浅色')}</> : <><Moon className="w-4 h-4" />{l('تاریک', 'Dark', 'داكن', '深色')}</>}</RentoraButton>
      </RentoraCard>

      <RentoraCard className="p-4">
        {isAuthenticated ? <RentoraButton type="button" variant="danger" onClick={handleLogout} className="w-full min-h-11 justify-center"><LogOut className="w-4 h-4" />{t('navLogout')}</RentoraButton> : <RentoraButton type="button" onClick={() => setAuthModalOpen(true)} className="w-full min-h-11 justify-center"><LogIn className="w-4 h-4" />{t('navLogin')}</RentoraButton>}
      </RentoraCard>
    </div>
  );
}
