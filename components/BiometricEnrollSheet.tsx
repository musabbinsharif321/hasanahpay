'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  Fingerprint,
  Loader2,
  Lock,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  checkBiometricAvailability,
  clearBiometricCredential,
  enrollBiometricCredential,
  formatWebAuthnError,
  getBiometricLabel,
  getEnrolledBiometricProfile,
  type BiometricDeviceProfile,
} from '@/lib/biometrics';
import type { UserProfile } from '@/lib/types';
import { useToast } from './ToastProvider';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

interface BiometricEnrollSheetProps {
  open: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  initialPassword?: string | null;
  onStatusChange?: () => void;
}

function BiometricSheetContent({
  onClose,
  userProfile,
  initialPassword = null,
  onStatusChange,
  prefersReducedMotion,
}: Omit<BiometricEnrollSheetProps, 'open'> & { prefersReducedMotion: boolean }) {
  const { showToast } = useToast();

  const [biometricLabel, setBiometricLabel] = useState<string>(() => getBiometricLabel());
  const [supported, setSupported] = useState(true);
  const [enrolledProfile, setEnrolledProfile] = useState<BiometricDeviceProfile | null>(null);
  const [checking, setChecking] = useState(true);

  const [passwordInput, setPasswordInput] = useState('');
  const [verifiedPassword, setVerifiedPassword] = useState<string | null>(initialPassword);
  const [verifyingPwd, setVerifyingPwd] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([checkBiometricAvailability(), getEnrolledBiometricProfile()])
      .then(([avail, existing]) => {
        if (!active) return;
        setBiometricLabel(avail.label);
        setSupported(avail.supported);
        setEnrolledProfile(existing);
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyingPwd || !passwordInput) return;

    const currentUser = auth.currentUser;
    const email = currentUser?.email || userProfile.email;
    if (!currentUser || !email) {
      setErrorMsg('Active session unavailable. Please sign in again.');
      return;
    }

    setErrorMsg(null);
    setVerifyingPwd(true);
    try {
      const cred = EmailAuthProvider.credential(email, passwordInput);
      await reauthenticateWithCredential(currentUser, cred);
      setVerifiedPassword(passwordInput);
      setPasswordInput('');
    } catch {
      setErrorMsg('Incorrect password. Please enter your current sign-in password.');
    } finally {
      setVerifyingPwd(false);
    }
  };

  const handleEnroll = async () => {
    if (enrolling || !verifiedPassword) return;
    setErrorMsg(null);
    setEnrolling(true);
    try {
      const profile = await enrollBiometricCredential({
        uid: userProfile.uid,
        email: userProfile.email,
        displayName: userProfile.name,
        companyName: userProfile.companyName,
        password: verifiedPassword,
      });
      setEnrolledProfile(profile);
      setVerifiedPassword(null);
      onStatusChange?.();
      showToast(`${biometricLabel} enabled for this device`, 'success');
      onClose();
    } catch (err) {
      const msg = formatWebAuthnError(err);
      setErrorMsg(msg);
      showToast('Biometric setup cancelled', 'error');
    } finally {
      setEnrolling(false);
    }
  };

  const handleRemove = async () => {
    if (removing) return;
    setRemoving(true);
    setErrorMsg(null);
    try {
      await clearBiometricCredential();
      setEnrolledProfile(null);
      onStatusChange?.();
      showToast('Biometric passkey removed from this device', 'info');
      onClose();
    } catch {
      setErrorMsg('Could not remove biometric record. Try again.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <motion.div
        aria-hidden="true"
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={prefersReducedMotion ? undefined : { opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/55 backdrop-blur-xs"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="biometric-sheet-title"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? undefined : { opacity: 0, y: 24 }}
        transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border border-slate-200 bg-white pb-safe shadow-2xl dark:border-slate-800 dark:bg-[#0B162B] sm:rounded-3xl"
      >
        {/* Mobile Drag Handle */}
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />

        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0B2447] text-[#E5A93B] dark:bg-[#1D6E8C] dark:text-white">
                <Fingerprint className="h-5.5 w-5.5" />
              </div>
              <div>
                <h2
                  id="biometric-sheet-title"
                  className="text-base font-bold text-[#0B2447] dark:text-white"
                >
                  {biometricLabel} Sign-In
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hardware-backed WebAuthn protection
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close biometric settings"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {checking ? (
            <div className="flex items-center justify-center py-10 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#1D6E8C]" />
              <span>Checking device security...</span>
            </div>
          ) : !supported ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                Biometric WebAuthn is unavailable in this browser context. Open HasanahPay in a
                modern HTTPS mobile or desktop browser with Fingerprint, Face ID, Touch ID, or
                Windows Hello.
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-12 w-full rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Close
              </button>
            </div>
          ) : enrolledProfile && !verifiedPassword ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Active on this device</span>
                </div>
                <p className="mt-1.5 text-sm font-bold text-[#0B2447] dark:text-white">
                  {enrolledProfile.companyName || enrolledProfile.displayName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {enrolledProfile.email}
                </p>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="button"
                disabled={removing}
                onClick={handleRemove}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70"
              >
                {removing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>Remove Biometric Sign-In</span>
              </button>
            </div>
          ) : verifiedPassword ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                <div className="flex items-center gap-2 font-semibold text-[#0B2447] dark:text-white">
                  <ShieldCheck className="h-4 w-4 text-[#1D6E8C] dark:text-[#38BDF8]" />
                  <span>Ready for {userProfile.email}</span>
                </div>
                <p className="mt-1.5">
                  Tap below to verify with your device&apos;s {biometricLabel}. Your credential is
                  encrypted with a non-extractable hardware-bound key on this device only.
                </p>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex gap-2.5">
                <button
                  type="button"
                  disabled={enrolling}
                  onClick={onClose}
                  className="h-12 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Not Now
                </button>
                <button
                  type="button"
                  disabled={enrolling}
                  onClick={handleEnroll}
                  className="flex h-12 flex-[1.5] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0B2447] via-[#13386B] to-[#1D6E8C] text-sm font-semibold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
                >
                  {enrolling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Scanning...</span>
                    </>
                  ) : (
                    <>
                      <Fingerprint className="h-4 w-4" />
                      <span>Activate {biometricLabel}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerifyPassword} className="mt-5 space-y-4">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Confirm your current password once to bind{' '}
                <strong className="text-[#0B2447] dark:text-white">{userProfile.email}</strong> to
                this device&apos;s {biometricLabel}.
              </p>

              <div>
                <label
                  htmlFor="biometric-confirm-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Current Password
                </label>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="biometric-confirm-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Enter your password"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 focus:border-[#1D6E8C] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-[#38BDF8]"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={verifyingPwd}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2447] text-sm font-semibold text-white transition hover:bg-[#13386B] disabled:opacity-60 dark:bg-[#1D6E8C] dark:hover:bg-[#2583A6]"
              >
                {verifyingPwd ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Continue to Biometric Scan</span>
                )}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export function BiometricEnrollSheet({ open, ...props }: BiometricEnrollSheetProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());

  return (
    <AnimatePresence>
      {open && (
        <BiometricSheetContent
          key={props.initialPassword ? 'enroll-flow' : 'manage-flow'}
          prefersReducedMotion={prefersReducedMotion}
          {...props}
        />
      )}
    </AnimatePresence>
  );
}
