import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export default function RentoraModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  initialFocusRef,
  className = '',
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const target = initialFocusRef?.current || panelRef.current?.querySelector('[data-autofocus="true"]');
    (target || panelRef.current)?.focus();
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open, closeOnEscape, onClose, initialFocusRef]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5" dir="rtl">
      <button
        type="button"
        aria-label="بستن پنجره"
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative flex max-h-[92vh] w-full ${widths[size] || widths.md} flex-col overflow-hidden rounded-[var(--radius-panel)] border border-slate-200 bg-white shadow-[var(--shadow-panel)] outline-none dark:border-slate-800 dark:bg-[#121124] ${className}`}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5">
          <div className="min-w-0">
            {title && <h2 id={titleId} className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">{title}</h2>}
            {description && <p id={descriptionId} className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer && <footer className="shrink-0 border-t border-slate-200 p-4 dark:border-slate-800 sm:p-5">{footer}</footer>}
      </section>
    </div>
  );
}
