import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { 
  Plus, 
  Moon, 
  Sun, 
  ReceiptText, 
  Menu, 
  ShieldCheck, 
  User, 
  LayoutDashboard,
  MessageSquare,
  RotateCw,
  Check
} from 'lucide-react';

export default function Header({ onNavigate, currentPage, onOpenSidebar, onOpenChat }) {
  const { t, dir, l } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { 
    currentUser, 
    isAuthenticated, 
    isAdmin, 
    setAuthModalOpen, 
    setIsWalletModalOpen 
  } = usePiAuth();
  const { chats = [], isRefreshing, refreshApp } = useRentora();

  const [refreshToast, setRefreshToast] = useState(false);

  const totalUnreadCount = (chats || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const handleManualRefresh = async () => {
    if (refreshApp) {
      await refreshApp();
      setRefreshToast(true);
      setTimeout(() => setRefreshToast(false), 2000);
    }
  };

  const getPageTitle = (page) => {
    switch (page) {
      case 'home': return t('appName');
      case 'discover': return t('navDiscover');
      case 'item-detail': return t('itemDetailsTitle');
      case 'list-item': return t('navPostItem');
      case 'owner-hub': return t('navOwnerHub');
      case 'activity': return t('navActivity');
      case 'profile': return t('navProfile');
      case 'public-profile': return t('profileTitle');
      case 'admin': return t('navAdmin');
      case 'settings': return t('navSettings');
      default: return t('appName');
    }
  };

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* 1. DESKTOP HEADER (Desktop Viewport Only)                     */}
      {/* ------------------------------------------------------------- */}
      <header className="hidden md:block sticky top-0 z-40 bg-white/95 dark:bg-[#121124]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          
          {/* Logo + Horizontal Nav Links */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2 focus:outline-none cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-[#26215C] dark:bg-[#534AB7] flex items-center justify-center text-white p-1.5 shrink-0 shadow-xs">
                <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
                  <circle cx="50" cy="38" r="22" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round"/>
                  <path d="M38 38h24" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round"/>
                  <path d="M43 38v34M57 38v34" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round"/>
                  <circle cx="50" cy="20" r="5" fill="#FACC15"/>
                </svg>
              </div>
              <span className="font-semibold text-lg text-[#26215C] dark:text-white tracking-tight">
                {t('appName')}
              </span>
            </button>

            {/* Horizontal Nav Links */}
            <nav className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  currentPage === 'home'
                    ? 'bg-[#EEEDFE] text-[#26215C] dark:bg-[#1E1B3D] dark:text-[#EEEDFE] font-bold'
                    : 'hover:text-[#26215C] dark:hover:text-white'
                }`}
              >
                {t('navHome')}
              </button>

              <button
                type="button"
                onClick={() => onNavigate('discover')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  currentPage === 'discover'
                    ? 'bg-[#EEEDFE] text-[#26215C] dark:bg-[#1E1B3D] dark:text-[#EEEDFE] font-bold'
                    : 'hover:text-[#26215C] dark:hover:text-white'
                }`}
              >
                {t('navDiscover')}
              </button>

              <button
                type="button"
                onClick={() => onNavigate('owner-hub')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  currentPage === 'owner-hub'
                    ? 'bg-[#EEEDFE] text-[#26215C] dark:bg-[#1E1B3D] dark:text-[#EEEDFE] font-bold'
                    : 'hover:text-[#26215C] dark:hover:text-white'
                }`}
              >
                {t('navOwnerHub')}
              </button>

              <button
                type="button"
                onClick={() => onNavigate('activity')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  currentPage === 'activity'
                    ? 'bg-[#EEEDFE] text-[#26215C] dark:bg-[#1E1B3D] dark:text-[#EEEDFE] font-bold'
                    : 'hover:text-[#26215C] dark:hover:text-white'
                }`}
              >
                {t('navActivity')}
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onNavigate('admin')}
                  className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                    currentPage === 'admin'
                      ? 'bg-[#26215C] text-white font-bold'
                      : 'text-[#534AB7] dark:text-[#AFA9EC] hover:bg-[#EEEDFE] dark:hover:bg-[#1E1B3D]'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5 stroke-[1.8]" />
                  <span>{t('navAdmin')}</span>
                </button>
              )}
            </nav>
          </div>

          {/* Right Actions (Desktop) */}
          <div className="flex items-center gap-2.5">
            
            {/* Primary "ثبت آگهی" button */}
            <button
              type="button"
              onClick={() => onNavigate('list-item')}
              className="btn-primary flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{t('navPostItem')}</span>
            </button>

            {/* In-App Refresh Button */}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className={`p-2 rounded-lg bg-slate-100 dark:bg-[#1C1B30] text-slate-700 dark:text-slate-200 hover:bg-[#EEEDFE] dark:hover:bg-[#1E1B3D] transition cursor-pointer ${
                isRefreshing ? 'opacity-60' : ''
              }`}
              title={l('به‌روزرسانی داده‌ها', 'Refresh Data', 'تحديث البيانات', '刷新数据')}
            >
              <RotateCw className={`w-4 h-4 text-[#534AB7] dark:text-[#AFA9EC] stroke-[2] ${isRefreshing ? 'animate-spin text-[#26215C]' : ''}`} />
            </button>

            {/* In-App Chat / Messages Icon */}
            <button
              type="button"
              onClick={onOpenChat}
              className="relative p-2 rounded-lg bg-slate-100 dark:bg-[#1C1B30] text-slate-700 dark:text-slate-200 hover:bg-[#EEEDFE] dark:hover:bg-[#1E1B3D] transition cursor-pointer"
              title={t('chatTitle')}
            >
              <MessageSquare className="w-4 h-4 text-[#534AB7] dark:text-[#AFA9EC] stroke-[1.8]" />
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                  {totalUnreadCount}
                </span>
              )}
            </button>

            {/* Pi Activity & Ledger Icon */}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setIsWalletModalOpen(true)}
                className="p-2 rounded-lg bg-slate-100 dark:bg-[#1C1B30] text-slate-700 dark:text-slate-200 hover:bg-[#EEEDFE] dark:hover:bg-[#1E1B3D] transition cursor-pointer"
                title={l('فعالیت‌ها و تراکنش‌های پای (Pi Activity)', 'Pi Activity & Ledger', 'نشاطات باي', 'Pi 链上账本')}
              >
                <ReceiptText className="w-4 h-4 text-[#26215C] dark:text-[#EEEDFE] stroke-[1.8]" />
              </button>
            )}

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-100 dark:bg-[#1C1B30] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400 stroke-[1.8]" /> : <Moon className="w-4 h-4 text-slate-700 stroke-[1.8]" />}
            </button>

            {/* User Avatar */}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                  <img
                    src={currentUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.username}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="btn-secondary px-3 py-1.5 text-xs font-semibold cursor-pointer"
              >
                <span>{t('navLogin')}</span>
              </button>
            )}
          </div>

        </div>

        {/* Refresh Toast */}
        {refreshToast && (
          <div className="bg-[#0F6E56] text-white text-[11px] py-1 px-3 text-center font-bold flex items-center justify-center gap-1 animate-fadeIn">
            <Check className="w-3.5 h-3.5" />
            <span>{l('داده‌های پلتفرم با موفقیت به‌روزرسانی شد.', 'Data refreshed successfully.', 'تم تحديث البيانات بنجاح.', '平台数据已成功刷新。')}</span>
          </div>
        )}
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. MOBILE TOP BAR (Thin bar on every page)                    */}
      {/* ------------------------------------------------------------- */}
      <div className="md:hidden sticky top-0 z-40 bg-white/95 dark:bg-[#0E0D1B]/95 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 px-3.5 h-12 flex items-center justify-between">
        
        {/* Hamburger Icon */}
        <button
          type="button"
          onClick={onOpenSidebar}
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Open Menu"
        >
          <Menu className="w-5 h-5 stroke-[1.8]" />
        </button>

        {/* Page Title or Logo Centered */}
        {currentPage === 'home' ? (
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-[#26215C] dark:bg-[#534AB7] flex items-center justify-center text-white p-1">
              <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
                <circle cx="50" cy="38" r="22" stroke="#FFFFFF" strokeWidth="6"/>
                <path d="M38 38h24M43 38v34M57 38v34" stroke="#FFFFFF" strokeWidth="6"/>
                <circle cx="50" cy="20" r="5" fill="#FACC15"/>
              </svg>
            </div>
            <span className="font-bold text-sm text-[#26215C] dark:text-white tracking-tight">
              {t('appName')}
            </span>
          </div>
        ) : (
          <h1 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate px-2">
            {getPageTitle(currentPage)}
          </h1>
        )}

        {/* Mobile Right Icons: Refresh, Chat, Avatar */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleManualRefresh}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Refresh App"
          >
            <RotateCw className={`w-4 h-4 text-[#534AB7] stroke-[2] ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onOpenChat}
            className="relative p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Messages"
          >
            <MessageSquare className="w-4 h-4 stroke-[1.8] text-[#534AB7]" />
            {totalUnreadCount > 0 && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => isAuthenticated ? onNavigate('profile') : setAuthModalOpen(true)}
            className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center justify-center bg-slate-100 dark:bg-slate-800"
          >
            {isAuthenticated && currentUser?.avatar ? (
              <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-slate-500 stroke-[1.8]" />
            )}
          </button>
        </div>

      </div>
    </>
  );
}
