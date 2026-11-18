'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  Fingerprint,
  Layers,
  Loader2,
  LogOut,
  Receipt,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
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
import { AgencyContactStrip, BrandMark } from './BrandMark';
import { PWAInstallButton, ThemeToggleButton } from './PWAWidgets';
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

type ClientTab = 'services' | 'pay' | 'invoices';

export function ClientPortal({ userProfile }: { userProfile: UserProfile }) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ClientTab>('services');
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
      {/* Compact Sticky Mobile Header (56px) */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-[#0B162B]/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-[#0B2447] dark:text-white">
                Hasanah Tech Solutions
              </p>
              <p className="truncate text-[11px] font-medium text-[#1D6E8C] dark:text-[#38BDF8]">
                {userProfile.name}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <PWAInstallButton />
            <ThemeToggleButton />
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Sign out"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 active:scale-[0.96] disabled:opacity-50 dark:border-slate-800 dark:bg-[#0B162B] dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {loggingOut ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <LogOut className="h-5 w-5" />
              )}
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
                {/* Navy/Teal/Gold Executive Summary Banner */}
                <section className="rounded-3xl bg-gradient-to-br from-[#0B2447] via-[#102E5C] to-[#154A6B] p-5 text-white shadow-sm dark:border dark:border-[#1D6E8C]/35">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-sky-200/90">
                        {userProfile.companyName}
                      </p>
                      <h1 className="mt-1 text-xl font-bold tracking-tight">
                        {totalDueAmount > 0 ? 'Balance Due Soon' : 'All Services Active'}
                      </h1>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-sky-200/80">Total Payable</p>
                      <p className="mt-0.5 font-mono-tabular text-2xl font-bold text-[#E5A93B]">
                        {formatBDT(totalDueAmount)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/15 pt-3 text-xs text-sky-100/85">
                    <span>{subscriptions.length} Services</span>
                    <span aria-hidden="true">·</span>
                    <span>{invoices.length} Paid Invoices</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">Support: {paymentAccounts.supportPhone}</span>
                  </div>
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

                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => openCheckoutFor(sub)}
                              className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
                                pending
                                  ? 'cursor-not-allowed bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                                  : 'bg-[#0B2447] text-white hover:bg-[#13386B] dark:bg-[#1D6E8C] dark:hover:bg-[#2583A6]'
                              }`}
                            >
                              {pending ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Verification in Progress</span>
                                </>
                              ) : (
                                <>
                                  <CreditCard className="h-4 w-4 text-[#E5A93B] dark:text-white" />
                                  <span>Pay Now</span>
                                </>
                              )}
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Recent Payment Activity */}
                {payments.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-base font-bold text-[#0B2447] dark:text-white">
                      Recent Payment Submissions
                    </h2>
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

                {/* Biometric Quick Sign-In Device Card */}
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
          </>
        )}
      </main>

      {/* Fixed Bottom Navigation Bar (3 Thumb-Friendly Tabs: Services | Pay | Invoices) */}
      <nav
        aria-label="Client navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-md pb-safe dark:border-slate-800 dark:bg-[#0B162B]/95"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-3 items-center">
          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`flex h-full flex-col items-center justify-center gap-1 transition ${
              activeTab === 'services'
                ? 'text-[#1D6E8C] dark:text-[#38BDF8]'
                : 'text-slate-500 hover:text-[#0B2447] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="h-5 w-5" />
            <span className="text-[11px] font-semibold tracking-tight">Services</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('pay');
              if (payableSubscriptions.length === 1) {
                openCheckoutFor(payableSubscriptions[0]);
              }
            }}
            className={`flex h-full flex-col items-center justify-center gap-1 transition ${
              activeTab === 'pay'
                ? 'text-[#1D6E8C] dark:text-[#38BDF8]'
                : 'text-slate-500 hover:text-[#0B2447] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <CreditCard className="h-5 w-5" />
            <span className="text-[11px] font-semibold tracking-tight">Pay</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`flex h-full flex-col items-center justify-center gap-1 transition ${
              activeTab === 'invoices'
                ? 'text-[#1D6E8C] dark:text-[#38BDF8]'
                : 'text-slate-500 hover:text-[#0B2447] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="h-5 w-5" />
            <span className="text-[11px] font-semibold tracking-tight">Invoices</span>
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
