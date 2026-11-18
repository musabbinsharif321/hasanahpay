'use client';

import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  XCircle,
} from 'lucide-react';
import {
  getPaymentMethodMeta,
  type PaymentMethodId,
  type PaymentStatus,
  type SubscriptionStatus,
} from '@/lib/types';
import { PaymentMethodLogo } from './PaymentLogos';

export function PaymentMethodBadge({ method }: { method: PaymentMethodId }) {
  const meta = getPaymentMethodMeta(method);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${meta.badgeBgClass} ${meta.badgeTextClass} whitespace-nowrap shrink-0`}
    >
      <PaymentMethodLogo method={method} className="h-4 w-4 shrink-0" />
      <span>{meta.name}</span>
    </span>
  );
}

export function SubscriptionStatusIndicator({
  status,
  dueSoon = false,
}: {
  status: SubscriptionStatus;
  dueSoon?: boolean;
}) {
  if (status === 'pending_verification') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap shrink-0">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Pending Verification</span>
      </span>
    );
  }

  if (status === 'due' || dueSoon) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap shrink-0">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>{status === 'due' ? 'Payment Due' : 'Due Soon'}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0">
      <CheckCircle2 className="h-3.5 w-3.5" />
      <span>Active</span>
    </span>
  );
}

export function PaymentStatusIndicator({ status }: { status: PaymentStatus }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>Approved</span>
      </span>
    );
  }

  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap shrink-0">
        <XCircle className="h-3.5 w-3.5" />
        <span>Rejected</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap shrink-0">
      <Clock className="h-3.5 w-3.5" />
      <span>Pending</span>
    </span>
  );
}
