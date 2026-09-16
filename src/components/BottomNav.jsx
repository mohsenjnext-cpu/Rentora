import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRentora } from '../context/RentoraContext';
import { Home, Search, Clock, User } from 'lucide-react';

export default function BottomNav({ currentTab, onNavigate }) {
  const { t } = useLanguage();
  const { rentals } = useRentora();
  const activeRentalsCount = (rentals || []).filter(r => r.status === 'active' || r.status === 'confirmed' || r.status === 'awaiting_payment').length;

  const navItems = [
    { id: 'home', label: t('navHome'), icon: Home },
    { id: 'discover', label: t('navDiscover'), icon: Search },
    { id: 'activity', label: t('navActivity'), icon: Clock, badge: activeRentalsCount },
    { id: 'profile', label: t('navProfile'), icon: User }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-12 bg-white/98 dark:bg-[#121124]/98 backdrop-blur-md border-t border-[#E4E4EC] dark:border-slate-800/80 pb-safe">
      <div className="max-w-md mx-auto h-full grid grid-cols-4 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button key={item.id} type="button" onClick={() => onNavigate(item.id)} className={`relative flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95 transition-transform ${isActive ? 'text-[#534AB7] dark:text-[#AFA9EC]' : 'text-[#8A8A9B] dark:text-slate-500'}`}>
              <span className="relative">
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
                {item.badge > 0 && <span className="absolute -top-1.5 -right-2 min-w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[7px] font-bold flex items-center justify-center px-0.5">{item.badge}</span>}
              </span>
              <span className={`text-[9px] leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
