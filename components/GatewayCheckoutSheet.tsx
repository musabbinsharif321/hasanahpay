'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Building2,
  Check,
  Copy,
  Loader2,
  Send,
  Smartphone,
  X,
} from 'lucide-react';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import {
  DEFAULT_PAYMENT_ACCOUNTS,
  formatBDT,
  PAYMENT_METHODS,
  type PaymentAccountsSetting,
  type PaymentMethodId,
  type Subscription,
  type UserProfile,
} from '@/lib/types';
import { useToast } from './ToastProvider';

interface GatewayCheckoutSheetProps {
  open: boolean;
  onClose: () => void;
  subscription: Subscription | null;
  payableSubscriptions: Subscription[];
  userProfile: UserProfile;
  paymentAccounts: PaymentAccountsSetting;
  onSelectSubscription?: (sub: Subscription) => void;
}

function CheckoutSheetContent({
  onClose,
  subscription,
  payableSubscriptions,
  userProfile,
  paymentAccounts,
  onSelectSubscription,
}: Omit<GatewayCheckoutSheetProps, 'open'>) {
  const { showToast } = useToast();
  const accounts = paymentAccounts || DEFAULT_PAYMENT_ACCOUNTS;

  const availableMethods = useMemo(() => {
    const filtered = PAYMENT_METHODS.filter((m) => {
      switch (m.id) {
        case 'bkash':
          return accounts.bkashEnabled;
        case 'nagad':
          return accounts.nagadEnabled;
        case 'rocket':
          return accounts.rocketEnabled;
        case 'upay':
          return accounts.upayEnabled;
        case 'bank':
          return accounts.bankEnabled && accounts.banks.length > 0;
      }
    }).map((m) => {
      if (m.id === 'bkash') return { ...m, subtitle: accounts.bkashLabel };
      if (m.id === 'nagad') return { ...m, subtitle: accounts.nagadLabel };
      if (m.id === 'rocket') return { ...m, subtitle: accounts.rocketLabel };
      if (m.id === 'upay') return { ...m, subtitle: accounts.upayLabel };
      if (m.id === 'bank') {
        return {
          ...m,
          subtitle:
            accounts.banks.length > 1
              ? `${accounts.banks.length} Corporate Banks`
              : accounts.banks[0]?.bankName || m.subtitle,
        };
      }
      return m;
    });
    return filtered.length > 0 ? filtered : PAYMENT_METHODS;
  }, [accounts]);

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>(
    availableMethods[0]?.id ?? 'bkash'
  );
  const [selectedBankIndex, setSelectedBankIndex] = useState(0);
  const [senderNumber, setSenderNumber] = useState(userProfile.phone || '');
  const [trxId, setTrxId] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const activeSub = subscription ?? payableSubscriptions[0] ?? null;
  const activeMethodMeta =
    availableMethods.find((m) => m.id === selectedMethod) ?? availableMethods[0];
  const effectiveMethod = activeMethodMeta.id;

  const safeBankIndex =
    selectedBankIndex < accounts.banks.length ? selectedBankIndex : 0;
  const activeBank = accounts.banks[safeBankIndex] ?? DEFAULT_PAYMENT_ACCOUNTS.banks[0];

  const getTargetNumber = (): string => {
    switch (effectiveMethod) {
      case 'bkash':
        return accounts.bkash;
      case 'nagad':
        return accounts.nagad;
      case 'rocket':
        return accounts.rocket;
      case 'upay':
        return accounts.upay;
      case 'bank':
        return activeBank.accountNumber;
    }
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      showToast('Copied!', 'success');
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch {
      showToast('Copy failed. Please copy manually.', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSub || submitting) return;

    const cleanSender = senderNumber.trim();
    const cleanTrxId = trxId.trim().toUpperCase().replace(/\s+/g, '');

    if (cleanSender.length < 4) {
      setFormError('Enter your sender wallet number or bank account.');
      return;
    }

    if (!/^[A-Z0-9_-]{4,64}$/.test(cleanTrxId)) {
      setFormError('Transaction ID must be 4–64 alphanumeric characters (e.g. BKH92817A).');
      return;
    }

    setFormError(null);
    setSubmitting(true);

    try {
      const trxLockRef = doc(db, 'trxIds', cleanTrxId);
      const existingTrxSnap = await getDoc(trxLockRef);
      if (existingTrxSnap.exists()) {
        setFormError(
          `Transaction ID "${cleanTrxId}" has already been submitted. Please verify your TrxID.`
        );
        setSubmitting(false);
        return;
      }

      const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const paymentRef = doc(db, 'payments', paymentId);
      const subRef = doc(db, 'subscriptions', activeSub.id);

      const formattedSender =
        effectiveMethod === 'bank' &&
        !cleanSender.toLowerCase().includes(activeBank.bankName.split(' ')[0].toLowerCase())
          ? `${activeBank.bankName.split(' ')[0]} · ${cleanSender}`.slice(0, 50)
          : cleanSender.slice(0, 50);

      const batch = writeBatch(db);
      batch.set(trxLockRef, {
        trxId: cleanTrxId,
        clientId: userProfile.uid,
        paymentId,
        createdAt: serverTimestamp(),
      });

      batch.set(paymentRef, {
        id: paymentId,
        clientId: userProfile.uid,
        clientName: userProfile.name,
        subscriptionId: activeSub.id,
        serviceName: activeSub.serviceName,
        method: effectiveMethod,
        senderNumber: formattedSender,
        trxId: cleanTrxId,
        amount: activeSub.amount,
        status: 'pending',
        submittedAt: serverTimestamp(),
      });

      batch.update(subRef, {
        status: 'pending_verification',
      });

      await batch.commit();
      showToast('Payment submitted! Waiting for admin verification.', 'success');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Missing or insufficient permissions')) {
        try {
          handleFirestoreError(err, OperationType.WRITE, 'payments');
        } catch (wrapped) {
          console.error(wrapped);
        }
      }
      setFormError('Could not submit payment. Check your TrxID and connection, then try again.');
      showToast('Payment submission failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-sheet-title"
    >
      <div className="absolute inset-0" onClick={() => !submitting && onClose()} />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0B162B] sm:rounded-3xl"
      >
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <div>
            <h2
              id="checkout-sheet-title"
              className="text-base font-bold text-[#0B2447] dark:text-white"
            >
              Gateway Checkout
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Send payment &amp; submit TrxID for instant verification
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close checkout"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {!activeSub ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
              All your services are currently pending verification or up to date.
            </div>
          ) : (
            <>
              {payableSubscriptions.length > 1 && onSelectSubscription ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Select Service to Pay
                  </label>
                  <select
                    value={activeSub.id}
                    onChange={(e) => {
                      const found = payableSubscriptions.find((s) => s.id === e.target.value);
                      if (found) onSelectSubscription(found);
                    }}
                    className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 focus:border-[#1D6E8C] focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                  >
                    {payableSubscriptions.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.serviceName} — {formatBDT(sub.amount)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="flex items-center justify-between rounded-2xl border border-[#0B2447]/15 bg-slate-50 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="min-w-0 pr-3">
                  <p className="truncate text-sm font-semibold text-[#0B2447] dark:text-white">
                    {activeSub.serviceName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {activeSub.billingCycle === 'yearly' ? 'Yearly Plan' : 'Monthly Plan'}
                  </p>
                </div>
                <p className="font-mono-tabular text-lg font-bold text-[#0B2447] dark:text-[#E5A93B] whitespace-nowrap shrink-0">
                  {formatBDT(activeSub.amount)}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  1. Choose Payment Method
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {availableMethods.map((method) => {
                    const active = effectiveMethod === method.id;
                    const Icon = method.id === 'bank' ? Building2 : Smartphone;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSelectedMethod(method.id)}
                        className={`flex min-h-[58px] flex-col items-start justify-center rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                          active
                            ? `${method.borderClass} ${method.badgeBgClass} ring-2 ${method.ringClass}`
                            : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-[#0B162B] dark:hover:bg-slate-800/70'
                        } ${method.id === 'bank' ? 'col-span-2 sm:col-span-2' : ''}`}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                            <Icon
                              className="h-4 w-4 shrink-0"
                              style={{ color: method.accentHex }}
                            />
                            <span className="text-[#0B2447] dark:text-slate-100">
                              {method.name}
                            </span>
                          </span>
                          {active && (
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: method.accentHex }}
                            />
                          )}
                        </div>
                        <span className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400 w-full">
                          {method.subtitle}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className="rounded-2xl border p-4 transition-colors"
                style={{
                  borderColor: `${activeMethodMeta.accentHex}44`,
                  backgroundColor: `${activeMethodMeta.accentHex}0D`,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    2. Send {formatBDT(activeSub.amount)} to {activeMethodMeta.name}
                  </span>
                  <span
                    className="rounded-md px-2 py-0.5 text-[11px] font-bold text-white"
                    style={{ backgroundColor: activeMethodMeta.accentHex }}
                  >
                    {activeMethodMeta.name}
                  </span>
                </div>

                {effectiveMethod === 'bank' ? (
                  <div className="mt-3 space-y-3 text-xs">
                    {/* Multi-Bank Switcher */}
                    {accounts.banks.length > 1 && (
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                        {accounts.banks.map((bank, idx) => {
                          const isBankSelected = safeBankIndex === idx;
                          return (
                            <button
                              key={bank.id}
                              type="button"
                              onClick={() => setSelectedBankIndex(idx)}
                              className={`min-h-[44px] rounded-xl border px-3 py-2 text-left transition ${
                                isBankSelected
                                  ? 'border-[#1D6E8C] bg-[#0B2447] text-white shadow-xs dark:border-[#38BDF8] dark:bg-[#1D6E8C]'
                                  : 'border-slate-200 bg-white/90 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300'
                              }`}
                            >
                              <span
                                className={`block text-[10px] font-bold ${
                                  isBankSelected ? 'text-[#E5A93B]' : 'text-[#D4941F]'
                                }`}
                              >
                                0{idx + 1}
                              </span>
                              <span className="block truncate text-xs font-semibold">
                                {bank.bankName}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Selected Bank Details */}
                    <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-white/90 p-3.5 dark:bg-slate-950/75">
                      <div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Bank</span>
                        <p className="font-semibold text-[#0B2447] dark:text-white">
                          {activeBank.bankName}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Branch
                        </span>
                        <p className="font-semibold text-[#0B2447] dark:text-white">
                          {activeBank.branch}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Account Name
                        </span>
                        <p className="font-semibold text-[#0B2447] dark:text-white">
                          {activeBank.accountName}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Account Type
                        </span>
                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                          {activeBank.accountType}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Account Number
                        </span>
                        <p className="font-mono-tabular text-sm font-bold text-[#0B2447] dark:text-[#E5A93B]">
                          {activeBank.accountNumber}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Routing No.
                        </span>
                        <div className="flex items-center gap-1.5">
                          <p className="font-mono-tabular font-semibold text-[#0B2447] dark:text-white">
                            {activeBank.routingNumber}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(activeBank.routingNumber, `routing_${activeBank.id}`)
                            }
                            aria-label="Copy routing number"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {copiedField === `routing_${activeBank.id}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(activeBank.accountNumber, 'bank')}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2447] text-xs font-semibold text-white transition active:scale-[0.98] dark:bg-[#1D6E8C]"
                    >
                      {copiedField === 'bank' ? (
                        <>
                          <Check className="h-4 w-4 text-[#E5A93B] dark:text-white" />
                          <span>Copied {activeBank.bankName} A/C!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 text-[#E5A93B] dark:text-white" />
                          <span>Tap to Copy Account Number</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-xl bg-white/95 px-4 py-3 text-center dark:bg-slate-950/75">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {activeMethodMeta.subtitle}
                      </p>
                      <p className="mt-0.5 font-mono-tabular text-2xl font-bold tracking-wider text-[#0B2447] dark:text-white">
                        {getTargetNumber()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(getTargetNumber(), effectiveMethod)}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2447] text-xs font-semibold text-white transition active:scale-[0.98] dark:bg-slate-100 dark:text-[#0B2447]"
                    >
                      {copiedField === effectiveMethod ? (
                        <>
                          <Check className="h-4 w-4 text-[#E5A93B] dark:text-[#1D6E8C]" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Tap to Copy Number</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3.5">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  3. Confirm Payment Details
                </p>

                <div>
                  <label
                    htmlFor="sender-number-input"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    {effectiveMethod === 'bank'
                      ? `Sender Account / Reference (${activeBank.bankName})`
                      : 'Sender Mobile Number'}
                  </label>
                  <input
                    id="sender-number-input"
                    type="text"
                    inputMode={effectiveMethod === 'bank' ? 'text' : 'tel'}
                    required
                    value={senderNumber}
                    onChange={(e) => setSenderNumber(e.target.value)}
                    placeholder={
                      effectiveMethod === 'bank'
                        ? `e.g. A/C 00912837 (${activeBank.bankName.split(' ')[0]})`
                        : 'e.g. 01712-345678'
                    }
                    className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-mono-tabular text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-[#1D6E8C] focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white dark:focus:border-[#38BDF8]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="trx-id-input"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Transaction ID (TrxID)
                  </label>
                  <input
                    id="trx-id-input"
                    type="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    value={trxId}
                    onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                    placeholder="e.g. BKH8A92C10"
                    className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-mono-tabular text-sm uppercase tracking-wide text-slate-900 placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:border-[#1D6E8C] focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white dark:focus:border-[#38BDF8]"
                  />
                </div>

                {formError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                    {formError}
                  </div>
                )}
              </div>
            </>
          )}

          {activeSub && (
            <div className="pt-1 pb-safe">
              <button
                type="submit"
                disabled={submitting}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2447] text-sm font-semibold text-white shadow-sm transition hover:bg-[#13386B] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#1D6E8C] dark:hover:bg-[#2583A6]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Submitting Payment...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 text-[#E5A93B] dark:text-white" />
                    <span>Submit for Verification</span>
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </motion.div>
    </div>
  );
}

export function GatewayCheckoutSheet({ open, ...rest }: GatewayCheckoutSheetProps) {
  return (
    <AnimatePresence>
      {open ? <CheckoutSheetContent key={rest.subscription?.id ?? 'default'} {...rest} /> : null}
    </AnimatePresence>
  );
}
