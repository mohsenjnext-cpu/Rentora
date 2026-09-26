import React from 'react';
export default function RentoraCard({ as: Tag='section', interactive=false, className='', children, ...props }) {
  return <Tag className={`rentora-card ${interactive ? 'transition duration-200 hover:shadow-[var(--shadow-card-hover)] focus-within:shadow-[var(--shadow-focus)]' : ''} ${className}`} {...props}>{children}</Tag>;
}
