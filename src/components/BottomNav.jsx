import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRentora } from '../context/RentoraContext';
import { 
  Home, 
  Compass, 
  Plus, 
  Briefcase, 
  Clock 
} from 'lucide-react';

export default function BottomNav({ currentTab, onNavigate }) {
  const { t } = useLanguage();
  const { rentals } = useRentora();

  const activeRentalsCount = (rentals || []).filter(
    r => r.status === 'active' || r.status === 'confirmed' || r.status === 'awaiting_payment'
  ).length;

  const navItems = [
    { id: 'home', label: t('navHome'), icon: Home },
    { id: 'discover', label: t('navDiscover'), icon: Compass },
    { id: 'list-item', label: t('navPostItem'), icon: Plus, isAction: true },
    { id: 'owner-hub', label: t('navOwnerHub'), icon: Briefcase },
    { id: 'activity', label: t('navActivity'), icon: Clock, badge: activeRentalsCount }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/98 dark:bg-[#121124]/98 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 pb-safe">
      <div className="max-w-md mx-auto px-3 h-14 flex items-center justify-between">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          if (item.isAction) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-label={item.label}
                className="flex flex-col items-center justify-center -mt-5 group focus:outline-none cursor-pointer active:scale-95 transition-transform"
              >
                {/* Raised, floating center button '+' in solid #26215C */}
                <div className="w-12 h-12 rounded-xl bg-[#26215C] dark:bg-[#534AB7] text-white flex items-center justify-center shadow-md border-2 border-white dark:border-[#121124]">
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-semibold text-[#26215C] dark:text-[#AFA9EC] mt-0.5">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors cursor-pointer relative active:scale-95 ${
                isActive
                  ? 'text-[#26215C] dark:text-white font-bold'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-3.5 h-3.5 px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 font-medium tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
