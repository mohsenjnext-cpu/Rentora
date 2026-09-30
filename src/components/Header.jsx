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
  Bell, 
  Menu, 
  User, 
  MessageSquare,
  RotateCw,
  Check
} from 'lucide-react';

export default function Header({ onNavigate, currentPage, onOpenSidebar, onOpenChat }) {
  const { t, l } = useLanguage();
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
      case 'home': return '';
      case 'discover': return t('navDiscover');
      case 'item-detail': return t('itemDetailsTitle');
      case 'list-item': return t('navPostItem');
      case 'owner-hub': return t('navOwnerHub');
      case 'activity': return t('navActivity');
      case 'profile': return t('navProfile');
      case 'public-profile': return t('profileTitle');
      case 'admin': return t('navAdmin');
      case 'settings': return t('navSettings');
      case 'notifications': return l('اعلان‌ها', 'Notifications', 'الإشعارات', '通知');
      case 'chat': return l('پیام‌ها', 'Messages', 'الرسائل', '消息');
      default: return t('appName');
    }
  };

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* 1. DESKTOP HEADER (Desktop Viewport Only)                     */}
      {/* ------------------------------------------------------------- */}
      <header className="hidden md:block sticky top-0 z-30 bg-white/92 dark:bg-[#121124]/92 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/70 transition-colors">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          
          {/* Current section title. Primary desktop navigation lives in the Sidebar. */}
          <div className="min-w-0 flex items-center">
            <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate">{getPageTitle(currentPage)}</h1>
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
              aria-label={l('به‌روزرسانی داده‌ها', 'Refresh data', 'تحديث البيانات', '刷新数据')}
            >
              <RotateCw className={`w-4 h-4 text-[#534AB7] dark:text-[#AFA9EC] stroke-[2] ${isRefreshing ? 'animate-spin text-[#26215C]' : ''}`} />
            </button>

            <button type="button" onClick={() => onNavigate('notifications')} className={`relative p-2 rounded-lg transition cursor-pointer ${currentPage === 'notifications' ? 'bg-[#EEEDFE] text-[#26215C] dark:bg-[#1E1B3D] dark:text-[#EEEDFE]' : 'bg-slate-100 dark:bg-[#1C1B30] text-slate-700 dark:text-slate-200 hover:bg-[#EEEDFE] dark:hover:bg-[#1E1B3D]'}`} aria-label={l('اعلان‌ها', 'Notifications', 'الإشعارات', '通知')} aria-current={currentPage === 'notifications' ? 'page' : undefined}><Bell className="w-4 h-4 text-[#534AB7] dark:text-[#AFA9EC] stroke-[1.8]" /></button>

            {/* In-App Chat / Messages Icon */}
            <button
              type="button"
              onClick={onOpenChat}
              className={`relative p-2 rounded-lg transition cursor-pointer ${currentPage === 'chat' ? 'bg-[#EEEDFE] text-[#26215C] dark:bg-[#1E1B3D] dark:text-[#EEEDFE]' : 'bg-slate-100 dark:bg-[#1C1B30] text-slate-700 dark:text-slate-200 hover:bg-[#EEEDFE] dark:hover:bg-[#1E1B3D]'}`}
              aria-label={t('chatTitle')}
              aria-current={currentPage === 'chat' ? 'page' : undefined}
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
              aria-label={l('تغییر پوسته', 'Toggle theme', 'تبديل المظهر', '切换主题')}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400 stroke-[1.8]" /> : <Moon className="w-4 h-4 text-slate-700 stroke-[1.8]" />}
            </button>

            {/* User Avatar */}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                aria-label={t('navProfile')}
                aria-current={currentPage === 'profile' ? 'page' : undefined}
                className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                  {currentUser?.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-4 h-4 text-slate-500 stroke-[1.8] mx-auto mt-2" />
                  )}
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
          aria-label={l('باز کردن منو', 'Open menu', 'فتح القائمة', '打开菜单')}
        >
          <Menu className="w-5 h-5 stroke-[1.8]" />
        </button>

        {/* Home has no centered brand. Other pages keep their section title. */}
        {currentPage !== 'home' ? (
          <h1 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate px-2">
            {getPageTitle(currentPage)}
          </h1>
        ) : <span aria-hidden="true" className="w-1" />}

        {/* Mobile Right Icons: Refresh, Chat, Avatar */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleManualRefresh}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label={l('به‌روزرسانی برنامه', 'Refresh app', 'تحديث التطبيق', '刷新应用')}
          >
            <RotateCw className={`w-4 h-4 text-[#534AB7] stroke-[2] ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <button type="button" onClick={() => onNavigate('notifications')} className={`relative p-1.5 rounded-lg cursor-pointer ${currentPage === 'notifications' ? 'bg-[#EEEDFE] text-[#26215C] dark:bg-[#1E1B3D] dark:text-[#EEEDFE]' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`} aria-label={l('اعلان‌ها', 'Notifications', 'الإشعارات', '通知')} aria-current={currentPage === 'notifications' ? 'page' : undefined}><Bell className="w-4 h-4 stroke-[1.8] text-[#534AB7]" /></button>

          <button
            type="button"
            onClick={onOpenChat}
            className={`relative p-1.5 rounded-lg cursor-pointer ${currentPage === 'chat' ? 'bg-[#EEEDFE] text-[#26215C] dark:bg-[#1E1B3D] dark:text-[#EEEDFE]' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            aria-label={t('chatTitle')}
            aria-current={currentPage === 'chat' ? 'page' : undefined}
          >
            <MessageSquare className="w-4 h-4 stroke-[1.8] text-[#534AB7]" />
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] bg-rose-500 text-white rounded-full text-[8px] font-bold flex items-center justify-center px-0.5 border border-white dark:border-[#0E0D1B]">
                {totalUnreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => isAuthenticated ? onNavigate('profile') : setAuthModalOpen(true)}
            aria-label={isAuthenticated ? t('navProfile') : t('navLogin')}
            aria-current={isAuthenticated && currentPage === 'profile' ? 'page' : undefined}
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
