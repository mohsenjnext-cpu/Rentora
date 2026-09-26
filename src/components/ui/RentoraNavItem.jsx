import React from 'react';

export default function RentoraNavItem({
  active = false,
  icon: Icon,
  label,
  badge,
  onClick,
  disabled = false,
  className = '',
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'bg-[var(--color-rentora-primary-soft)] text-[var(--color-rentora-primary-mid)] dark:bg-[#211E45] dark:text-[#AFA9EC]' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'} ${className}`}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      <span>{label}</span>
      {badge != null && <span className="ms-auto min-w-5 rounded-full bg-[var(--color-rentora-primary-mid)] px-1.5 text-center text-[10px] font-black text-white">{badge}</span>}
    </button>
  );
}
