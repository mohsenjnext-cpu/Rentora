import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import {
  X, PlusCircle, Clock, Briefcase, LayoutDashboard, User, Settings,
  LogOut, ShieldCheck, ShieldAlert, ReceiptText, Moon, Sun, Globe,
  ChevronDown, Check, MessageSquare, Home, Search
} from 'lucide-react';

export default function Sidebar({
  currentTab = 'home',
  onNavigate,
  mobileOpen = false,
  setMobileOpen,
  onOpenChat,
  onOpenHelp,
  onOpenSecurity,
  onOpenSupport
}) {
  const { lang, dir, t, l, changeLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const {
    currentUser, isAuthenticated, isAdmin, logout,
    setAuthModalOpen, setIsWalletModalOpen
  } = usePiAuth();
  const { chats = [] } = useRentora();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const totalUnreadCount = (chats || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleNavClick = (tabId, params = {}) => {
    onNavigate?.(tabId, params);
    setMobileOpen?.(false);
  };

  const handleLogout = () => {
    logout();
    setMobileOpen?.(false);
    onNavigate?.('home');
  };

  const getLanguageLabel = (code) => ({
    fa: 'فارسی', en: 'English', ar: 'العربية', zh: '简体中文'
  }[code] || 'فارسی');

  const navItems = [
    { id: 'home', label: t('navHome'), icon: Home },
    { id: 'discover', label: t('navDiscover'), icon: Search },
    { id: 'owner-hub', label: t('navOwnerDashboard'), icon: Briefcase },
    { id: 'activity', label: t('navActivity'), icon: Clock },
    { id: 'profile', label: t('navProfile'), icon: User },
  ];

  const NavButton = ({ item }) => {
    const Icon = item.icon;
    const active = currentTab === item.id;
    return (
      <button type="button" onClick={() => handleNavClick(item.id)} aria-current={active ? 'page' : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
          active
            ? 'bg-[var(--purple-tint)] text-[var(--primary-dark)] dark:text-[var(--purple-accent)] font-bold shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/5'
        }`}>
        <Icon className="w-[17px] h-[17px] shrink-0" />
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  const Panel = ({ mobile = false }) => (
    <aside className={`rentora-sidebar-panel h-full w-[272px] bg-white/96 dark:bg-[#121124]/98 border-slate-200/80 dark:border-slate-800/80 flex flex-col shadow-sm ${
      mobile ? (dir === 'rtl' ? 'border-r' : 'border-l') : (dir === 'rtl' ? 'border-l' : 'border-r')
    }`}>
      <div className="h-16 px-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between shrink-0">
        <button type="button" onClick={() => handleNavClick('home')} aria-label={t('navHome')} aria-current={currentTab === 'home' ? 'page' : undefined} className="flex items-center gap-2.5 cursor-pointer">
          <div className="w-9 h-9 rounded-xl bg-[var(--primary-dark)] dark:bg-[var(--primary-mid)] flex items-center justify-center text-white p-1.5 shadow-sm">
            <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
              <circle cx="50" cy="38" r="22" stroke="currentColor" strokeWidth="6"/>
              <path d="M38 38h24M43 38v34M57 38v34" stroke="currentColor" strokeWidth="6"/>
              <circle cx="50" cy="20" r="5" fill="#FACC15"/>
            </svg>
          </div>
          <span className="font-bold text-base text-[var(--primary-dark)] dark:text-white">{t('appName')}</span>
        </button>
        {mobile && (
          <button type="button" onClick={() => setMobileOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer" aria-label={l('بستن منو','Close menu','إغلاق القائمة','关闭菜单')}>
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
        {isAuthenticated ? (
          <div className="rentora-sidebar-user rounded-2xl p-3 bg-slate-50 dark:bg-[#18172B]">
            <button type="button" onClick={() => handleNavClick('profile')} className="w-full flex items-center gap-3 text-start cursor-pointer">
              <img
                src={currentUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.username}`}
                alt={currentUser?.username || ''}
                className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold truncate" dir="ltr">@{currentUser?.username}</span>
                <span className={`inline-flex items-center gap-1 mt-1 text-[9px] font-semibold ${
                  currentUser?.kycStatus === 'verified' ? 'text-[var(--trust-text)]' : 'text-slate-500'
                }`}>
                  {currentUser?.kycStatus === 'verified'
                    ? <ShieldCheck className="w-3 h-3" />
                    : <ShieldAlert className="w-3 h-3" />}
                  {currentUser?.kycStatus === 'verified'
                    ? t('badgeKycVerified')
                    : l('احراز نشده','Unverified','غير موثق','未认证')}
                </span>
              </span>
            </button>
            <button type="button" onClick={() => { setIsWalletModalOpen(true); setMobileOpen(false); }}
              className="mt-2.5 w-full flex items-center justify-between px-2.5 py-2 rounded-xl bg-white dark:bg-[#211F39] border border-slate-200/80 dark:border-slate-700/80 text-[10px] font-semibold cursor-pointer hover:border-[var(--primary-mid)]">
              <span className="flex items-center gap-2"><ReceiptText className="w-3.5 h-3.5 text-[var(--primary-mid)]"/>{l('فعالیت‌های پای','Pi Activity & Ledger','نشاطات باي','Pi 交易账本')}</span>
              <span className="text-slate-400">›</span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl p-3 bg-slate-50 dark:bg-[#18172B] text-center">
            <p className="text-[10px] text-slate-500 mb-2">{l('برای ثبت آگهی و رزرو وارد شوید','Sign in to post and rent','سجل الدخول للنشر والحجز','登录以发布或租用装备')}</p>
            <button type="button" onClick={() => { setAuthModalOpen(true); setMobileOpen(false); }} className="btn-primary w-full py-2 text-xs cursor-pointer">{t('navLogin')}</button>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <button type="button" onClick={() => handleNavClick('list-item')}
          className="btn-primary w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold mb-2 cursor-pointer shadow-sm">
          <PlusCircle className="w-4 h-4"/>{t('navListItem')}
        </button>
        {navItems.map(item => <NavButton key={item.id} item={item} />)}

        <button type="button" onClick={() => { onOpenChat?.(); setMobileOpen(false); }} aria-label={t('chatTitle')} aria-current={currentTab === 'chat' ? 'page' : undefined}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
            currentTab === 'chat' ? 'bg-[var(--purple-tint)] text-[var(--primary-dark)] dark:text-[var(--purple-accent)] font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/5'
          }`}>
          <span className="flex items-center gap-3"><MessageSquare className="w-[17px] h-[17px] text-[var(--primary-mid)]"/>{t('chatTitle')}</span>
          {totalUnreadCount > 0 && <span className="min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center px-1">{totalUnreadCount}</span>}
        </button>

        {isAdmin && <button type="button" onClick={() => handleNavClick('admin')} aria-current={currentTab === 'admin' ? 'page' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs cursor-pointer ${
            currentTab === 'admin' ? 'bg-[var(--primary-dark)] text-white font-bold' : 'text-[var(--primary-mid)] hover:bg-[var(--purple-tint)] dark:hover:bg-[#1E1B3D]'
          }`}>
          <LayoutDashboard className="w-[17px] h-[17px]"/>{t('navAdmin')}
        </button>}

        <div className="my-2 border-t border-slate-100 dark:border-slate-800/80" />

        <NavButton item={{ id: 'settings', label: t('navSettings'), icon: Settings }} />

        {isAuthenticated && <button type="button" onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer">
          <LogOut className="w-[17px] h-[17px]"/>{t('navLogout')}
        </button>}
      </nav>

      <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-[#16152B]/80 flex items-center justify-between shrink-0">
        <div className="relative">
          <button type="button" onClick={() => setLangMenuOpen(v => !v)}
            aria-label={l('انتخاب زبان', 'Select language', 'اختيار اللغة', '选择语言')}
            aria-expanded={langMenuOpen}
            aria-haspopup="menu"
            className="px-2.5 py-2 rounded-xl bg-white dark:bg-[#211F39] border border-slate-200 dark:border-slate-700 text-[10px] font-semibold flex items-center gap-1.5 cursor-pointer">
            <Globe className="w-3.5 h-3.5 text-[var(--primary-mid)]"/>{getLanguageLabel(lang)}
            <ChevronDown className={`w-3 h-3 transition-transform ${langMenuOpen ? 'rotate-180' : ''}`}/>
          </button>
          {langMenuOpen && <div className="absolute bottom-12 start-0 w-36 rounded-xl bg-white dark:bg-[#1C1B30] border border-slate-200 dark:border-slate-700 shadow-xl py-1 z-50">
            {[
              ['fa','فارسی'],['en','English'],['ar','العربية'],['zh','简体中文']
            ].map(([code,label]) => (
              <button key={code} type="button" onClick={() => { changeLanguage(code); setLangMenuOpen(false); }}
                role="menuitemradio"
                aria-checked={lang === code}
                className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                <span>{label}</span>{lang === code && <Check className="w-3.5 h-3.5 text-[var(--primary-mid)]"/>}
              </button>
            ))}
          </div>}
        </div>
        <button type="button" onClick={toggleTheme} className="p-2 rounded-xl bg-white dark:bg-[#211F39] border border-slate-200 dark:border-slate-700 cursor-pointer" aria-label={l('تغییر پوسته', 'Toggle theme', 'تبديل المظهر', '切换主题')}>
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400"/> : <Moon className="w-4 h-4 text-slate-700"/>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden md:block fixed inset-y-0 start-0 z-40">
        <Panel />
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className={`absolute inset-y-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} shadow-2xl animate-fadeIn`}>
            <Panel mobile />
          </div>
        </div>
      )}
    </>
  );
}
