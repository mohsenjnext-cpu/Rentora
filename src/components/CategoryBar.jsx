import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  Wrench, 
  Tv, 
  Tent, 
  Dumbbell, 
  Car, 
  PartyPopper, 
  Home, 
  LayoutGrid
} from 'lucide-react';

export const CATEGORIES_LIST = [
  { id: 'all', icon: LayoutGrid, labelFa: 'همه', labelEn: 'All', labelAr: 'الكل', labelZh: '全部' },
  { id: 'tools', icon: Wrench, labelFa: 'ابزارآلات', labelEn: 'Tools', labelAr: 'أدوات', labelZh: '五金工具' },
  { id: 'cameras', icon: Tv, labelFa: 'عکاسی و دیجیتال', labelEn: 'Cameras', labelAr: 'كاميرات', labelZh: '数码摄影' },
  { id: 'camping', icon: Tent, labelFa: 'کمپینگ و سفر', labelEn: 'Camping', labelAr: 'تخييم', labelZh: '户外露营' },
  { id: 'sports', icon: Dumbbell, labelFa: 'ورزش', labelEn: 'Sports', labelAr: 'رياضة', labelZh: '运动健身' },
  { id: 'vehicles', icon: Car, labelFa: 'خودرو', labelEn: 'Vehicles', labelAr: 'مركبات', labelZh: '车辆出行' },
  { id: 'events', icon: PartyPopper, labelFa: 'مهمانی', labelEn: 'Party', labelAr: 'مناسبات', labelZh: '活动演出' },
  { id: 'home', icon: Home, labelFa: 'خانه', labelEn: 'Home', labelAr: 'منزل', labelZh: '家居家电' }
];

export default function CategoryBar({ selectedCategory = 'all', onSelectCategory }) {
  const { lang } = useLanguage();

  const getLabel = (cat) => {
    if (lang === 'fa') return cat.labelFa;
    if (lang === 'ar') return cat.labelAr;
    if (lang === 'zh') return cat.labelZh;
    return cat.labelEn;
  };

  return (
    <div className="w-full overflow-x-auto scrollbar-none py-1">
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-max px-0.5">
        {CATEGORIES_LIST.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none ${
                isSelected
                  ? 'bg-[#26215C] text-white dark:bg-[#534AB7] font-bold shadow-2xs'
                  : 'bg-white dark:bg-[#16152B] border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1E1D33]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white stroke-[2.2]' : 'text-slate-500 dark:text-slate-400 stroke-[1.8]'}`} />
              <span>{getLabel(cat)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
