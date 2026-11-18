'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  Copy,
  CreditCard,
  FileText,
  Fingerprint,
  Globe,
  History,
  Home,
  LayoutGrid,
  Loader2,
  LogOut,
  Mail,
  Moon,
  Palette,
  Phone,
  Receipt,
  Save,
  Settings,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase';
import {
  DEFAULT_PAYMENT_ACCOUNTS,
  formatBDT,
  formatTimestampDate,
  isDueSoon,
  normalizePaymentAccounts,
  type Invoice,
  type Payment,
  type PaymentAccountsSetting,
  type Subscription,
  type UserProfile,
} from '@/lib/types';
import { AgencyContactStrip } from './BrandMark';
import { PWAInstallButton } from './PWAWidgets';
import { useTheme } from './ThemeProvider';
import {
  PaymentMethodBadge,
  PaymentStatusIndicator,
  SubscriptionStatusIndicator,
} from './PaymentMethodBadge';
import { GatewayCheckoutSheet } from './GatewayCheckoutSheet';
import { DigitalInvoiceModal } from './DigitalInvoiceModal';
import { AIChatAssistant } from './AIChatAssistant';
import { BiometricEnrollSheet } from './BiometricEnrollSheet';
import {
  checkBiometricAvailability,
  getBiometricLabel,
  getEnrolledBiometricProfile,
  type BiometricDeviceProfile,
} from '@/lib/biometrics';
import { useToast } from './ToastProvider';

type ClientTab = 'services' | 'pay' | 'history' | 'invoices' | 'all_services' | 'settings';

const AGENCY_SERVICES = [
  {
    id: 'web_saas',
    title: 'Web & SaaS Development',
    tag: 'Most Popular',
    icon: Globe,
    summary: 'High-speed business websites, e-commerce stores, and custom web portals.',
    features: [
      'Next.js & React modern full-stack architecture',
      'Custom Client & Admin Dashboards with role security',
      'E-commerce checkout, inventory & order management',
      'SEO optimization, SSL & mobile-first responsive UI',
    ],
  },
  {
    id: 'mobile_app',
    title: 'Mobile App Development',
    tag: 'Android & iOS',
    icon: Smartphone,
    summary: 'Native-feel cross-platform mobile apps & PWAs built for everyday users.',
    features: [
      'Android & iOS apps with smooth 60fps animations',
      'Biometric (Fingerprint/Face ID) & OTP authentication',
      'Push notifications & offline-capable PWA support',
      'Google Play Store & App Store deployment support',
    ],
  },
  {
    id: 'ui_branding',
    title: 'UI/UX Design & Branding',
    tag: 'Design Studio',
    icon: Palette,
    summary: 'Clean product interfaces, brand logos, and interactive prototypes.',
    features: [
      'Mobile-first UI/UX design systems in Figma',
      'Custom company logo, brand colors & visual identity',
      'Dark & Light mode design with accessibility focus',
      'High-converting landing pages & pitch decks',
    ],
  },
  {
    id: 'cloud_hosting',
    title: 'Cloud, Hosting & Maintenance',
    tag: '24/7 Care',
    icon: Cloud,
    summary: 'Managed cloud servers, database security, backups, and monthly care.',
    features: [
      'Firebase, Vercel & VPS cloud deployment & scaling',
      'Domain, DNS, Cloudflare & automated SSL setup',
      'Automated daily database backups & security rules',
      'Priority bug fixes, speed tuning & uptime monitoring',
    ],
  },
  {
    id: 'automation_pay',
    title: 'Payment Gateway & AI Automation',
    tag: 'Fintech & AI',
    icon: Sparkles,
    summary: 'bKash/Nagad/Bank billing systems, automated invoices, and AI assistants.',
    features: [
      'bKash, Nagad, Rocket, Upay & Bank payment workflows',
      'Automated PDF digital invoices & TrxID verification',
      'Email OTP, SMS notifications & WhatsApp alerts',
      'Custom AI support chatbots trained on your business',
    ],
  },
] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function compressAvatarImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ClientPortal({ userProfile }: { userProfile: UserProfile }) {
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<ClientTab>('services');
  const [expandedServiceId, setExpandedServiceId] = useState<string>('web_saas');
  const [editName, setEditName] = useState(userProfile.name);
  const [editCompany, setEditCompany] = useState(userProfile.companyName);
  const [editPhone, setEditPhone] = useState(userProfile.phone);
  const [editAvatar, setEditAvatar] = useState(userProfile.avatarUrl || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentAccounts, setPaymentAccounts] =
    useState<PaymentAccountsSetting>(DEFAULT_PAYMENT_ACCOUNTS);
  const [loadingData, setLoadingData] = useState(true);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<string>(() => getBiometricLabel());
  const [enrolledBiometric, setEnrolledBiometric] = useState<BiometricDeviceProfile | null>(null);
  const [biometricSheetOpen, setBiometricSheetOpen] = useState(false);
  const [copiedClientId, setCopiedClientId] = useState(false);
  const [justRegisteredId, setJustRegisteredId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.localStorage.getItem('hasanah_just_registered_id');
      return stored && userProfile.clientCode && stored === userProfile.clientCode ? stored : null;
    } catch {
      return null;
    }
  });

  const handleCopyClientId = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedClientId(true);
      showToast(`Client ID ${code} copied!`, 'success');
      window.setTimeout(() => setCopiedClientId(false), 1800);
    } catch {
      showToast('Copy failed', 'error');
    }
  };

  const dismissWelcomeBanner = () => {
    setJustRegisteredId(null);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('hasanah_just_registered_id');
      } catch {
        // ignore
      }
    }
  };

  const refreshBiometricStatus = () => {
    Promise.all([checkBiometricAvailability(), getEnrolledBiometricProfile()])
      .then(([avail, existing]) => {
        setBiometricSupported(avail.supported && avail.platformAuthenticator);
        setBiometricLabel(avail.label);
        setEnrolledBiometric(existing);
      })
      .catch(() => {
        // Ignore gracefully
      });
  };

  useEffect(() => {
    let active = true;
    const load = () => {
      Promise.all([checkBiometricAvailability(), getEnrolledBiometricProfile()])
        .then(([avail, existing]) => {
          if (!active) return;
          setBiometricSupported(avail.supported && avail.platformAuthenticator);
          setBiometricLabel(avail.label);
          setEnrolledBiometric(existing);
        })
        .catch(() => {
          // Ignore gracefully
        });
    };
    load();
    window.addEventListener('hasanah-biometric-updated', load);
    return () => {
      active = false;
      window.removeEventListener('hasanah-biometric-updated', load);
    };
  }, []);

  useEffect(() => {
    const uid = userProfile.uid || auth.currentUser?.uid;
    if (!uid) return;
    let loadedSubs = false;
    let loadedPays = false;
    let loadedInvs = false;

    const checkReady = () => {
      if (loadedSubs && loadedPays && loadedInvs) {
        setLoadingData(false);
      }
    };

    const unsubSubs = onSnapshot(
      query(collection(db, 'subscriptions'), where('clientId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Subscription);
        list.sort((a, b) => {
          const tA = a.nextDueDate?.toMillis?.() ?? 0;
          const tB = b.nextDueDate?.toMillis?.() ?? 0;
          return tA - tB;
        });
        setSubscriptions(list);
        loadedSubs = true;
        checkReady();
      },
      (err) => {
        setLoadingData(false);
        handleFirestoreError(err, OperationType.LIST, 'subscriptions');
      }
    );

    const unsubPayments = onSnapshot(
      query(collection(db, 'payments'), where('clientId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Payment);
        list.sort((a, b) => {
          const tA = a.submittedAt?.toMillis?.() ?? Date.now();
          const tB = b.submittedAt?.toMillis?.() ?? Date.now();
          return tB - tA;
        });
        setPayments(list);
        loadedPays = true;
        checkReady();
      },
      (err) => {
        setLoadingData(false);
        handleFirestoreError(err, OperationType.LIST, 'payments');
      }
    );

    const unsubInvoices = onSnapshot(
      query(collection(db, 'invoices'), where('clientId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Invoice);
        list.sort((a, b) => {
          const tA = a.issuedAt?.toMillis?.() ?? Date.now();
          const tB = b.issuedAt?.toMillis?.() ?? Date.now();
          return tB - tA;
        });
        setInvoices(list);
        loadedInvs = true;
        checkReady();
      },
      (err) => {
        setLoadingData(false);
        handleFirestoreError(err, OperationType.LIST, 'invoices');
      }
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'paymentAccounts'),
      (snap) => {
        if (snap.exists()) {
          setPaymentAccounts(normalizePaymentAccounts(snap.data() as Record<string, unknown>));
        }
      },
      () => {
        // Fallback to official defaults silently
      }
    );

    return () => {
      unsubSubs();
      unsubPayments();
      unsubInvoices();
      unsubSettings();
    };
  }, [userProfile.uid]);

  const payableSubscriptions = useMemo(
    () => subscriptions.filter((s) => s.status !== 'pending_verification'),
    [subscriptions]
  );

  const totalDueAmount = useMemo(
    () =>
      subscriptions
        .filter((s) => s.status === 'due' || (s.status === 'active' && isDueSoon(s.nextDueDate)))
        .reduce((sum, s) => sum + s.amount, 0),
    [subscriptions]
  );

  const aiContextSummary = useMemo(() => {
    const subsText =
      subscriptions.length === 0
        ? 'No subscriptions assigned.'
        : subscriptions
            .map(
              (s) =>
                `- ${s.serviceName}: ${formatBDT(s.amount)} (${s.billingCycle}), Status: ${s.status}, Next Due: ${formatTimestampDate(s.nextDueDate)}`
            )
            .join('\n');
    const payText =
      payments.length === 0
        ? 'No payment submissions.'
        : payments
            .slice(0, 5)
            .map(
              (p) =>
                `- ${p.serviceName}: ${formatBDT(p.amount)} via ${p.method}, TrxID: ${p.trxId}, Status: ${p.status}`
            )
            .join('\n');
    const invText =
      invoices.length === 0
        ? 'No paid invoices yet.'
        : invoices
            .slice(0, 5)
            .map(
              (i) =>
                `- ${i.invoiceNumber}: ${i.serviceName} (${formatBDT(i.amount)}), TrxID: ${i.trxId}, Issued: ${formatTimestampDate(i.issuedAt)}`
            )
            .join('\n');

    const banksText = paymentAccounts.bankEnabled
      ? paymentAccounts.banks
          .map(
            (b, i) =>
              `  ${i + 1}. ${b.bankName} | A/C Name: ${b.accountName} | Type: ${b.accountType} | A/C No: ${b.accountNumber} | Branch: ${b.branch} | Routing: ${b.routingNumber}`
          )
          .join('\n')
      : '  Bank Transfer temporarily disabled.';

    return `Client Name: ${userProfile.name} (${userProfile.companyName})
Total Payable Due: ${formatBDT(totalDueAmount)}
Subscriptions:
${subsText}

Recent Payments:
${payText}

Paid Invoices:
${invText}

Hasanah Tech Solutions Official Receiving Payment Accounts:
- bKash (${paymentAccounts.bkashEnabled ? paymentAccounts.bkashLabel : 'Disabled'}): ${paymentAccounts.bkash}
- Nagad (${paymentAccounts.nagadEnabled ? paymentAccounts.nagadLabel : 'Disabled'}): ${paymentAccounts.nagad}
- Rocket (${paymentAccounts.rocketEnabled ? paymentAccounts.rocketLabel : 'Disabled'}): ${paymentAccounts.rocket}
- Upay (${paymentAccounts.upayEnabled ? paymentAccounts.upayLabel : 'Disabled'}): ${paymentAccounts.upay}
- Bank Transfer Accounts:
${banksText}

Support & Contact:
- Phone: ${paymentAccounts.supportPhone}
- Email: ${paymentAccounts.supportEmail}
- Website: ${paymentAccounts.website}`;
  }, [userProfile, totalDueAmount, subscriptions, payments, invoices, paymentAccounts]);

  const openCheckoutFor = (sub: Subscription | null) => {
    setSelectedSub(sub);
    setCheckoutOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingProfile) return;

    const cleanName = editName.trim();
    const cleanCompany = editCompany.trim() || cleanName;
    const cleanPhone = editPhone.trim();

    if (!cleanName || cleanName.length < 1) {
      showToast('Please enter your name.', 'error');
      return;
    }
    if (!cleanPhone || cleanPhone.length < 6) {
      showToast('Please enter a valid phone number.', 'error');
      return;
    }

    const uid = userProfile.uid || auth.currentUser?.uid;
    if (!uid) return;

    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'users', uid), {
        name: cleanName,
        companyName: cleanCompany,
        phone: cleanPhone,
        avatarUrl: editAvatar,
      });
      showToast('Profile updated!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Could not update profile. Please try again.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file.', 'error');
      return;
    }
    try {
      const compressed = await compressAvatarImage(file);
      setEditAvatar(compressed);
      showToast('Photo ready — click Save Profile to apply.', 'info');
    } catch {
      showToast('Could not process this image.', 'error');
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut(auth);
      showToast('Signed out', 'info');
    } catch {
      showToast('Could not sign out. Try again.', 'error');
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-24 text-slate-900 dark:bg-[#060D1A] dark:text-slate-100">
      {/* Dynamic Client Top Navbar (56px) */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-[#0B162B]/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="flex min-w-0 items-center gap-2.5 text-left transition hover:opacity-85"
          >
            {userProfile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userProfile.avatarUrl}
                alt={userProfile.name}
                className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0B2447] to-[#1D6E8C] text-xs font-bold text-white shadow-xs">
                {getInitials(userProfile.name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-[#0B2447] dark:text-white">
                {userProfile.name}
              </p>
              <p className="truncate text-[11px] font-medium text-[#1D6E8C] dark:text-[#38BDF8]">
                {userProfile.companyName}
                {userProfile.clientCode ? ` · ${userProfile.clientCode}` : ''}
              </p>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-1.5">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              aria-label="Open settings"
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition active:scale-[0.96] ${
                activeTab === 'settings'
                  ? 'border-[#1D6E8C]/40 bg-[#1D6E8C]/10 text-[#1D6E8C] dark:border-[#38BDF8]/40 dark:bg-[#38BDF8]/15 dark:text-[#38BDF8]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#0B162B] dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Settings className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 pt-5">
        {loadingData ? (
          <div className="flex flex-col items-center justify-center py-20 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-7 w-7 animate-spin text-[#1D6E8C] dark:text-[#38BDF8]" />
            <p className="mt-3">Syncing your services &amp; invoices...</p>
          </div>
        ) : (
          <>
            {activeTab === 'services' && (
              <div className="space-y-6">
                {justRegisteredId && (
                  <section className="rounded-3xl border border-emerald-200 bg-emerald-50/90 p-4 text-emerald-950 shadow-xs dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          Registration Successful
                        </p>
                        <p className="text-sm font-semibold">
                          Your Client ID is{' '}
                          <span className="font-mono-tabular font-bold text-[#0B2447] dark:text-white">
                            {justRegisteredId}
                          </span>
                        </p>
                        <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">
                          Save this ID! Next time you can sign in using{' '}
                          <span className="font-mono-tabular font-semibold">{justRegisteredId}</span>{' '}
                          and your password.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={dismissWelcomeBanner}
                        aria-label="Dismiss welcome banner"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyClientId(justRegisteredId)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-xs font-semibold text-white transition hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                      >
                        {copiedClientId ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>{copiedClientId ? 'Copied!' : 'Copy Client ID'}</span>
                      </button>
                    </div>
                  </section>
                )}

                {/* Mobile-First Executive Balance Hero Card */}
                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B2447] via-[#113366] to-[#1D6E8C] p-5 text-white shadow-lg shadow-[#0B2447]/15 dark:border dark:border-[#38BDF8]/20">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#38BDF8]/15 blur-2xl"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-[#E5A93B]/15 blur-2xl"
                  />

                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-sky-200/90">
                        {userProfile.companyName}
                      </p>
                      <h1 className="mt-0.5 text-lg font-bold tracking-tight">
                        {totalDueAmount > 0 ? 'Balance Due Soon' : 'All Services Active'}
                      </h1>
                    </div>
                    {userProfile.clientCode && (
                      <button
                        type="button"
                        onClick={() => handleCopyClientId(userProfile.clientCode!)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 font-mono-tabular text-[11px] font-semibold text-white backdrop-blur-xs transition active:scale-95 hover:bg-white/20"
                        title="Copy Client ID"
                      >
                        <span>{userProfile.clientCode}</span>
                        {copiedClientId ? (
                          <Check className="h-3 w-3 text-emerald-300" />
                        ) : (
                          <Copy className="h-3 w-3 opacity-80" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="relative mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-sky-200/75">
                        Total Payable
                      </p>
                      <p className="mt-0.5 font-mono-tabular text-3xl font-extrabold tracking-tight text-[#E5A93B]">
                        {formatBDT(totalDueAmount)}
                      </p>
                    </div>
                    {payableSubscriptions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (payableSubscriptions.length === 1) {
                            openCheckoutFor(payableSubscriptions[0]);
                          } else {
                            setActiveTab('pay');
                          }
                        }}
                        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#E5A93B] px-4 text-xs font-bold text-[#0B2447] shadow-sm transition hover:bg-[#f0b952] active:scale-95"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        <span>Pay Now</span>
                      </button>
                    )}
                  </div>

                  <div className="relative mt-4 grid grid-cols-3 gap-2 border-t border-white/15 pt-3 text-center">
                    <div className="rounded-xl bg-white/8 px-2 py-1.5">
                      <p className="font-mono-tabular text-sm font-bold text-white">
                        {subscriptions.length}
                      </p>
                      <p className="text-[10px] text-sky-100/75">Services</p>
                    </div>
                    <div className="rounded-xl bg-white/8 px-2 py-1.5">
                      <p className="font-mono-tabular text-sm font-bold text-white">
                        {invoices.length}
                      </p>
                      <p className="text-[10px] text-sky-100/75">Invoices</p>
                    </div>
                    <div className="rounded-xl bg-white/8 px-2 py-1.5">
                      <p className="font-mono-tabular text-sm font-bold text-white">
                        {payments.filter((p) => p.status === 'pending').length}
                      </p>
                      <p className="text-[10px] text-sky-100/75">Pending</p>
                    </div>
                  </div>
                </section>

                {/* Mobile Fintech Quick Actions Row */}
                <section aria-label="Quick actions" className="grid grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('pay');
                      if (payableSubscriptions.length === 1) {
                        openCheckoutFor(payableSubscriptions[0]);
                      }
                    }}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs transition active:scale-95 dark:border-slate-800 dark:bg-[#0B162B]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-semibold text-[#0B2447] dark:text-slate-200">
                      Pay
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs transition active:scale-95 dark:border-slate-800 dark:bg-[#0B162B]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/12 text-[#D4941F] dark:text-[#E5A93B]">
                      <History className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-semibold text-[#0B2447] dark:text-slate-200">
                      History
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('invoices')}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs transition active:scale-95 dark:border-slate-800 dark:bg-[#0B162B]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1D6E8C]/12 text-[#1D6E8C] dark:text-[#38BDF8]">
                      <FileText className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-semibold text-[#0B2447] dark:text-slate-200">
                      Invoices
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('all_services')}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs transition active:scale-95 dark:border-slate-800 dark:bg-[#0B162B]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B2447]/10 text-[#0B2447] dark:bg-slate-800 dark:text-sky-300">
                      <LayoutGrid className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-semibold text-[#0B2447] dark:text-slate-200">
                      Services
                    </span>
                  </button>
                </section>

                {/* My Services & Subscriptions */}
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-bold text-[#0B2447] dark:text-white">
                      My Services &amp; Subscriptions
                    </h2>
                  </div>

                  {subscriptions.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-[#0B162B] dark:text-slate-400">
                      No active subscriptions assigned yet. Contact Hasanah Tech Solutions to
                      activate a plan.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
                      {subscriptions.map((sub) => {
                        const pending = sub.status === 'pending_verification';
                        const dueSoonFlag = isDueSoon(sub.nextDueDate);

                        return (
                          <article
                            key={sub.id}
                            className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#0B162B]"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-3">
                                <h3 className="text-base font-bold leading-snug text-[#0B2447] dark:text-white">
                                  {sub.serviceName}
                                </h3>
                                <p className="font-mono-tabular text-lg font-bold text-[#0B2447] dark:text-[#E5A93B] whitespace-nowrap shrink-0">
                                  {formatBDT(sub.amount)}
                                </p>
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-medium capitalize">{sub.billingCycle}</span>
                                <span aria-hidden="true">·</span>
                                <span>Next due {formatTimestampDate(sub.nextDueDate)}</span>
                              </div>

                              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                                <SubscriptionStatusIndicator
                                  status={sub.status}
                                  dueSoon={dueSoonFlag}
                                />
                              </div>
                            </div>

                            {pending && (
                              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Verification in Progress</span>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Recent Payment Activity */}
                {payments.length > 0 && (
                  <section>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-base font-bold text-[#0B2447] dark:text-white">
                        Recent Activity
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className="text-xs font-semibold text-[#1D6E8C] hover:underline dark:text-[#38BDF8]"
                      >
                        See all →
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {payments.slice(0, 4).map((pay) => (
                        <div
                          key={pay.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0B162B]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#0B2447] dark:text-white">
                              {pay.serviceName}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <PaymentMethodBadge method={pay.method} />
                              <span className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                                {pay.trxId}
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono-tabular text-sm font-bold text-[#0B2447] dark:text-white">
                              {formatBDT(pay.amount)}
                            </p>
                            <div className="mt-1">
                              <PaymentStatusIndicator status={pay.status} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Official Agency Support Footer */}
                <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0B162B]">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#0B2447] dark:text-white">
                        Hasanah Tech Solutions Billing Desk
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Need help with a transfer or TrxID verification? Reach us directly.
                      </p>
                    </div>
                    <AgencyContactStrip
                      phone={paymentAccounts.supportPhone}
                      email={paymentAccounts.supportEmail}
                      website={paymentAccounts.website}
                    />
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'pay' && (
              <div className="space-y-4">
                <div>
                  <h1 className="text-xl font-bold text-[#0B2447] dark:text-white">
                    Make a Payment
                  </h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Choose a service below to pay via MFS or corporate Bank Transfer.
                  </p>
                </div>

                {payableSubscriptions.length === 0 ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-[#0B162B]">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-[#1D6E8C] dark:text-[#38BDF8]" />
                    <h2 className="mt-3 text-base font-bold text-[#0B2447] dark:text-white">
                      No Pending Payments Required
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Your submitted payments are currently under verification or no services are
                      due.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {payableSubscriptions.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => openCheckoutFor(sub)}
                        className="flex min-h-[76px] w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#1D6E8C] active:scale-[0.99] dark:border-slate-800 dark:bg-[#0B162B] dark:hover:border-[#38BDF8]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#0B2447] dark:text-white">
                            {sub.serviceName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {sub.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} · Due{' '}
                            {formatTimestampDate(sub.nextDueDate)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-mono-tabular text-base font-bold text-[#1D6E8C] dark:text-[#E5A93B]">
                            {formatBDT(sub.amount)}
                          </span>
                          <ChevronRight className="h-5 w-5 text-slate-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'invoices' && (
              <div className="space-y-4">
                <div>
                  <h1 className="text-xl font-bold text-[#0B2447] dark:text-white">
                    Digital Invoices
                  </h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Tap any verified receipt to view or download a PDF copy.
                  </p>
                </div>

                {invoices.length === 0 ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-[#0B162B]">
                    <Receipt className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                      No paid invoices yet
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Invoices appear instantly once your payment TrxID is approved.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {invoices.map((inv) => (
                      <button
                        key={inv.id}
                        type="button"
                        onClick={() => setActiveInvoice(inv)}
                        className="flex min-h-[76px] w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#1D6E8C] active:scale-[0.99] dark:border-slate-800 dark:bg-[#0B162B] dark:hover:border-[#38BDF8]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono-tabular text-xs font-bold text-[#1D6E8C] dark:text-[#38BDF8]">
                              {inv.invoiceNumber}
                            </span>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                              ·
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {formatTimestampDate(inv.issuedAt)}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold text-[#0B2447] dark:text-white">
                            {inv.serviceName}
                          </p>
                          <p className="mt-0.5 font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                            TrxID: {inv.trxId}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <div className="text-right">
                            <p className="font-mono-tabular text-sm font-bold text-[#0B2447] dark:text-white">
                              {formatBDT(inv.amount)}
                            </p>
                            <p className="mt-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              PAID
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4">
                <div>
                  <h1 className="text-xl font-bold text-[#0B2447] dark:text-white">
                    Payment History
                  </h1>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Track all your submitted payments and verification statuses.
                  </p>
                </div>

                {payments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-[#0B162B] dark:text-slate-400">
                    No payment submissions yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {payments.map((pay) => (
                      <div
                        key={pay.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-xs dark:border-slate-800 dark:bg-[#0B162B]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#0B2447] dark:text-white">
                            {pay.serviceName}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <PaymentMethodBadge method={pay.method} />
                            <span className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                              {pay.trxId}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono-tabular text-sm font-bold text-[#0B2447] dark:text-white">
                            {formatBDT(pay.amount)}
                          </p>
                          <div className="mt-1">
                            <PaymentStatusIndicator status={pay.status} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'all_services' && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-xl font-bold text-[#0B2447] dark:text-white">
                    Services &amp; Quick Menu
                  </h1>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    All your services, billing tools, and account options in one place.
                  </p>
                </div>

                {/* All Quick Options Grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('services')}
                    className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-[#1D6E8C]/40 active:scale-[0.98] dark:border-slate-800 dark:bg-[#0B162B]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B2447]/10 text-[#0B2447] dark:bg-[#38BDF8]/15 dark:text-[#38BDF8]">
                      <Home className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#0B2447] dark:text-white">Home</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Balance &amp; overview
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('pay');
                      if (payableSubscriptions.length === 1) {
                        openCheckoutFor(payableSubscriptions[0]);
                      }
                    }}
                    className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-[#1D6E8C]/40 active:scale-[0.98] dark:border-slate-800 dark:bg-[#0B162B]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#0B2447] dark:text-white">Pay Now</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {payableSubscriptions.length} payable due
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-[#1D6E8C]/40 active:scale-[0.98] dark:border-slate-800 dark:bg-[#0B162B]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/12 text-[#D4941F] dark:text-[#E5A93B]">
                      <History className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#0B2447] dark:text-white">History</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {payments.length} submissions
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('invoices')}
                    className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-[#1D6E8C]/40 active:scale-[0.98] dark:border-slate-800 dark:bg-[#0B162B]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1D6E8C]/12 text-[#1D6E8C] dark:text-[#38BDF8]">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#0B2447] dark:text-white">Invoices</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {invoices.length} paid receipts
                      </p>
                    </div>
                  </button>

                  {biometricSupported && (
                    <button
                      type="button"
                      onClick={() => setBiometricSheetOpen(true)}
                      className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-[#1D6E8C]/40 active:scale-[0.98] dark:border-slate-800 dark:bg-[#0B162B]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400">
                        <Fingerprint className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#0B2447] dark:text-white">
                          Biometric
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {enrolledBiometric ? 'Active on device' : 'Set up quick login'}
                        </p>
                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-[#1D6E8C]/40 active:scale-[0.98] dark:border-slate-800 dark:bg-[#0B162B]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <Settings className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#0B2447] dark:text-white">Settings</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Profile, theme &amp; logout
                      </p>
                    </div>
                  </button>
                </div>

                {/* Subscribed Services Summary */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[#0B2447] dark:text-white">
                      Your Subscribed Services ({subscriptions.length})
                    </h2>
                  </div>
                  {subscriptions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-[#0B162B] dark:text-slate-400">
                      No active subscriptions yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {subscriptions.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-[#0B162B]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#0B2447] dark:text-white">
                              {sub.serviceName}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              Next due: {formatTimestampDate(sub.nextDueDate)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2.5">
                            <div className="text-right">
                              <p className="font-mono-tabular text-sm font-bold text-[#0B2447] dark:text-white">
                                {formatBDT(sub.amount)}
                              </p>
                              <SubscriptionStatusIndicator status={sub.status} />
                            </div>
                            {sub.status !== 'pending_verification' && (
                              <button
                                type="button"
                                onClick={() => openCheckoutFor(sub)}
                                className="inline-flex h-9 items-center rounded-xl bg-[#0B2447] px-3 text-xs font-semibold text-white transition hover:bg-[#13386B] dark:bg-[#1D6E8C]"
                              >
                                Pay
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Detailed Agency Services Catalog */}
                <section className="space-y-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#0B2447] dark:text-white">
                      What We Offer — Hasanah Tech Solutions
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Tap any service to view full deliverables and details.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {AGENCY_SERVICES.map((svc) => {
                      const Icon = svc.icon;
                      const isOpen = expandedServiceId === svc.id;
                      return (
                        <div
                          key={svc.id}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition dark:border-slate-800 dark:bg-[#0B162B]"
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedServiceId(isOpen ? '' : svc.id)}
                            className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-slate-50/70 dark:hover:bg-slate-900/40"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1D6E8C]/12 text-[#1D6E8C] dark:bg-[#38BDF8]/15 dark:text-[#38BDF8]">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-bold text-[#0B2447] dark:text-white">
                                    {svc.title}
                                  </p>
                                  <span className="rounded-full bg-[#0B2447]/8 px-2 py-0.5 text-[10px] font-semibold text-[#1D6E8C] dark:bg-[#38BDF8]/15 dark:text-[#38BDF8]">
                                    {svc.tag}
                                  </span>
                                </div>
                                <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                                  {svc.summary}
                                </p>
                              </div>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                                isOpen ? 'rotate-180 text-[#1D6E8C] dark:text-[#38BDF8]' : ''
                              }`}
                            />
                          </button>

                          {isOpen && (
                            <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                {svc.summary}
                              </p>
                              <ul className="mt-2.5 space-y-1.5">
                                {svc.features.map((feat) => (
                                  <li
                                    key={feat}
                                    className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200"
                                  >
                                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    <span>{feat}</span>
                                  </li>
                                ))}
                              </ul>
                              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                                <a
                                  href={`tel:${paymentAccounts.supportPhone}`}
                                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0B2447] px-3.5 text-xs font-semibold text-white transition hover:bg-[#13386B] dark:bg-[#1D6E8C] dark:hover:bg-[#2583A6]"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                  <span>Call to Order</span>
                                </a>
                                <a
                                  href={`mailto:${paymentAccounts.supportEmail}?subject=${encodeURIComponent(`Inquiry: ${svc.title}`)}`}
                                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                  <span>Email Us</span>
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Support Contact */}
                <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0B162B]">
                  <p className="text-xs font-bold text-[#0B2447] dark:text-white">
                    Hasanah Tech Solutions Support
                  </p>
                  <div className="mt-2">
                    <AgencyContactStrip
                      phone={paymentAccounts.supportPhone}
                      email={paymentAccounts.supportEmail}
                      website={paymentAccounts.website}
                    />
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="mx-auto max-w-xl space-y-5">
                <div>
                  <h1 className="text-xl font-bold text-[#0B2447] dark:text-white">
                    Account &amp; Settings
                  </h1>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Update your profile photo, personal details, theme, and security.
                  </p>
                </div>

                {/* Profile Card & Form */}
                <form
                  onSubmit={handleSaveProfile}
                  className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#0B162B]"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    {editAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={editAvatar}
                        alt={editName || userProfile.name}
                        className="h-16 w-16 shrink-0 rounded-full border-2 border-[#1D6E8C]/30 object-cover dark:border-[#38BDF8]/30"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0B2447] to-[#1D6E8C] text-lg font-bold text-white">
                        {getInitials(editName || userProfile.name)}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-[#0B2447] px-3.5 text-xs font-semibold text-white transition hover:bg-[#13386B] dark:bg-[#1D6E8C] dark:hover:bg-[#2583A6]">
                        <Camera className="h-3.5 w-3.5" />
                        <span>Change Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarFileChange}
                          className="sr-only"
                        />
                      </label>
                      {editAvatar && (
                        <button
                          type="button"
                          onClick={() => setEditAvatar('')}
                          className="inline-flex h-10 items-center gap-1 rounded-xl border border-rose-200 px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {userProfile.clientCode && (
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-900/70">
                      <div>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Client ID
                        </p>
                        <p className="font-mono-tabular text-sm font-bold text-[#0B2447] dark:text-white">
                          {userProfile.clientCode}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyClientId(userProfile.clientCode!)}
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {copiedClientId ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>{copiedClientId ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <User className="h-3.5 w-3.5 text-[#1D6E8C] dark:text-[#38BDF8]" />
                        <span>Full Name</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 focus:border-[#1D6E8C] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <Building2 className="h-3.5 w-3.5 text-[#1D6E8C] dark:text-[#38BDF8]" />
                        <span>Company / Business Name</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editCompany}
                        onChange={(e) => setEditCompany(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 focus:border-[#1D6E8C] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <Phone className="h-3.5 w-3.5 text-[#1D6E8C] dark:text-[#38BDF8]" />
                        <span>Phone Number</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 focus:border-[#1D6E8C] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <Mail className="h-3.5 w-3.5" />
                        <span>Registered Email</span>
                      </label>
                      <input
                        type="email"
                        disabled
                        value={userProfile.email}
                        className="h-11 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3.5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0B2447] to-[#1D6E8C] text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
                  >
                    {savingProfile ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        <span>Save Profile</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Appearance: Dark / Light Mode */}
                <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0B162B]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#0B2447] dark:bg-slate-800 dark:text-[#E5A93B]">
                        {theme === 'dark' ? (
                          <Moon className="h-5 w-5" />
                        ) : (
                          <Sun className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#0B2447] dark:text-white">
                          Appearance Theme
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {theme === 'dark' ? 'Dark Mode is active' : 'Light Mode is active'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={theme === 'dark'}
                      onClick={toggleTheme}
                      className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full transition-colors ${
                        theme === 'dark' ? 'bg-[#1D6E8C]' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                          theme === 'dark' ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </section>

                {/* Security: Biometric Quick Sign-In */}
                {biometricSupported && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0B162B]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1D6E8C]/12 text-[#1D6E8C] dark:bg-[#38BDF8]/15 dark:text-[#38BDF8]">
                          <Fingerprint className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#0B2447] dark:text-white">
                            {biometricLabel} Quick Sign-In
                          </p>
                          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {enrolledBiometric
                              ? `Enabled for ${enrolledBiometric.email}`
                              : 'Enable instant sign-in on this device'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBiometricSheetOpen(true)}
                        className="inline-flex min-h-[44px] shrink-0 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-[#0B2447] transition hover:bg-slate-100 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        {enrolledBiometric ? 'Manage' : 'Enable'}
                      </button>
                    </div>
                  </section>
                )}

                {/* Sign Out */}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 text-sm font-semibold text-rose-600 transition hover:bg-rose-100/70 disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50"
                >
                  {loggingOut ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Signing out...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Fixed Mobile Bottom Navigation Bar with Elevated Center Home Button */}
      <nav
        aria-label="Client navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-md pb-safe dark:border-slate-800 dark:bg-[#0B162B]/95"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center px-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('pay');
              if (payableSubscriptions.length === 1) {
                openCheckoutFor(payableSubscriptions[0]);
              }
            }}
            className={`flex h-full flex-col items-center justify-center gap-1 transition active:scale-95 ${
              activeTab === 'pay'
                ? 'text-[#1D6E8C] dark:text-[#38BDF8]'
                : 'text-slate-500 hover:text-[#0B2447] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <CreditCard className="h-5 w-5" />
            <span className="text-[10px] font-semibold tracking-tight">Pay</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex h-full flex-col items-center justify-center gap-1 transition active:scale-95 ${
              activeTab === 'history'
                ? 'text-[#1D6E8C] dark:text-[#38BDF8]'
                : 'text-slate-500 hover:text-[#0B2447] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <History className="h-5 w-5" />
            <span className="text-[10px] font-semibold tracking-tight">History</span>
          </button>

          {/* Elevated Center Floating Home Button */}
          <div className="flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => setActiveTab('services')}
              aria-label="Home"
              className={`-mt-6 flex h-14 w-14 items-center justify-center rounded-full border-4 border-slate-50 shadow-lg transition-transform active:scale-95 dark:border-[#060D1A] ${
                activeTab === 'services'
                  ? 'bg-gradient-to-br from-[#0B2447] via-[#13386B] to-[#1D6E8C] text-white shadow-[#1D6E8C]/35 ring-2 ring-[#1D6E8C]/25 dark:ring-[#38BDF8]/30'
                  : 'bg-gradient-to-br from-[#13386B] to-[#1D6E8C] text-white/90 shadow-slate-900/20 hover:scale-105'
              }`}
            >
              <Home className="h-6 w-6" />
            </button>
            <span
              className={`mt-0.5 text-[10px] font-bold tracking-tight ${
                activeTab === 'services'
                  ? 'text-[#0B2447] dark:text-[#38BDF8]'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Home
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`flex h-full flex-col items-center justify-center gap-1 transition active:scale-95 ${
              activeTab === 'invoices'
                ? 'text-[#1D6E8C] dark:text-[#38BDF8]'
                : 'text-slate-500 hover:text-[#0B2447] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="h-5 w-5" />
            <span className="text-[10px] font-semibold tracking-tight">Invoices</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all_services')}
            className={`flex h-full flex-col items-center justify-center gap-1 transition active:scale-95 ${
              activeTab === 'all_services'
                ? 'text-[#1D6E8C] dark:text-[#38BDF8]'
                : 'text-slate-500 hover:text-[#0B2447] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[10px] font-semibold tracking-tight">Services</span>
          </button>
        </div>
      </nav>

      {/* Mobile Gateway Checkout Bottom-Sheet */}
      <GatewayCheckoutSheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        subscription={selectedSub}
        payableSubscriptions={payableSubscriptions}
        userProfile={userProfile}
        paymentAccounts={paymentAccounts}
        onSelectSubscription={(sub) => setSelectedSub(sub)}
      />

      {/* Digital Invoice Modal */}
      <DigitalInvoiceModal
        invoice={activeInvoice}
        onClose={() => setActiveInvoice(null)}
        paymentAccounts={paymentAccounts}
      />

      {/* Biometric Device Enrollment Sheet */}
      <BiometricEnrollSheet
        open={biometricSheetOpen}
        onClose={() => setBiometricSheetOpen(false)}
        userProfile={userProfile}
        onStatusChange={refreshBiometricStatus}
      />

      {/* Mobile AI Billing Assistant */}
      <AIChatAssistant
        role="client"
        userName={userProfile.name}
        contextSummary={aiContextSummary}
      />
    </div>
  );
}
