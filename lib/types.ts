import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'client' | 'admin';

export type BillingCycle = 'monthly' | 'yearly';

export type SubscriptionStatus = 'active' | 'due' | 'pending_verification';

export type PaymentMethodId = 'bkash' | 'nagad' | 'rocket' | 'upay' | 'bank';

export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  role: UserRole;
  createdAt: Timestamp | null;
}

export interface Subscription {
  id: string;
  clientId: string;
  clientName: string;
  serviceName: string;
  amount: number;
  billingCycle: BillingCycle;
  nextDueDate: Timestamp;
  status: SubscriptionStatus;
}

export interface Payment {
  id: string;
  clientId: string;
  clientName: string;
  subscriptionId: string;
  serviceName: string;
  method: PaymentMethodId;
  senderNumber: string;
  trxId: string;
  amount: number;
  status: PaymentStatus;
  submittedAt: Timestamp | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  paymentId: string;
  clientId: string;
  clientName: string;
  serviceName: string;
  method: PaymentMethodId;
  trxId: string;
  amount: number;
  issuedAt: Timestamp | null;
}

export interface BankAccountDetails {
  id: string;
  bankName: string;
  accountName: string;
  accountType: string;
  accountNumber: string;
  branch: string;
  routingNumber: string;
}

export interface PaymentAccountsSetting {
  bkash: string;
  nagad: string;
  rocket: string;
  upay: string;
  bkashLabel: string;
  nagadLabel: string;
  rocketLabel: string;
  upayLabel: string;
  bkashEnabled: boolean;
  nagadEnabled: boolean;
  rocketEnabled: boolean;
  upayEnabled: boolean;
  bankEnabled: boolean;
  banks: BankAccountDetails[];
  supportPhone: string;
  supportEmail: string;
  website: string;
  updatedAt?: Timestamp | null;
}

export const DEFAULT_BANK_ACCOUNTS: BankAccountDetails[] = [
  {
    id: 'bank_city',
    bankName: 'City Bank PLC',
    accountName: 'MUSAB KHAN',
    accountType: 'STUDENT SB CLG PLAN A/C',
    accountNumber: '2584987851001',
    branch: 'MOUCHAK BRANCH',
    routingNumber: '225274361',
  },
  {
    id: 'bank_prime',
    bankName: 'Prime Bank PLC',
    accountName: 'MUSAB KHAN',
    accountType: 'SAVINGS ACCOUNT',
    accountNumber: '3108212062032',
    branch: 'NEW ESKATON BRANCH',
    routingNumber: '170272892',
  },
  {
    id: 'bank_dbbl',
    bankName: 'Dutch-Bangla Bank PLC',
    accountName: 'MUSAB KHAN',
    accountType: 'SAVING',
    accountNumber: '3341580547211',
    branch: 'MOGBAZAR BRANCH',
    routingNumber: '090263239',
  },
];

export const DEFAULT_PAYMENT_ACCOUNTS: PaymentAccountsSetting = {
  bkash: '01349345353',
  nagad: '01349345353',
  rocket: '01349345353',
  upay: '01349345353',
  bkashLabel: 'Personal / Send Money',
  nagadLabel: 'Personal / Send Money',
  rocketLabel: 'DBBL Mobile Banking',
  upayLabel: 'UCB Fintech Wallet',
  bkashEnabled: true,
  nagadEnabled: true,
  rocketEnabled: true,
  upayEnabled: true,
  bankEnabled: true,
  banks: DEFAULT_BANK_ACCOUNTS,
  supportPhone: '01349345353',
  supportEmail: 'info@hasanahts.com',
  website: 'www.hasanahts.com',
};

export function normalizePaymentAccounts(
  raw?: Record<string, unknown> | null
): PaymentAccountsSetting {
  if (!raw) return DEFAULT_PAYMENT_ACCOUNTS;

  const str = (val: unknown, fallback: string) =>
    typeof val === 'string' && val.trim().length > 0 ? val.trim() : fallback;
  const bool = (val: unknown, fallback: boolean) =>
    typeof val === 'boolean' ? val : fallback;

  let banks: BankAccountDetails[] = DEFAULT_BANK_ACCOUNTS;

  if (Array.isArray(raw.banks) && raw.banks.length > 0) {
    const parsed = raw.banks
      .slice(0, 6)
      .map((item, idx) => {
        const b = item as Partial<BankAccountDetails>;
        return {
          id: str(b.id, `bank_${idx + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_') || `bank_${idx + 1}`,
          bankName: str(b.bankName, 'Bank PLC'),
          accountName: str(b.accountName, 'MUSAB KHAN'),
          accountType: str(b.accountType, 'SAVINGS ACCOUNT'),
          accountNumber: str(b.accountNumber, '0000000000'),
          branch: str(b.branch, 'DHAKA BRANCH'),
          routingNumber: str(b.routingNumber, '000000000'),
        };
      })
      .filter((b) => b.bankName.length >= 2 && b.accountNumber.length >= 4);

    if (parsed.length > 0) {
      banks = parsed;
    }
  } else if (typeof raw.bankName === 'string' && typeof raw.bankAccountNumber === 'string') {
    // Hydrate legacy single-bank Firestore settings smoothly alongside remaining official banks
    const legacyBank: BankAccountDetails = {
      id: 'bank_1',
      bankName: str(raw.bankName, DEFAULT_BANK_ACCOUNTS[0].bankName),
      accountName: str(raw.bankAccountName, DEFAULT_BANK_ACCOUNTS[0].accountName),
      accountType: 'SAVINGS ACCOUNT',
      accountNumber: str(raw.bankAccountNumber, DEFAULT_BANK_ACCOUNTS[0].accountNumber),
      branch: str(raw.bankBranch, DEFAULT_BANK_ACCOUNTS[0].branch),
      routingNumber: str(raw.bankRoutingNumber, DEFAULT_BANK_ACCOUNTS[0].routingNumber),
    };
    banks = [
      legacyBank,
      ...DEFAULT_BANK_ACCOUNTS.filter(
        (d) => d.accountNumber !== legacyBank.accountNumber
      ).slice(0, 2),
    ];
  }

  return {
    bkash: str(raw.bkash, DEFAULT_PAYMENT_ACCOUNTS.bkash),
    nagad: str(raw.nagad, DEFAULT_PAYMENT_ACCOUNTS.nagad),
    rocket: str(raw.rocket, DEFAULT_PAYMENT_ACCOUNTS.rocket),
    upay: str(raw.upay, DEFAULT_PAYMENT_ACCOUNTS.upay),
    bkashLabel: str(raw.bkashLabel, DEFAULT_PAYMENT_ACCOUNTS.bkashLabel),
    nagadLabel: str(raw.nagadLabel, DEFAULT_PAYMENT_ACCOUNTS.nagadLabel),
    rocketLabel: str(raw.rocketLabel, DEFAULT_PAYMENT_ACCOUNTS.rocketLabel),
    upayLabel: str(raw.upayLabel, DEFAULT_PAYMENT_ACCOUNTS.upayLabel),
    bkashEnabled: bool(raw.bkashEnabled, true),
    nagadEnabled: bool(raw.nagadEnabled, true),
    rocketEnabled: bool(raw.rocketEnabled, true),
    upayEnabled: bool(raw.upayEnabled, true),
    bankEnabled: bool(raw.bankEnabled, true),
    banks,
    supportPhone: str(raw.supportPhone, DEFAULT_PAYMENT_ACCOUNTS.supportPhone),
    supportEmail: str(raw.supportEmail, DEFAULT_PAYMENT_ACCOUNTS.supportEmail),
    website: str(raw.website, DEFAULT_PAYMENT_ACCOUNTS.website),
    updatedAt: (raw.updatedAt as Timestamp | null | undefined) ?? null,
  };
}

export interface PaymentMethodMeta {
  id: PaymentMethodId;
  name: string;
  subtitle: string;
  accentHex: string;
  badgeBgClass: string;
  badgeTextClass: string;
  borderClass: string;
  ringClass: string;
}

export const PAYMENT_METHODS: PaymentMethodMeta[] = [
  {
    id: 'bkash',
    name: 'bKash',
    subtitle: 'Personal / Send Money',
    accentHex: '#E2136E',
    badgeBgClass: 'bg-[#E2136E]/10 dark:bg-[#E2136E]/20',
    badgeTextClass: 'text-[#E2136E] dark:text-[#F472B6]',
    borderClass: 'border-[#E2136E]',
    ringClass: 'ring-[#E2136E]/25',
  },
  {
    id: 'nagad',
    name: 'Nagad',
    subtitle: 'Personal / Send Money',
    accentHex: '#F6921E',
    badgeBgClass: 'bg-[#F6921E]/10 dark:bg-[#F6921E]/20',
    badgeTextClass: 'text-[#D97706] dark:text-[#FBBF24]',
    borderClass: 'border-[#F6921E]',
    ringClass: 'ring-[#F6921E]/25',
  },
  {
    id: 'rocket',
    name: 'Rocket',
    subtitle: 'DBBL Mobile Banking',
    accentHex: '#8C3494',
    badgeBgClass: 'bg-[#8C3494]/10 dark:bg-[#8C3494]/25',
    badgeTextClass: 'text-[#8C3494] dark:text-[#D8B4FE]',
    borderClass: 'border-[#8C3494]',
    ringClass: 'ring-[#8C3494]/25',
  },
  {
    id: 'upay',
    name: 'Upay',
    subtitle: 'UCB Fintech Wallet',
    accentHex: '#0054A6',
    badgeBgClass: 'bg-[#0054A6]/10 dark:bg-[#0054A6]/25',
    badgeTextClass: 'text-[#0054A6] dark:text-[#60A5FA]',
    borderClass: 'border-[#0054A6]',
    ringClass: 'ring-[#0054A6]/25',
  },
  {
    id: 'bank',
    name: 'Bank Transfer',
    subtitle: 'City Bank · Prime · DBBL',
    accentHex: '#1D6E8C',
    badgeBgClass: 'bg-[#1D6E8C]/10 dark:bg-[#1D6E8C]/25',
    badgeTextClass: 'text-[#1D6E8C] dark:text-[#38BDF8]',
    borderClass: 'border-[#1D6E8C]',
    ringClass: 'ring-[#1D6E8C]/25',
  },
];

export function getPaymentMethodMeta(id: PaymentMethodId): PaymentMethodMeta {
  return PAYMENT_METHODS.find((m) => m.id === id) ?? PAYMENT_METHODS[0];
}

export function formatBDT(amount: number): string {
  return `৳ ${new Intl.NumberFormat('en-BD', {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

export function formatTimestampDate(ts?: Timestamp | null): string {
  if (!ts) return 'Just now';
  try {
    const date = ts.toDate();
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return '—';
  }
}

export function isDueSoon(ts?: Timestamp | null): boolean {
  if (!ts) return false;
  try {
    const due = ts.toDate().getTime();
    const diffDays = (due - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  } catch {
    return false;
  }
}

export function calculateExtendedDueDate(
  currentDue: Timestamp | null | undefined,
  cycle: BillingCycle
): Date {
  const base = currentDue ? currentDue.toDate() : new Date();
  const anchor = base.getTime() < Date.now() ? new Date() : new Date(base.getTime());
  if (cycle === 'yearly') {
    anchor.setFullYear(anchor.getFullYear() + 1);
  } else {
    const targetMonth = anchor.getMonth() + 1;
    anchor.setMonth(targetMonth);
  }
  return anchor;
}

export function generateNextInvoiceNumber(invoices: Invoice[]): string {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  let maxSeq = 0;
  for (const inv of invoices) {
    if (inv.invoiceNumber.startsWith(prefix)) {
      const seq = parseInt(inv.invoiceNumber.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return `${prefix}${nextSeq}`;
}
