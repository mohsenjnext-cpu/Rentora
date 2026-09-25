import React from 'react';

const tones = {
  info: 'border-rentora-primary-accent/30 bg-rentora-primary-soft text-rentora-primary',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
  error: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300',
};

export default function RentoraAlert({ tone = 'info', title, children, className = '' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-[var(--radius-panel)] border px-4 py-3 text-sm ${tones[tone] || tones.info} ${className}`}
    >
      {title && <p className="font-bold">{title}</p>}
      {children && <div className={title ? 'mt-1 text-xs leading-6 opacity-90' : undefined}>{children}</div>}
    </div>
  );
}
