'use client';

import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { Check, Copy, Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType, testConnection } from '@/lib/firebase';
import { DEFAULT_PAYMENT_ACCOUNTS, type UserProfile } from '@/lib/types';
import { BrandMark } from './BrandMark';
import { BiometricEnrollSheet } from './BiometricEnrollSheet';
import { LoginScreen } from './LoginScreen';
import { ClientPortal } from './ClientPortal';
import { AdminDashboard } from './AdminDashboard';
import { ThemeToggleButton } from './PWAWidgets';
import { useToast } from './ToastProvider';

export function AuthPortalRouter() {
  const { showToast } = useToast();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMissing, setProfileMissing] = useState(false);
  const [bootstrappingAdmin, setBootstrappingAdmin] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const [pendingBiometricCreds, setPendingBiometricCreds] = useState<{
    email: string;
    password: string;
  } | null>(null);

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (user) {
        setProfileLoading(true);
        setProfileMissing(false);
      } else {
        setProfile(null);
        setProfileMissing(false);
        setProfileLoading(false);
        setPendingBiometricCreds(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !authUser) return;

    const userRef = doc(db, 'users', authUser.uid);

    const unsubProfile = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<UserProfile>;
          const rawRole = typeof data.role === 'string' ? data.role.trim().toLowerCase() : 'client';
          setProfile({
            uid: data.uid || authUser.uid,
            name: data.name || authUser.displayName || authUser.email || 'User',
            email: data.email || authUser.email || '',
            phone: data.phone || '',
            companyName: data.companyName || 'Hasanah Tech Solutions',
            role: rawRole === 'admin' ? 'admin' : 'client',
            createdAt: data.createdAt ?? null,
          });
          setProfileMissing(false);
        } else {
          setProfile(null);
          setProfileMissing(true);
        }
        setProfileLoading(false);
      },
      (err) => {
        setProfileLoading(false);
        setProfileMissing(true);
        try {
          handleFirestoreError(err, OperationType.GET, `users/${authUser.uid}`);
        } catch (wrapped) {
          console.error(wrapped);
        }
      }
    );

    return () => unsubProfile();
  }, [authReady, authUser]);

  const isVerifiedBootstrapAdmin =
    authUser?.email === 'musabbinsharif321@gmail.com' && authUser?.emailVerified === true;

  const handleBootstrapAdmin = async () => {
    if (!authUser || bootstrappingAdmin) return;
    setBootstrappingAdmin(true);
    try {
      await setDoc(doc(db, 'users', authUser.uid), {
        uid: authUser.uid,
        name: authUser.displayName || 'Hasanah Tech Admin',
        email: authUser.email || 'musabbinsharif321@gmail.com',
        phone: DEFAULT_PAYMENT_ACCOUNTS.supportPhone,
        companyName: 'Hasanah Tech Solutions',
        role: 'admin',
        createdAt: serverTimestamp(),
      });
      showToast('Admin profile initialized!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Could not initialize admin profile. Check Firestore permissions.', 'error');
    } finally {
      setBootstrappingAdmin(false);
    }
  };

  const handleCopyUid = async () => {
    if (!authUser) return;
    try {
      await navigator.clipboard.writeText(authUser.uid);
      setCopiedUid(true);
      showToast('UID copied!', 'success');
      window.setTimeout(() => setCopiedUid(false), 1800);
    } catch {
      showToast('Copy failed', 'error');
    }
  };

  if (!authReady || (authUser && profileLoading)) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-4 dark:bg-[#060D1A]">
        <BrandMark size="lg" />
        <Loader2 className="mt-5 h-6 w-6 animate-spin text-[#1D6E8C] dark:text-[#38BDF8]" />
        <p className="mt-2.5 text-sm font-medium text-slate-500 dark:text-slate-400">
          Verifying secure session...
        </p>
      </div>
    );
  }

  if (!authUser) {
    return <LoginScreen onRequestBiometricSetup={setPendingBiometricCreds} />;
  }

  if (profileMissing || !profile) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-slate-50 px-4 py-6 dark:bg-[#060D1A]">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark size="sm" />
            <span className="text-sm font-bold text-[#0B2447] dark:text-white">
              Hasanah Tech Solutions
            </span>
          </div>
          <ThemeToggleButton />
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0B162B]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-[#D4941F] dark:bg-amber-950/60 dark:text-[#E5A93B]">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-lg font-bold text-[#0B2447] dark:text-white">
              Account Profile Not Provisioned
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              You are authenticated as{' '}
              <strong className="text-[#0B2447] dark:text-white">{authUser.email}</strong>, but no
              role profile exists yet in <code className="font-mono-tabular">users</code>.
            </p>

            <div className="mt-4 rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-900/70">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Your Firebase Auth UID
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="truncate font-mono-tabular text-xs font-semibold text-[#0B2447] dark:text-white">
                  {authUser.uid}
                </code>
                <button
                  type="button"
                  onClick={handleCopyUid}
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-xs dark:bg-slate-800 dark:text-slate-200"
                >
                  {copiedUid ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>Copy</span>
                </button>
              </div>
            </div>

            {isVerifiedBootstrapAdmin ? (
              <button
                type="button"
                disabled={bootstrappingAdmin}
                onClick={handleBootstrapAdmin}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2447] text-sm font-semibold text-white transition hover:bg-[#13386B] disabled:opacity-60 dark:bg-[#1D6E8C] dark:hover:bg-[#2583A6]"
              >
                {bootstrappingAdmin ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating Admin Profile...</span>
                  </>
                ) : (
                  <span>Initialize Owner Admin Profile</span>
                )}
              </button>
            ) : (
              <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                If you are the agency owner, add a Firestore document at{' '}
                <code className="font-mono-tabular">users/{authUser.uid}</code> with{' '}
                <code className="font-mono-tabular">role: &quot;admin&quot;</code>. If you are a
                client, ask Hasanah Tech Solutions to add your account from the Admin Panel.
              </p>
            )}

            <button
              type="button"
              onClick={() => signOut(auth)}
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {profile.role === 'admin' ? (
        <AdminDashboard userProfile={profile} />
      ) : (
        <ClientPortal userProfile={profile} />
      )}

      <BiometricEnrollSheet
        open={Boolean(pendingBiometricCreds)}
        onClose={() => setPendingBiometricCreds(null)}
        userProfile={profile}
        initialPassword={pendingBiometricCreds?.password ?? null}
      />
    </>
  );
}
