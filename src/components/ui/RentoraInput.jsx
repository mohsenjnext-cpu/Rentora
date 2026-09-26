import React, { forwardRef, useId } from 'react';

const RentoraInput = forwardRef(function RentoraInput(
  { label, hint, error, required = false, id, className = '', inputClassName = '', leadingAdornment, trailingAdornment, ...props },
  ref
) {
  const reactId = useId().replace(/:/g, '');
  const inputId = id || props.name || `rentora-input-\${reactId}`;
  const describedBy = [
    hint && `\${inputId}-hint`,
    error && `\${inputId}-error`,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`w-full \${className}`}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          {label}{required && <span aria-hidden="true" className="ms-1 text-rose-600">*</span>}
        </label>
      )}
      <div className="relative">
        {leadingAdornment && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-slate-400 dark:text-slate-500">{leadingAdornment}</span>}
        <input ref={ref} id={inputId} required={required} aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy}
          className={`min-h-10 w-full rounded-[var(--radius-control)] border bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rentora-primary-accent focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60 dark:border-white/10 dark:bg-[#16152B] dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-900 \${leadingAdornment ? 'ps-9' : ''} \${trailingAdornment ? 'pe-9' : ''} \${error ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200'} \${inputClassName}`} {...props} />
        {trailingAdornment && <span className="absolute inset-y-0 end-2 flex items-center">{trailingAdornment}</span>}
      </div>
      {hint && !error && <p id={`\${inputId}-hint`} className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p id={`\${inputId}-error`} role="alert" className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
});

export default RentoraInput;