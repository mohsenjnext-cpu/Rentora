import React from 'react';

export default function RentoraSkeleton({ className = '', rounded = 'rounded-[var(--radius-control)]', ...props }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse bg-slate-200 dark:bg-slate-800 ${rounded} ${className}`}
      {...props}
    />
  );
}
