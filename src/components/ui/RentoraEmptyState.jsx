import React from 'react';

export default function RentoraEmptyState({ icon, title, description, action, className = '' }) {
  return (
    <section
      role="status"
      className={`flex min-h-40 flex-col items-center justify-center rounded-[var(--radius-panel)] border border-dashed border-slate-200 bg-white px-5 py-8 text-center dark:border-white/10 dark:bg-[#16152B] ${className}`}
    >
      {icon && <div aria-hidden="true" className="mb-3 text-2xl text-slate-400">{icon}</div>}
      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h2>
      {description && <p className="mt-1.5 max-w-sm text-xs leading-6 text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}
