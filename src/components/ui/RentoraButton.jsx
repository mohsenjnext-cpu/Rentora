import React from 'react';

const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-700'
};

export default function RentoraButton({ variant='primary', size='md', loading=false, disabled=false, className='', children, ...props }) {
  const sizes = { sm: 'min-h-9 px-3 text-xs', md: 'min-h-10 px-4 text-sm', lg: 'min-h-11 px-5 text-sm' };
  return <button type="button" disabled={disabled || loading} aria-busy={loading || undefined} className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-bold transition duration-200 focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`} {...props}>{loading && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}{children}</button>;
}
