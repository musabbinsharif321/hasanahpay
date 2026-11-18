'use client';

import React from 'react';
import Image from 'next/image';
import { Globe, Mail, Phone } from 'lucide-react';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'emblem' | 'seal';
  className?: string;
}

const SIZE_MAP = {
  sm: { box: 'h-9 w-9 rounded-xl p-1', px: 36 },
  md: { box: 'h-11 w-11 rounded-xl p-1.5', px: 44 },
  lg: { box: 'h-14 w-14 rounded-2xl p-1.5', px: 56 },
};

export function BrandMark({ size = 'sm', variant = 'emblem', className = '' }: BrandMarkProps) {
  const dims = SIZE_MAP[size];
  const src =
    variant === 'seal'
      ? '/assets/aistudio/hasanah-logo_2c1c7ceb.png'
      : '/assets/aistudio/hasanah_logo_main_694d71ec.png';

  return (
    <div
      className={`relative shrink-0 overflow-hidden border border-[#0B2447]/10 bg-white shadow-xs dark:border-white/15 ${dims.box} ${className}`}
    >
      <Image
        src={src}
        alt="Hasanah Tech Solutions Logo"
        width={dims.px}
        height={dims.px}
        referrerPolicy="no-referrer"
        className="h-full w-full object-contain"
        priority
      />
    </div>
  );
}

interface AgencyContactStripProps {
  phone: string;
  email: string;
  website: string;
  centered?: boolean;
}

export function AgencyContactStrip({
  phone,
  email,
  website,
  centered = false,
}: AgencyContactStripProps) {
  const cleanHrefWebsite = website.startsWith('http') ? website : `https://${website}`;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400 ${
        centered ? 'justify-center' : ''
      }`}
    >
      <a
        href={`tel:${phone.replace(/\s+/g, '')}`}
        className="inline-flex items-center gap-1.5 font-mono-tabular transition hover:text-[#1D6E8C] dark:hover:text-[#38BDF8]"
      >
        <Phone className="h-3.5 w-3.5 text-[#D4941F]" />
        <span>{phone}</span>
      </a>
      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
        ·
      </span>
      <a
        href={`mailto:${email}`}
        className="inline-flex items-center gap-1.5 transition hover:text-[#1D6E8C] dark:hover:text-[#38BDF8]"
      >
        <Mail className="h-3.5 w-3.5 text-[#1D6E8C] dark:text-[#38BDF8]" />
        <span>{email}</span>
      </a>
      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
        ·
      </span>
      <a
        href={cleanHrefWebsite}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 transition hover:text-[#1D6E8C] dark:hover:text-[#38BDF8]"
      >
        <Globe className="h-3.5 w-3.5 text-[#0B2447] dark:text-slate-300" />
        <span>{website}</span>
      </a>
    </div>
  );
}
