import React from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

export default function RentoraToast({
  open = true,
  tone = 'info',
  title,
  message,
  onClose,
  action,
}) {
  if (!open) return null;
  const Icon = icons[tone] || icons.info;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-card)] border border-slate-200 bg-white p-3 shadow-[var(--shadow-panel)] dark:border-slate-800 dark:bg-[#16152B]"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-rentora-primary-mid)]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>}
        {message && <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{message}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="بستن اعلان" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] dark:hover:bg-slate-800">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
