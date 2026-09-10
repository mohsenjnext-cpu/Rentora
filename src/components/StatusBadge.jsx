import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  PlayCircle, 
  CreditCard,
  RotateCcw,
  ShieldAlert
} from 'lucide-react';

export default function StatusBadge({ status, size = 'sm' }) {
  const { t } = useLanguage();

  const config = {
    requested: {
      label: t('statusRequested'),
      bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      icon: Clock
    },
    awaiting_payment: {
      label: t('statusAwaitingPayment'),
      bg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      icon: CreditCard
    },
    payment_pending: {
      label: t('statusPaymentPending'),
      bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      icon: Clock
    },
    confirmed: {
      label: t('statusConfirmed'),
      bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      icon: CheckCircle2
    },
    active: {
      label: t('statusActive'),
      bg: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      icon: PlayCircle
    },
    completed: {
      label: t('statusCompleted'),
      bg: 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 border-green-200 dark:border-green-800',
      icon: CheckCircle2
    },
    cancelled: {
      label: t('statusCancelled'),
      bg: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
      icon: XCircle
    },
    disputed: {
      label: t('statusDisputed'),
      bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      icon: ShieldAlert
    },
    refunded: {
      label: t('statusRefunded'),
      bg: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800',
      icon: RotateCcw
    }
  };

  const item = config[status] || {
    label: status,
    bg: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200',
    icon: AlertCircle
  };

  const Icon = item.icon;
  const sizeClasses = size === 'lg' ? 'px-3 py-1.5 text-sm font-semibold gap-1.5' : 'px-2.5 py-0.5 text-xs font-medium gap-1';

  return (
    <span className={`inline-flex items-center rounded-full border ${item.bg} ${sizeClasses}`}>
      <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} />
      {item.label}
    </span>
  );
}
