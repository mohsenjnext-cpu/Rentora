import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  Package, 
  Search, 
  Clock, 
  Heart, 
  Plus, 
  FolderX,
  AlertCircle 
} from 'lucide-react';

export default function EmptyState({ 
  type = 'package', 
  title, 
  message, 
  actionLabel, 
  onAction 
}) {
  const { lang, dir, t, l } = useLanguage();

  const getIcon = () => {
    switch (type) {
      case 'search':
        return <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 stroke-[1.5]" />;
      case 'history':
      case 'activity':
        return <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 stroke-[1.5]" />;
      case 'favorite':
        return <Heart className="w-8 h-8 text-slate-300 dark:text-slate-600 stroke-[1.5]" />;
      default:
        return <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 stroke-[1.5]" />;
    }
  };

  return (
    <div className="py-12 sm:py-16 px-4 text-center rounded-2xl rentora-card space-y-3 max-w-md mx-auto select-none animate-fadeIn">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-[#1E1D33] flex items-center justify-center">
        {getIcon()}
      </div>

      <div className="space-y-1">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
          {title || t('emptyDefaultTitle')}
        </h3>
        {message && (
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
            {message}
          </p>
        )}
      </div>

      {actionLabel && onAction && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onAction}
            className="btn-primary px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{actionLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}
