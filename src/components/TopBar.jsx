import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { Menu, Search, ShieldCheck, Wallet, Sparkles } from 'lucide-react';

export default function TopBar({ onOpenSidebar, onNavigate }) {
  const { t, dir } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen, setIsWalletModalOpen } = usePiAuth();

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-white/90 dark:bg-[#12141C]/90 backdrop-blur-xl border-b border-gray-150 dark:border-gray-800 px-3.5 h-14 flex items-center justify-between shadow-xs">
      
      {/* Left: Menu Burger & Brand */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
          aria-label="Toggle Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button onClick={() => onNavigate('home')} className="flex items-center gap-2 cursor-pointer">
          <div className="w-7 h-7 rounded-lg brand-gradient flex items-center justify-center text-white font-bold p-1 overflow-hidden shadow-xs">
            <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
              <circle cx="50" cy="38" r="20" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round"/>
              <path d="M40 38h20" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round"/>
              <path d="M44 38v32M56 38v32" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round"/>
              <circle cx="50" cy="22" r="5" fill="#FACC15"/>
            </svg>
          </div>
          <span className="font-black text-base text-gray-900 dark:text-white tracking-tight">
            Rentora
          </span>
        </button>
      </div>

      {/* Right: Wallet Chip & Profile */}
      <div className="flex items-center gap-2">
        {isAuthenticated ? (
          <>
            {/* Pi Wallet Connection Chip */}
            <button
              onClick={() => setIsWalletModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#6D5DF5]/10 hover:bg-[#6D5DF5]/20 border border-[#6D5DF5]/30 text-[#6D5DF5] dark:text-[#A79BFA] font-bold text-xs transition cursor-pointer active:scale-95 shadow-xs"
              title={dir === 'rtl' ? 'کیف پول شبکه پای' : 'Pi Network Wallet'}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <Wallet className="w-3.5 h-3.5" />
              <span>{dir === 'rtl' ? 'کیف پول پای' : 'Pi Wallet'}</span>
            </button>

            {/* Profile Avatar */}
            <button
              onClick={() => onNavigate('profile')}
              className="flex items-center p-0.5 rounded-full border border-gray-200 dark:border-gray-700 cursor-pointer"
            >
              <img src={currentUser.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
            </button>
          </>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl brand-gradient text-white text-xs font-bold cursor-pointer"
          >
            {t('navLogin')}
          </button>
        )}
      </div>

    </header>
  );
}
