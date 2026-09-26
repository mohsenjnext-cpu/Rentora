import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRentora } from '../context/RentoraContext';
import { Home, Search, Clock, User } from 'lucide-react';

export default function BottomNav({ currentTab, onNavigate }) {
  const { t } = useLanguage();
  const { rentals } = useRentora();
  const ACTIVE_RENTAL_STATUSES = new Set(['draft', 'pending_payment', 'payment_approved', 'confirmed', 'active', 'requested', 'accepted']);
  const activeRentalsCount = (rentals || []).filter(r => ACTIVE_RENTAL_STATUSES.has(String(r?.status || '').toLowerCase())).length;

  const navItems = [
    { id: 'home', label: t('navHome'), icon: Home },
    { id: 'discover', label: t('navDiscover'), icon: Search },
    { id: 'activity', label: t('navActivity'), icon: Clock, badge: activeRentalsCount },
    { id: 'profile', label: t('navProfile'), icon: User }
  ];

  return (
    <nav aria-label={t('navHome')} className="md:hidden fixed bottom-0 inset-x-0 z-40 pointer-events-none pb-2.5 px-3">
      <div className="max-w-md mx-auto h-[62px] rounded-[22px] bg-white/96 dark:bg-[#151426]/96 backdrop-blur-xl border border-slate-200/70 dark:border-slate-700/70 shadow-[0_10px_35px_rgba(30,30,47,0.14)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] pointer-events-auto px-1.5">
        <div className="h-full grid grid-cols-4 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                className={`relative flex flex-col items-center justify-center gap-1 rounded-[17px] transition-all duration-200 active:scale-95 cursor-pointer ${isActive ? 'text-[#26215C] dark:text-[#EEEDFE]' : 'text-[#8A8A9B] dark:text-slate-500'}`}
              >
                {isActive && <span className="absolute inset-x-3 top-1.5 h-8 rounded-[13px] bg-[#EEEDFE] dark:bg-[#292550]" />}
                <span className="relative z-10">
                  <Icon className={`w-[18px] h-[18px] ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
                  {item.badge > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[16px] h-[16px] rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center px-1 border-2 border-white dark:border-[#151426]">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span className={`relative z-10 text-[9px] leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
