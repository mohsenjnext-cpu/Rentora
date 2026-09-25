import React from 'react';

export default function RentoraTabs({ tabs = [], value, onChange, ariaLabel = 'Tabs', className = '' }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex gap-1 overflow-x-auto rounded-[var(--radius-panel)] bg-slate-100 p-1 scrollbar-none dark:bg-slate-900 ${className}`}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={tab.disabled}
            onClick={() => onChange?.(tab.value)}
            className={`min-h-10 shrink-0 rounded-[var(--radius-control)] px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? 'bg-white text-rentora-primary shadow-sm dark:bg-[#211E45] dark:text-rentora-primary-soft'
                : 'text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
