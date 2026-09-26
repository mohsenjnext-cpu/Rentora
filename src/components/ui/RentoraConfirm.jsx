import React from 'react';
import { AlertTriangle } from 'lucide-react';
import RentoraModal from './RentoraModal';
import RentoraButton from './RentoraButton';

export default function RentoraConfirm({
  open,
  onClose,
  onConfirm,
  title = 'تأیید عملیات',
  description = 'این عملیات قابل بازگشت نیست.',
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  loading = false,
  danger = true,
}) {
  return (
    <RentoraModal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      description={description}
      size="sm"
      closeOnBackdrop={!loading}
      closeOnEscape={!loading}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-start">
          <RentoraButton variant="secondary" onClick={onClose} disabled={loading}>{cancelLabel}</RentoraButton>
          <RentoraButton variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</RentoraButton>
        </div>
      }
    >
      <div className={`flex gap-3 rounded-[var(--radius-card)] p-3 ${danger ? 'bg-[var(--color-rentora-danger-soft)] text-[var(--color-rentora-danger)]' : 'bg-[var(--color-rentora-primary-soft)] text-[var(--color-rentora-primary-mid)]`} `}>
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="text-sm leading-6">{description}</p>
      </div>
    </RentoraModal>
  );
}
