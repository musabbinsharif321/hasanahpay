'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Database,
  Fingerprint,
  Loader2,
  LogOut,
  Plus,
  Receipt,
  RotateCcw,
  Save,
  Settings,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  getSecondaryAuth,
  handleFirestoreError,
  OperationType,
} from '@/lib/firebase';
import {
  calculateExtendedDueDate,
  DEFAULT_PAYMENT_ACCOUNTS,
  formatBDT,
  formatTimestampDate,
  generateNextInvoiceNumber,
  normalizePaymentAccounts,
  type BankAccountDetails,
  type BillingCycle,
  type Invoice,
  type Payment,
  type PaymentAccountsSetting,
  type Subscription,
  type UserProfile,
} from '@/lib/types';
import { BrandMark } from './BrandMark';
import { PWAInstallButton, ThemeToggleButton } from './PWAWidgets';
import {
  PaymentMethodBadge,
  PaymentStatusIndicator,
  SubscriptionStatusIndicator,
} from './PaymentMethodBadge';
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

type AdminTab = 'approvals' | 'clients' | 'settings';
type AddSheetMode = 'new_client' | 'assign_service';

export function AdminDashboard({ userProfile }: { userProfile: UserProfile }) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>('approvals');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accountsForm, setAccountsForm] =
    useState<PaymentAccountsSetting>(DEFAULT_PAYMENT_ACCOUNTS);
  const [loadingData, setLoadingData] = useState(true);

  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);
  const [copiedTrx, setCopiedTrx] = useState<string | null>(null);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Add Client / Service Bottom-Sheet state
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddSheetMode>('new_client');
  const [submittingClient, setSubmittingClient] = useState(false);

  // New Client fields
  const [clientName, setClientName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPassword, setClientPassword] = useState('');

  // Service fields (shared by both modes)
  const [selectedExistingClientId, setSelectedExistingClientId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [serviceAmount, setServiceAmount] = useState('');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [initialStatus, setInitialStatus] = useState<'active' | 'due'>('due');

  // Settings & Seeder state
  const [savingSettings, setSavingSettings] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
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
    let loadedUsers = false;
    let loadedSubs = false;
    let loadedPays = false;
    let loadedInvs = false;

    const checkReady = () => {
      if (loadedUsers && loadedSubs && loadedPays && loadedInvs) {
        setLoadingData(false);
      }
    };

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as Partial<UserProfile>;
          return {
            ...data,
            uid: data.uid || d.id,
          } as UserProfile;
        });
        setUsers(list);
        loadedUsers = true;
        checkReady();
      },
      (err) => {
        setLoadingData(false);
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    );

    const unsubSubs = onSnapshot(
      collection(db, 'subscriptions'),
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as Partial<Subscription>;
          return {
            ...data,
            id: data.id || d.id,
          } as Subscription;
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
      collection(db, 'payments'),
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as Partial<Payment>;
          return {
            ...data,
            id: data.id || d.id,
          } as Payment;
        });
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
      collection(db, 'invoices'),
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as Partial<Invoice>;
          return {
            ...data,
            id: data.id || d.id,
          } as Invoice;
        });
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
          setAccountsForm(normalizePaymentAccounts(snap.data() as Record<string, unknown>));
        }
      },
      () => {
        // Use official defaults until saved
      }
    );

    return () => {
      unsubUsers();
      unsubSubs();
      unsubPayments();
      unsubInvoices();
      unsubSettings();
    };
  }, []);

  const clients = useMemo(() => users.filter((u) => u.role === 'client'), [users]);
  const pendingPayments = useMemo(
    () => payments.filter((p) => p.status === 'pending'),
    [payments]
  );
  const recentPayments = useMemo(
    () => payments.filter((p) => p.status !== 'pending'),
    [payments]
  );

  const monthlyRecurringRevenue = useMemo(() => {
    return subscriptions.reduce((sum, sub) => {
      if (sub.billingCycle === 'yearly') {
        return sum + Math.round(sub.amount / 12);
      }
      return sum + sub.amount;
    }, 0);
  }, [subscriptions]);

  const aiContextSummary = useMemo(() => {
    const pendingList =
      pendingPayments.length === 0
        ? 'No pending payments.'
        : pendingPayments
            .map(
              (p) =>
                `- ${p.clientName} (${p.serviceName}): ${formatBDT(p.amount)} via ${p.method}, Sender: ${p.senderNumber}, TrxID: ${p.trxId}`
            )
            .join('\n');
    const dueSubs = subscriptions
      .filter((s) => s.status === 'due')
      .map(
        (s) =>
          `- ${s.clientName}: ${s.serviceName} (${formatBDT(s.amount)}, Due ${formatTimestampDate(s.nextDueDate)})`
      )
      .join('\n');

    const banksSummary = accountsForm.banks
      .map(
        (b, i) =>
          `  ${i + 1}. ${b.bankName} | A/C Name: ${b.accountName} | Type: ${b.accountType} | A/C No: ${b.accountNumber} | Branch: ${b.branch} | Routing: ${b.routingNumber}`
      )
      .join('\n');

    return `Admin Name: ${userProfile.name}
Active Clients: ${clients.length}
Total Subscriptions: ${subscriptions.length}
Monthly Recurring Revenue (MRR): ${formatBDT(monthlyRecurringRevenue)}
Pending Approvals (${pendingPayments.length}):
${pendingList}

Currently Due Subscriptions:
${dueSubs || 'None'}

Receiving Accounts Configured:
- bKash (${accountsForm.bkashEnabled ? accountsForm.bkashLabel : 'Disabled'}): ${accountsForm.bkash}
- Nagad (${accountsForm.nagadEnabled ? accountsForm.nagadLabel : 'Disabled'}): ${accountsForm.nagad}
- Rocket (${accountsForm.rocketEnabled ? accountsForm.rocketLabel : 'Disabled'}): ${accountsForm.rocket}
- Upay (${accountsForm.upayEnabled ? accountsForm.upayLabel : 'Disabled'}): ${accountsForm.upay}
- Bank Transfer (${accountsForm.bankEnabled ? 'Active' : 'Disabled'}):
${banksSummary}

Agency Support Contact:
- Phone: ${accountsForm.supportPhone}
- Email: ${accountsForm.supportEmail}
- Website: ${accountsForm.website}`;
  }, [
    userProfile.name,
    clients.length,
    subscriptions,
    monthlyRecurringRevenue,
    pendingPayments,
    accountsForm,
  ]);

  const handleCopyTrx = async (trxId: string) => {
    try {
      await navigator.clipboard.writeText(trxId);
      setCopiedTrx(trxId);
      showToast(`Copied TrxID: ${trxId}`, 'success');
      window.setTimeout(() => setCopiedTrx(null), 1600);
    } catch {
      showToast('Copy failed', 'error');
    }
  };

  const handleApprovePayment = async (payment: Payment) => {
    if (processingPaymentId) return;
    setProcessingPaymentId(payment.id);

    try {
      const sub = subscriptions.find((s) => s.id === payment.subscriptionId);
      const nextDue = calculateExtendedDueDate(
        sub?.nextDueDate ?? null,
        sub?.billingCycle ?? 'monthly'
      );
      const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const invoiceNumber = generateNextInvoiceNumber(invoices);

      const batch = writeBatch(db);

      batch.update(doc(db, 'payments', payment.id), {
        status: 'approved',
      });

      if (sub) {
        batch.update(doc(db, 'subscriptions', sub.id), {
          status: 'active',
          nextDueDate: Timestamp.fromDate(nextDue),
        });
      }

      batch.set(doc(db, 'invoices', invoiceId), {
        id: invoiceId,
        invoiceNumber,
        paymentId: payment.id,
        clientId: payment.clientId,
        clientName: payment.clientName,
        serviceName: payment.serviceName,
        method: payment.method,
        trxId: payment.trxId,
        amount: payment.amount,
        issuedAt: serverTimestamp(),
      });

      await batch.commit();
      showToast(`Approved & issued ${invoiceNumber}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Approval failed. Please retry.', 'error');
    } finally {
      setProcessingPaymentId(null);
    }
  };

  const handleRejectPayment = async (payment: Payment) => {
    if (processingPaymentId) return;
    setProcessingPaymentId(payment.id);

    try {
      const sub = subscriptions.find((s) => s.id === payment.subscriptionId);
      const batch = writeBatch(db);

      batch.update(doc(db, 'payments', payment.id), {
        status: 'rejected',
      });

      if (sub) {
        batch.update(doc(db, 'subscriptions', sub.id), {
          status: 'due',
        });
      }

      batch.delete(doc(db, 'trxIds', payment.trxId));

      await batch.commit();
      showToast('Payment rejected. Client can now resubmit.', 'info');
    } catch (err) {
      console.error(err);
      showToast('Could not reject payment.', 'error');
    } finally {
      setProcessingPaymentId(null);
    }
  };

  const handleUpdateBankField = (
    index: number,
    field: keyof BankAccountDetails,
    value: string
  ) => {
    setAccountsForm((prev) => ({
      ...prev,
      banks: prev.banks.map((b, idx) => (idx === index ? { ...b, [field]: value } : b)),
    }));
  };

  const handleAddBankAccount = () => {
    if (accountsForm.banks.length >= 6) {
      showToast('Maximum 6 bank accounts can be configured.', 'info');
      return;
    }
    const newId = `bank_${Date.now()}`;
    setAccountsForm((prev) => ({
      ...prev,
      banks: [
        ...prev.banks,
        {
          id: newId,
          bankName: '',
          accountName: 'MUSAB KHAN',
          accountType: 'SAVINGS ACCOUNT',
          accountNumber: '',
          branch: '',
          routingNumber: '',
        },
      ],
    }));
  };

  const handleRemoveBankAccount = (index: number) => {
    if (accountsForm.banks.length <= 1) {
      showToast('Keep at least 1 bank account configured.', 'info');
      return;
    }
    setAccountsForm((prev) => ({
      ...prev,
      banks: prev.banks.filter((_, idx) => idx !== index),
    }));
  };

  const handleLoadOfficialDefaults = () => {
    setAccountsForm(DEFAULT_PAYMENT_ACCOUNTS);
    showToast('Loaded official Hasanah Tech details. Tap Save to apply.', 'info');
  };

  const handleSavePaymentAccounts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingSettings) return;

    const cleanedBanks = accountsForm.banks.map((b, idx) => ({
      id: (b.id || `bank_${idx + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64),
      bankName: b.bankName.trim(),
      accountName: b.accountName.trim(),
      accountType: b.accountType.trim() || 'SAVINGS ACCOUNT',
      accountNumber: b.accountNumber.trim(),
      branch: b.branch.trim(),
      routingNumber: b.routingNumber.trim(),
    }));

    const invalidBank = cleanedBanks.find(
      (b) =>
        b.bankName.length < 2 ||
        b.accountName.length < 2 ||
        b.accountType.length < 2 ||
        b.accountNumber.length < 4 ||
        b.branch.length < 2 ||
        b.routingNumber.length < 2
    );

    if (invalidBank) {
      showToast('Complete all fields for every bank account before saving.', 'error');
      return;
    }

    if (
      accountsForm.bkash.trim().length < 6 ||
      accountsForm.nagad.trim().length < 6 ||
      accountsForm.rocket.trim().length < 6 ||
      accountsForm.upay.trim().length < 6
    ) {
      showToast('Each MFS wallet number must be at least 6 characters.', 'error');
      return;
    }

    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'paymentAccounts'), {
        bkash: accountsForm.bkash.trim(),
        nagad: accountsForm.nagad.trim(),
        rocket: accountsForm.rocket.trim(),
        upay: accountsForm.upay.trim(),
        bkashLabel: accountsForm.bkashLabel.trim() || 'Send Money',
        nagadLabel: accountsForm.nagadLabel.trim() || 'Send Money',
        rocketLabel: accountsForm.rocketLabel.trim() || 'DBBL Mobile Banking',
        upayLabel: accountsForm.upayLabel.trim() || 'UCB Fintech Wallet',
        bkashEnabled: Boolean(accountsForm.bkashEnabled),
        nagadEnabled: Boolean(accountsForm.nagadEnabled),
        rocketEnabled: Boolean(accountsForm.rocketEnabled),
        upayEnabled: Boolean(accountsForm.upayEnabled),
        bankEnabled: Boolean(accountsForm.bankEnabled),
        banks: cleanedBanks,
        supportPhone: accountsForm.supportPhone.trim(),
        supportEmail: accountsForm.supportEmail.trim(),
        website: accountsForm.website.trim(),
        updatedAt: serverTimestamp(),
      });
      showToast('All MFS, bank accounts & contact details saved!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to save payment settings.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateClientOrService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingClient) return;

    const amountNum = Number(serviceAmount);
    if (!serviceName.trim() || Number.isNaN(amountNum) || amountNum <= 0) {
      showToast('Enter a valid service name and amount in BDT.', 'error');
      return;
    }

    setSubmittingClient(true);
    try {
      let targetClientId = selectedExistingClientId;
      let targetClientName =
        clients.find((c) => c.uid === selectedExistingClientId)?.name || '';

      const batch = writeBatch(db);

      if (addMode === 'new_client') {
        if (
          !clientName.trim() ||
          !companyName.trim() ||
          !clientPhone.trim() ||
          !clientEmail.trim() ||
          clientPassword.length < 6
        ) {
          showToast('Complete all client fields (password min 6 chars).', 'error');
          setSubmittingClient(false);
          return;
        }

        const secondaryAuth = getSecondaryAuth();
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          clientEmail.trim(),
          clientPassword
        );
        targetClientId = cred.user.uid;
        targetClientName = clientName.trim();
        await signOut(secondaryAuth);

        batch.set(doc(db, 'users', targetClientId), {
          uid: targetClientId,
          name: targetClientName,
          email: clientEmail.trim(),
          phone: clientPhone.trim(),
          companyName: companyName.trim(),
          role: 'client',
          createdAt: serverTimestamp(),
        });
      } else if (!targetClientId) {
        showToast('Select a client first.', 'error');
        setSubmittingClient(false);
        return;
      }

      const subId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const dueDate = new Date();
      if (initialStatus === 'active') {
        if (billingCycle === 'yearly') {
          dueDate.setFullYear(dueDate.getFullYear() + 1);
        } else {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }
      } else {
        dueDate.setDate(dueDate.getDate() + 3);
      }

      batch.set(doc(db, 'subscriptions', subId), {
        id: subId,
        clientId: targetClientId,
        clientName: targetClientName,
        serviceName: serviceName.trim(),
        amount: amountNum,
        billingCycle,
        nextDueDate: Timestamp.fromDate(dueDate),
        status: initialStatus,
      });

      await batch.commit();

      showToast(
        addMode === 'new_client'
          ? 'Client account & subscription created!'
          : 'New service assigned to client!',
        'success'
      );
      setClientName('');
      setCompanyName('');
      setClientPhone('');
      setClientEmail('');
      setClientPassword('');
      setServiceName('');
      setServiceAmount('');
      setAddSheetOpen(false);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/email-already-in-use') {
        showToast('That email already has a Firebase login account.', 'error');
      } else if (code === 'auth/operation-not-allowed') {
        showToast('Enable Email/Password in Firebase Console Auth settings.', 'error');
      } else {
        console.error(err);
        showToast('Could not save client/service.', 'error');
      }
    } finally {
      setSubmittingClient(false);
    }
  };

  const handleToggleSubStatus = async (sub: Subscription) => {
    if (sub.status === 'pending_verification') return;
    const nextStatus = sub.status === 'active' ? 'due' : 'active';
    try {
      await updateDoc(doc(db, 'subscriptions', sub.id), { status: nextStatus });
      showToast(`Marked as ${nextStatus === 'active' ? 'Active' : 'Due'}`, 'info');
    } catch {
      showToast('Failed to update subscription status.', 'error');
    }
  };

  const handleSeedDemoData = async () => {
    if (seedingDemo) return;
    setSeedingDemo(true);

    try {
      const batch = writeBatch(db);

      // 1. Seed Official Receiving Accounts & Support Contact Details
      batch.set(doc(db, 'settings', 'paymentAccounts'), {
        ...DEFAULT_PAYMENT_ACCOUNTS,
        updatedAt: serverTimestamp(),
      });

      let firstClientUid = 'demo_client_1';
      let demoAuthCreated = false;
      try {
        const secondaryAuth = getSecondaryAuth();
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          'client@hasanahtech.com',
          'Client@2026'
        );
        firstClientUid = cred.user.uid;
        demoAuthCreated = true;
        await signOut(secondaryAuth);
      } catch {
        // Fallback cleanly to deterministic UID
      }

      const demoClients = [
        {
          uid: firstClientUid,
          name: 'Tariqul Islam',
          email: 'client@hasanahtech.com',
          phone: '01715-223344',
          companyName: 'Dhaka Mart BD',
          serviceName: 'Monthly Web Maintenance & SEO',
          amount: 5500,
          billingCycle: 'monthly' as BillingCycle,
          status: 'due' as const,
          daysOffset: 2,
        },
        {
          uid: 'demo_client_2',
          name: 'Nusrat Jahan',
          email: 'nusrat@artisanwear.bd',
          phone: '01819-445566',
          companyName: 'Artisan Wear Ltd.',
          serviceName: 'Monthly Web Maintenance',
          amount: 4500,
          billingCycle: 'monthly' as BillingCycle,
          status: 'pending_verification' as const,
          daysOffset: 4,
        },
        {
          uid: 'demo_client_3',
          name: 'Mahmudul Hasan',
          email: 'mahmud@greenleaf.com.bd',
          phone: '01912-778899',
          companyName: 'GreenLeaf Agro',
          serviceName: 'Monthly Web Maintenance',
          amount: 6000,
          billingCycle: 'monthly' as BillingCycle,
          status: 'active' as const,
          daysOffset: 22,
        },
        {
          uid: 'demo_client_4',
          name: 'Farhana Karim',
          email: 'farhana@medicareplus.bd',
          phone: '01614-998877',
          companyName: 'MediCare Plus Clinic',
          serviceName: 'Yearly Cloud Hosting & SSL',
          amount: 18000,
          billingCycle: 'yearly' as BillingCycle,
          status: 'active' as const,
          daysOffset: 290,
        },
      ];

      demoClients.forEach((c, idx) => {
        batch.set(doc(db, 'users', c.uid), {
          uid: c.uid,
          name: c.name,
          email: c.email,
          phone: c.phone,
          companyName: c.companyName,
          role: 'client',
          createdAt: serverTimestamp(),
        });

        const subId = `demo_sub_${idx + 1}`;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + c.daysOffset);

        batch.set(doc(db, 'subscriptions', subId), {
          id: subId,
          clientId: c.uid,
          clientName: c.name,
          serviceName: c.serviceName,
          amount: c.amount,
          billingCycle: c.billingCycle,
          nextDueDate: Timestamp.fromDate(dueDate),
          status: c.status,
        });
      });

      const pendingTrx = 'NGD849201X';
      const pendingPayId = 'demo_pay_pending_1';
      batch.set(doc(db, 'trxIds', pendingTrx), {
        trxId: pendingTrx,
        clientId: 'demo_client_2',
        paymentId: pendingPayId,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'payments', pendingPayId), {
        id: pendingPayId,
        clientId: 'demo_client_2',
        clientName: 'Nusrat Jahan',
        subscriptionId: 'demo_sub_2',
        serviceName: 'Monthly Web Maintenance',
        method: 'nagad',
        senderNumber: '01819-445566',
        trxId: pendingTrx,
        amount: 4500,
        status: 'pending',
        submittedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'invoices', 'demo_inv_1'), {
        id: 'demo_inv_1',
        invoiceNumber: `INV-${new Date().getFullYear()}-001`,
        paymentId: 'demo_pay_approved_1',
        clientId: 'demo_client_3',
        clientName: 'Mahmudul Hasan',
        serviceName: 'Monthly Web Maintenance',
        method: 'bkash',
        trxId: 'BKH771209M',
        amount: 6000,
        issuedAt: serverTimestamp(),
      });

      await batch.commit();
      showToast(
        demoAuthCreated
          ? 'Demo data seeded! Test client: client@hasanahtech.com / Client@2026'
          : 'Demo clients, subscriptions & official accounts seeded!',
        'success'
      );
      setActiveTab('approvals');
    } catch (err) {
      console.error(err);
      showToast('Failed to seed demo data.', 'error');
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut(auth);
      showToast('Signed out', 'info');
    } catch {
      showToast('Could not sign out.', 'error');
      setLoggingOut(false);
    }
  };

  const mfsEntries: {
    key: 'bkash' | 'nagad' | 'rocket' | 'upay';
    labelKey: 'bkashLabel' | 'nagadLabel' | 'rocketLabel' | 'upayLabel';
    enabledKey: 'bkashEnabled' | 'nagadEnabled' | 'rocketEnabled' | 'upayEnabled';
    title: string;
    colorClass: string;
  }[] = [
    {
      key: 'bkash',
      labelKey: 'bkashLabel',
      enabledKey: 'bkashEnabled',
      title: 'bKash',
      colorClass: 'text-[#E2136E]',
    },
    {
      key: 'nagad',
      labelKey: 'nagadLabel',
      enabledKey: 'nagadEnabled',
      title: 'Nagad',
      colorClass: 'text-[#D97706]',
    },
    {
      key: 'rocket',
      labelKey: 'rocketLabel',
      enabledKey: 'rocketEnabled',
      title: 'Rocket',
      colorClass: 'text-[#8C3494] dark:text-[#D8B4FE]',
    },
    {
      key: 'upay',
      labelKey: 'upayLabel',
      enabledKey: 'upayEnabled',
      title: 'Upay',
      colorClass: 'text-[#0054A6] dark:text-[#60A5FA]',
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-24 text-slate-900 dark:bg-[#060D1A] dark:text-slate-100">
      {/* Compact Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-[#0B162B]/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-[#0B2447] dark:text-white">
                Hasanah Tech Solutions
              </p>
              <p className="truncate text-[11px] font-medium text-[#1D6E8C] dark:text-[#38BDF8]">
                Admin Control · {userProfile.name}
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

      <main className="mx-auto max-w-6xl px-4 pt-5">
        {loadingData ? (
          <div className="flex flex-col items-center justify-center py-20 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-7 w-7 animate-spin text-[#1D6E8C] dark:text-[#38BDF8]" />
            <p className="mt-3">Loading agency control panel...</p>
          </div>
        ) : (
          <>
            {/* Empty Database One-Click Demo Seeder Banner */}
            {subscriptions.length === 0 && (
              <div className="mb-5 rounded-3xl border border-[#1D6E8C]/25 bg-[#0B2447] p-5 text-white shadow-sm dark:border-[#1D6E8C]/40">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white">Your workspace is empty</h2>
                    <p className="mt-1 text-xs text-sky-100/80">
                      Populate sample clients, subscriptions, a pending payment, and Hasanah Tech
                      Solutions&apos; official MFS &amp; 3 Bank Accounts in one tap.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={seedingDemo}
                    onClick={handleSeedDemoData}
                    className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#D4941F] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#B87E15] active:scale-[0.98] disabled:opacity-60"
                  >
                    {seedingDemo ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Seeding...</span>
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4" />
                        <span>Seed Demo Data</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Horizontal Swipeable KPI Strip */}
            <section
              aria-label="Key metrics"
              className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0"
            >
              <div className="w-[74%] shrink-0 snap-start rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0B162B] md:w-auto">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Monthly Recurring Revenue
                </p>
                <p className="mt-1.5 font-mono-tabular text-2xl font-bold text-[#0B2447] dark:text-[#E5A93B]">
                  {formatBDT(monthlyRecurringRevenue)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Normalized across {subscriptions.length} services
                </p>
              </div>

              <div className="w-[62%] shrink-0 snap-start rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0B162B] md:w-auto">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Pending Approvals
                </p>
                <p className="mt-1.5 font-mono-tabular text-2xl font-bold text-[#D4941F] dark:text-[#E5A93B]">
                  {pendingPayments.length}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">Awaiting TrxID review</p>
              </div>

              <div className="w-[62%] shrink-0 snap-start rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0B162B] md:w-auto">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Active Clients
                </p>
                <p className="mt-1.5 font-mono-tabular text-2xl font-bold text-[#1D6E8C] dark:text-[#38BDF8]">
                  {clients.length}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {invoices.length} invoices generated
                </p>
              </div>
            </section>

            {/* Tab 1: Approvals & Invoices */}
            {activeTab === 'approvals' && (
              <div className="mt-5 space-y-6">
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h1 className="text-base font-bold text-[#0B2447] dark:text-white">
                      Pending Approvals Queue
                    </h1>
                    <span className="font-mono-tabular text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {pendingPayments.length} waiting
                    </span>
                  </div>

                  {pendingPayments.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-[#0B162B]">
                      <CheckCircle2 className="mx-auto h-7 w-7 text-[#1D6E8C] dark:text-[#38BDF8]" />
                      <p className="mt-2 text-sm font-semibold text-[#0B2447] dark:text-white">
                        All caught up
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        New client payment submissions will appear here in real time.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                      {pendingPayments.map((pay) => {
                        const busy = processingPaymentId === pay.id;
                        return (
                          <article
                            key={pay.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#0B162B]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[#0B2447] dark:text-white">
                                  {pay.clientName}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                  {pay.serviceName}
                                </p>
                              </div>
                              <p className="font-mono-tabular text-lg font-bold text-[#0B2447] dark:text-[#E5A93B] whitespace-nowrap shrink-0">
                                {formatBDT(pay.amount)}
                              </p>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                              <div className="space-y-1">
                                <PaymentMethodBadge method={pay.method} />
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  From:{' '}
                                  <span className="font-mono-tabular font-semibold text-slate-800 dark:text-slate-200">
                                    {pay.senderNumber}
                                  </span>
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleCopyTrx(pay.trxId)}
                                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 font-mono-tabular text-xs font-bold text-[#0B2447] transition hover:bg-slate-100 active:scale-[0.97] dark:border-slate-700 dark:bg-[#0B162B] dark:text-white"
                              >
                                <span>{pay.trxId}</span>
                                {copiedTrx === pay.trxId ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                                )}
                              </button>
                            </div>

                            <div className="mt-3.5 flex gap-2.5">
                              <button
                                type="button"
                                disabled={!!processingPaymentId}
                                onClick={() => handleRejectPayment(pay)}
                                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 active:scale-[0.98] disabled:opacity-50 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                              >
                                <XCircle className="h-4 w-4" />
                                <span>Reject</span>
                              </button>
                              <button
                                type="button"
                                disabled={!!processingPaymentId}
                                onClick={() => handleApprovePayment(pay)}
                                className="flex h-12 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-[#0B2447] px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#13386B] active:scale-[0.98] disabled:opacity-50 dark:bg-[#1D6E8C] dark:hover:bg-[#2583A6]"
                              >
                                {busy ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Approving...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 text-[#E5A93B] dark:text-white" />
                                    <span>Approve &amp; Generate Invoice</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Issued Invoices */}
                {invoices.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-base font-bold text-[#0B2447] dark:text-white">
                      Issued Invoices
                    </h2>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {invoices.slice(0, 6).map((inv) => (
                        <button
                          key={inv.id}
                          type="button"
                          onClick={() => setActiveInvoice(inv)}
                          className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#1D6E8C] active:scale-[0.99] dark:border-slate-800 dark:bg-[#0B162B] dark:hover:border-[#38BDF8]"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-mono-tabular font-bold text-[#1D6E8C] dark:text-[#38BDF8]">
                                {inv.invoiceNumber}
                              </span>
                              <span aria-hidden="true" className="text-slate-300">
                                ·
                              </span>
                              <span className="text-slate-500 dark:text-slate-400">
                                {inv.clientName}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-sm font-semibold text-[#0B2447] dark:text-white">
                              {inv.serviceName}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="font-mono-tabular text-sm font-bold text-[#0B2447] dark:text-white">
                              {formatBDT(inv.amount)}
                            </span>
                            <Receipt className="h-4 w-4 text-slate-400" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Verification History */}
                {recentPayments.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-base font-bold text-[#0B2447] dark:text-white">
                      Recent Verification History
                    </h2>
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                      {recentPayments.slice(0, 6).map((pay) => (
                        <div
                          key={pay.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-[#0B162B]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#0B2447] dark:text-white">
                              {pay.clientName}
                            </p>
                            <p className="mt-0.5 font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                              {pay.trxId} · {formatTimestampDate(pay.submittedAt)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono-tabular text-sm font-bold text-[#0B2447] dark:text-white">
                              {formatBDT(pay.amount)}
                            </p>
                            <PaymentStatusIndicator status={pay.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* Tab 2: Clients & Subscriptions Manager */}
            {activeTab === 'clients' && (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h1 className="text-base font-bold text-[#0B2447] dark:text-white">
                      Clients &amp; Services
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Manage active client plans and due dates
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (clients.length > 0 && !selectedExistingClientId) {
                        setSelectedExistingClientId(clients[0].uid);
                      }
                      setAddSheetOpen(true);
                    }}
                    className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#0B2447] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#13386B] active:scale-[0.97] dark:bg-[#1D6E8C] dark:hover:bg-[#2583A6] whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-4 w-4 text-[#E5A93B] dark:text-white" />
                    <span>Add Client / Service</span>
                  </button>
                </div>

                {clients.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-[#0B162B] dark:text-slate-400">
                    No clients yet. Tap &ldquo;+ Add Client / Service&rdquo; or seed demo data.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                    {clients.map((client) => {
                      const clientSubs = subscriptions.filter((s) => s.clientId === client.uid);
                      return (
                        <article
                          key={client.uid}
                          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0B162B]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-bold text-[#0B2447] dark:text-white">
                                {client.name}
                              </h3>
                              <p className="truncate text-xs font-medium text-[#1D6E8C] dark:text-[#38BDF8]">
                                {client.companyName}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                                {client.phone} · {client.email}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                            {clientSubs.length === 0 ? (
                              <p className="text-xs text-slate-400">No services assigned.</p>
                            ) : (
                              clientSubs.map((sub) => (
                                <div
                                  key={sub.id}
                                  className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900/70"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-[#0B2447] dark:text-white">
                                      {sub.serviceName}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                      {formatBDT(sub.amount)} · {sub.billingCycle} · Due{' '}
                                      {formatTimestampDate(sub.nextDueDate)}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={sub.status === 'pending_verification'}
                                    onClick={() => handleToggleSubStatus(sub)}
                                    title="Tap to toggle Active / Due status"
                                    className="min-h-[36px] shrink-0 rounded-lg px-2 py-1 transition hover:bg-white dark:hover:bg-slate-800"
                                  >
                                    <SubscriptionStatusIndicator status={sub.status} />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Settings (Full Admin Control of MFS, Multi-Bank Accounts & Contact Info) */}
            {activeTab === 'settings' && (
              <div className="mt-5 space-y-5">
                <form onSubmit={handleSavePaymentAccounts} className="space-y-5">
                  {/* Top Card: Quick Actions & Header */}
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0B162B]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h1 className="text-base font-bold text-[#0B2447] dark:text-white">
                          Payment Channels &amp; Agency Info
                        </h1>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Edit every MFS wallet, corporate bank account, and support contact live.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleLoadOfficialDefaults}
                        className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#1D6E8C]/30 bg-[#1D6E8C]/10 px-3.5 text-xs font-semibold text-[#0B2447] transition hover:bg-[#1D6E8C]/20 dark:border-[#38BDF8]/30 dark:text-[#38BDF8]"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Load Official Defaults</span>
                      </button>
                    </div>
                  </div>

                  {/* Section 1: Mobile Financial Services (bKash, Nagad, Rocket, Upay) */}
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0B162B]">
                    <h2 className="text-sm font-bold text-[#0B2447] dark:text-white">
                      Mobile Financial Services (MFS)
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Update wallet numbers, instruction labels, or toggle visibility in client
                      checkout.
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      {mfsEntries.map((item) => {
                        const enabled = accountsForm[item.enabledKey];
                        return (
                          <div
                            key={item.key}
                            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/60"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-xs font-bold ${item.colorClass}`}>
                                {item.title}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setAccountsForm((prev) => ({
                                    ...prev,
                                    [item.enabledKey]: !prev[item.enabledKey],
                                  }))
                                }
                                className={`min-h-[32px] rounded-lg px-2.5 text-[11px] font-semibold transition ${
                                  enabled
                                    ? 'bg-[#0B2447] text-white dark:bg-[#1D6E8C]'
                                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                              >
                                {enabled ? 'Active' : 'Hidden'}
                              </button>
                            </div>

                            <div className="mt-2.5 space-y-2">
                              <div>
                                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                  Receiving Number
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={accountsForm[item.key]}
                                  onChange={(e) =>
                                    setAccountsForm((prev) => ({
                                      ...prev,
                                      [item.key]: e.target.value,
                                    }))
                                  }
                                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono-tabular text-sm text-slate-900 focus:border-[#1D6E8C] focus:outline-none dark:border-slate-700 dark:bg-[#0B162B] dark:text-white"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                  Account Type / Note
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={accountsForm[item.labelKey]}
                                  onChange={(e) =>
                                    setAccountsForm((prev) => ({
                                      ...prev,
                                      [item.labelKey]: e.target.value,
                                    }))
                                  }
                                  placeholder="Personal / Send Money"
                                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-[#1D6E8C] focus:outline-none dark:border-slate-700 dark:bg-[#0B162B] dark:text-white"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 2: Multi-Bank Transfer Manager */}
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0B162B]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="flex items-center gap-2 text-sm font-bold text-[#0B2447] dark:text-white">
                          <Building2 className="h-4 w-4 text-[#1D6E8C] dark:text-[#38BDF8]" />
                          <span>Corporate Bank Accounts ({accountsForm.banks.length}/6)</span>
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          Edit bank accounts, add new banks, or toggle Bank Transfer availability.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setAccountsForm((prev) => ({
                              ...prev,
                              bankEnabled: !prev.bankEnabled,
                            }))
                          }
                          className={`min-h-[40px] rounded-xl px-3 text-xs font-semibold transition ${
                            accountsForm.bankEnabled
                              ? 'bg-[#0B2447] text-white dark:bg-[#1D6E8C]'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {accountsForm.bankEnabled ? 'Active' : 'Hidden'}
                        </button>
                        <button
                          type="button"
                          disabled={accountsForm.banks.length >= 6}
                          onClick={handleAddBankAccount}
                          className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[#1D6E8C]/30 bg-[#1D6E8C]/10 px-3 text-xs font-semibold text-[#0B2447] transition hover:bg-[#1D6E8C]/20 disabled:opacity-50 dark:border-[#38BDF8]/30 dark:text-[#38BDF8]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Bank</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-4">
                      {accountsForm.banks.map((bank, idx) => (
                        <div
                          key={bank.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                        >
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#0B2447] dark:text-[#E5A93B]">
                              0{idx + 1}. {bank.bankName || 'New Bank Account'}
                            </span>
                            {accountsForm.banks.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveBankAccount(idx)}
                                aria-label={`Remove ${bank.bankName || 'bank'}`}
                                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Remove</span>
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                Bank Name
                              </label>
                              <input
                                type="text"
                                required
                                value={bank.bankName}
                                onChange={(e) =>
                                  handleUpdateBankField(idx, 'bankName', e.target.value)
                                }
                                placeholder="City Bank PLC"
                                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-[#1D6E8C] focus:outline-none dark:border-slate-700 dark:bg-[#0B162B] dark:text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                Account Name
                              </label>
                              <input
                                type="text"
                                required
                                value={bank.accountName}
                                onChange={(e) =>
                                  handleUpdateBankField(idx, 'accountName', e.target.value)
                                }
                                placeholder="MUSAB KHAN"
                                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-[#1D6E8C] focus:outline-none dark:border-slate-700 dark:bg-[#0B162B] dark:text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                Account Type
                              </label>
                              <input
                                type="text"
                                required
                                value={bank.accountType}
                                onChange={(e) =>
                                  handleUpdateBankField(idx, 'accountType', e.target.value)
                                }
                                placeholder="SAVINGS ACCOUNT"
                                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-[#1D6E8C] focus:outline-none dark:border-slate-700 dark:bg-[#0B162B] dark:text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                Account Number
                              </label>
                              <input
                                type="text"
                                required
                                value={bank.accountNumber}
                                onChange={(e) =>
                                  handleUpdateBankField(idx, 'accountNumber', e.target.value)
                                }
                                placeholder="2584987851001"
                                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono-tabular text-sm text-slate-900 focus:border-[#1D6E8C] focus:outline-none dark:border-slate-700 dark:bg-[#0B162B] dark:text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                Branch Name
                              </label>
                              <input
                                type="text"
                                required
                                value={bank.branch}
                                onChange={(e) =>
                                  handleUpdateBankField(idx, 'branch', e.target.value)
                                }
                                placeholder="MOUCHAK BRANCH"
                                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-[#1D6E8C] focus:outline-none dark:border-slate-700 dark:bg-[#0B162B] dark:text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                Routing Number
                              </label>
                              <input
                                type="text"
                                required
                                value={bank.routingNumber}
                                onChange={(e) =>
                                  handleUpdateBankField(idx, 'routingNumber', e.target.value)
                                }
                                placeholder="225274361"
                                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono-tabular text-sm text-slate-900 focus:border-[#1D6E8C] focus:outline-none dark:border-slate-700 dark:bg-[#0B162B] dark:text-white"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 3: Agency Support & Contact Info */}
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0B162B]">
                    <h2 className="text-sm font-bold text-[#0B2447] dark:text-white">
                      Support &amp; Contact Information
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Shown on Client Portal support bars, digital invoices, and AI responses.
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                          Support Phone
                        </label>
                        <input
                          type="text"
                          required
                          value={accountsForm.supportPhone}
                          onChange={(e) =>
                            setAccountsForm((prev) => ({ ...prev, supportPhone: e.target.value }))
                          }
                          placeholder="01349345353"
                          className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-mono-tabular text-sm text-slate-900 focus:border-[#1D6E8C] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                          Support Email
                        </label>
                        <input
                          type="email"
                          required
                          value={accountsForm.supportEmail}
                          onChange={(e) =>
                            setAccountsForm((prev) => ({ ...prev, supportEmail: e.target.value }))
                          }
                          placeholder="info@hasanahts.com"
                          className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-[#1D6E8C] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                          Company Website
                        </label>
                        <input
                          type="text"
                          required
                          value={accountsForm.website}
                          onChange={(e) =>
                            setAccountsForm((prev) => ({ ...prev, website: e.target.value }))
                          }
                          placeholder="www.hasanahts.com"
                          className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-[#1D6E8C] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2447] text-sm font-semibold text-white transition hover:bg-[#13386B] active:scale-[0.98] disabled:opacity-60 dark:bg-[#1D6E8C] dark:hover:bg-[#2583A6]"
                    >
                      {savingSettings ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Saving Payment &amp; Contact Settings...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 text-[#E5A93B] dark:text-white" />
                          <span>Save All Payment &amp; Contact Settings</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {biometricSupported && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0B162B]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1D6E8C]/12 text-[#1D6E8C] dark:bg-[#38BDF8]/15 dark:text-[#38BDF8]">
                          <Fingerprint className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-sm font-bold text-[#0B2447] dark:text-white">
                            {biometricLabel} Quick Sign-In
                          </h2>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {enrolledBiometric
                              ? `Active for ${enrolledBiometric.email}`
                              : 'Enable Fingerprint / Face ID login on this device'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBiometricSheetOpen(true)}
                        className="inline-flex min-h-[44px] shrink-0 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-[#0B2447] transition hover:bg-slate-100 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        {enrolledBiometric ? 'Manage' : 'Enable'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Admin navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-md pb-safe dark:border-slate-800 dark:bg-[#0B162B]/95"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-3 items-center">
          <button
            type="button"
            onClick={() => setActiveTab('approvals')}
            className={`relative flex h-full flex-col items-center justify-center gap-1 transition ${
              activeTab === 'approvals'
                ? 'text-[#1D6E8C] dark:text-[#38BDF8]'
                : 'text-slate-500 hover:text-[#0B2447] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <ClipboardCheck className="h-5 w-5" />
              {pendingPayments.length > 0 && (
                <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#D4941F] px-1 font-mono-tabular text-[10px] font-bold text-white">
                  {pendingPayments.length}
                </span>
              )}
            </div>
            <span className="text-[11px] font-semibold tracking-tight">Approvals</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clients')}
            className={`flex h-full flex-col items-center justify-center gap-1 transition ${
              activeTab === 'clients'
                ? 'text-[#1D6E8C] dark:text-[#38BDF8]'
                : 'text-slate-500 hover:text-[#0B2447] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Users className="h-5 w-5" />
            <span className="text-[11px] font-semibold tracking-tight">Clients</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex h-full flex-col items-center justify-center gap-1 transition ${
              activeTab === 'settings'
                ? 'text-[#1D6E8C] dark:text-[#38BDF8]'
                : 'text-slate-500 hover:text-[#0B2447] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Settings className="h-5 w-5" />
            <span className="text-[11px] font-semibold tracking-tight">Settings</span>
          </button>
        </div>
      </nav>

      {/* Bottom-Sheet Form: + Add Client / Service */}
      <AnimatePresence>
        {addSheetOpen && (
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0"
              onClick={() => !submittingClient && setAddSheetOpen(false)}
            />
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
                <h2 className="text-base font-bold text-[#0B2447] dark:text-white">
                  Add Client / Service
                </h2>
                <button
                  type="button"
                  disabled={submittingClient}
                  onClick={() => setAddSheetOpen(false)}
                  aria-label="Close drawer"
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={handleCreateClientOrService}
                className="flex-1 space-y-4 overflow-y-auto px-5 py-4"
              >
                {/* Segmented Mode Switch */}
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setAddMode('new_client')}
                    className={`h-10 rounded-lg text-xs font-semibold transition ${
                      addMode === 'new_client'
                        ? 'bg-white text-[#0B2447] shadow-sm dark:bg-[#1D6E8C] dark:text-white'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    New Client + Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode('assign_service')}
                    className={`h-10 rounded-lg text-xs font-semibold transition ${
                      addMode === 'assign_service'
                        ? 'bg-white text-[#0B2447] shadow-sm dark:bg-[#1D6E8C] dark:text-white'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Existing Client
                  </button>
                </div>

                {addMode === 'new_client' ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Client Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Tariqul Islam"
                        className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-[#1D6E8C] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Company Name
                      </label>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Dhaka Mart BD"
                        className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-[#1D6E8C] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        required
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="01711-000000"
                        className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-mono-tabular text-sm text-slate-900 focus:border-[#1D6E8C] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Login Email
                      </label>
                      <input
                        type="email"
                        required
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="client@company.com"
                        className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-[#1D6E8C] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Temporary Login Password (min 6 characters)
                      </label>
                      <input
                        type="text"
                        required
                        minLength={6}
                        value={clientPassword}
                        onChange={(e) => setClientPassword(e.target.value)}
                        placeholder="Client@2026"
                        className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-mono-tabular text-sm text-slate-900 focus:border-[#1D6E8C] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Select Existing Client
                    </label>
                    <select
                      value={selectedExistingClientId}
                      onChange={(e) => setSelectedExistingClientId(e.target.value)}
                      className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-[#1D6E8C] focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                    >
                      {clients.length === 0 ? (
                        <option value="">No clients available</option>
                      ) : (
                        clients.map((c) => (
                          <option key={c.uid} value={c.uid}>
                            {c.name} ({c.companyName})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="mb-2.5 text-xs font-bold text-[#0B2447] dark:text-slate-200">
                    Subscription Plan Details
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Service Name
                      </label>
                      <input
                        type="text"
                        required
                        value={serviceName}
                        onChange={(e) => setServiceName(e.target.value)}
                        placeholder="Monthly Web Maintenance"
                        className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-[#1D6E8C] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Amount (BDT ৳)
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          required
                          value={serviceAmount}
                          onChange={(e) => setServiceAmount(e.target.value)}
                          placeholder="5000"
                          className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-mono-tabular text-sm text-slate-900 focus:border-[#1D6E8C] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Billing Cycle
                        </label>
                        <select
                          value={billingCycle}
                          onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                          className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-[#1D6E8C] focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                        >
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Initial Billing Status
                      </label>
                      <select
                        value={initialStatus}
                        onChange={(e) => setInitialStatus(e.target.value as 'active' | 'due')}
                        className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-[#1D6E8C] focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                      >
                        <option value="due">Due (Prompt client to pay now)</option>
                        <option value="active">Active (Next cycle upcoming)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-2 pb-safe">
                  <button
                    type="submit"
                    disabled={submittingClient}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2447] text-sm font-semibold text-white shadow-sm transition hover:bg-[#13386B] active:scale-[0.98] disabled:opacity-60 dark:bg-[#1D6E8C] dark:hover:bg-[#2583A6]"
                  >
                    {submittingClient ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Client &amp; Subscription</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Digital Invoice Preview Modal */}
      <DigitalInvoiceModal
        invoice={activeInvoice}
        onClose={() => setActiveInvoice(null)}
        paymentAccounts={accountsForm}
      />

      {/* Biometric Device Enrollment Sheet */}
      <BiometricEnrollSheet
        open={biometricSheetOpen}
        onClose={() => setBiometricSheetOpen(false)}
        userProfile={userProfile}
        onStatusChange={refreshBiometricStatus}
      />

      {/* Mobile AI Admin Assistant */}
      <AIChatAssistant
        role="admin"
        userName={userProfile.name}
        contextSummary={aiContextSummary}
      />
    </div>
  );
}
