'use client';

import React from 'react';
import Image from 'next/image';
import { Building2 } from 'lucide-react';
import type { PaymentMethodId } from '@/lib/types';

const METHOD_LOGO_SRC: Record<Exclude<PaymentMethodId, 'bank'>, { src: string; alt: string }> = {
  bkash: { src: '/BKash-Icon2-Logo.wine.svg', alt: 'bKash' },
  nagad: { src: '/Nagad-Horizontal-Logo.wine.svg', alt: 'Nagad' },
  rocket: { src: '/Rocket_mobile_banking_logo.svg', alt: 'Rocket' },
  upay: { src: '/Upay_logo.svg', alt: 'Upay' },
};

export function PaymentMethodLogo({
  method,
  className = 'h-6 w-6',
}: {
  method: PaymentMethodId;
  className?: string;
}) {
  if (method === 'bank') {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-lg bg-[#0B2447] text-[#E5A93B] shadow-xs ${className}`}
        aria-hidden="true"
      >
        <Building2 className="h-[58%] w-[58%]" />
      </span>
    );
  }

  const meta = METHOD_LOGO_SRC[method];
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200/80 bg-white p-0.5 shadow-xs dark:border-slate-700/70 ${className}`}
    >
      <Image
        src={meta.src}
        alt={meta.alt}
        width={40}
        height={40}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

export function BankLogo({
  bankId,
  bankName,
  className = 'h-7 w-7',
}: {
  bankId?: string;
  bankName: string;
  className?: string;
}) {
  const key = `${bankId || ''} ${bankName}`.toLowerCase();

  let src: string | null = null;
  if (key.includes('city')) {
    src = '/city-bank-plc.svg';
  } else if (key.includes('prime')) {
    src = '/prime-bank-plc.svg';
  } else if (key.includes('dutch') || key.includes('dbbl')) {
    src = '/dutch-bangla-bank-plc.svg';
  }

  if (src) {
    return (
      <span
        className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200/80 bg-white p-0.5 shadow-xs dark:border-slate-700/70 ${className}`}
      >
        <Image
          src={src}
          alt={bankName}
          width={40}
          height={40}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg bg-[#0B2447] text-[#E5A93B] shadow-xs ${className}`}
      aria-hidden="true"
    >
      <Building2 className="h-[58%] w-[58%]" />
    </span>
  );
}
