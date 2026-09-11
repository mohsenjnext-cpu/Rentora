import React, { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { MessageSquare, X, ArrowLeft, ArrowRight } from 'lucide-react';

export default function NotificationToast({ notification, onClose, onOpenChat }) {
  const { lang, dir, l } = useLanguage();

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onClose();
    }, 6000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  if (!notification) return null;

  const sender = notification.senderUsername || 'pioneer';
  const text = notification.text || '';
  const itemTitle = notification.itemTitle || 'گفتگوی رنتورا';

  return (
    <div 
      className="fixed top-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:left-auto sm:max-w-md z-60 animate-slideDown"
    >
      <div 
        onClick={() => {
          onOpenChat(notification);
          onClose();
        }}
        className="bg-white dark:bg-[#1C1B33] border-2 border-[#534AB7]/40 dark:border-[#7F77DD]/40 rounded-2xl p-3 sm:p-3.5 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 cursor-pointer hover:border-[#534AB7] transition-all group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <img
              src={`https://api.dicebear.com/7.x/bottts/svg?seed=${sender}`}
              alt=""
              className="w-10 h-10 rounded-xl bg-slate-150 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 object-cover"
            />
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-[#1C1B33]"></div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-slate-900 dark:text-white font-mono" dir="ltr">
                @{sender}
              </span>
              <span className="text-[10px] text-[#534AB7] dark:text-[#AFA9EC] font-semibold truncate">
                • {itemTitle}
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-200 font-medium truncate max-w-[200px] sm:max-w-[260px] mt-0.5">
              {text}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChat(notification);
              onClose();
            }}
            className="btn-primary px-2.5 py-1 text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
          >
            <span>{l('پاسخ', 'Reply', 'رد', '回复')}</span>
            {dir === 'rtl' ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
