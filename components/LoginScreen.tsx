'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  Loader2,
  Lock,
  Mail,
  Trash2,
} from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  authenticateWithBiometrics,
  checkBiometricAvailability,
  clearBiometricCredential,
  formatWebAuthnError,
  getBiometricLabel,
  getEnrolledBiometricProfile,
  type BiometricDeviceProfile,
} from '@/lib/biometrics';
import { DEFAULT_PAYMENT_ACCOUNTS } from '@/lib/types';
import { AgencyContactStrip, BrandMark } from './BrandMark';
import { PWAInstallButton, ThemeToggleButton } from './PWAWidgets';
import { useTheme } from './ThemeProvider';
import { useToast } from './ToastProvider';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

interface AnimatedAuthInputProps {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: React.ComponentType<{ className?: string }>;
  isDark: boolean;
  hasError: boolean;
  prefersReducedMotion: boolean;
  rightSlot?: React.ReactNode;
}

function AnimatedAuthInput({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
  placeholder,
  icon: Icon,
  isDark,
  hasError,
  prefersReducedMotion,
  rightSlot,
}: AnimatedAuthInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isFloating = isFocused || value.length > 0;

  const borderColor = hasError
    ? isDark
      ? '#FB7185'
      : '#E11D48'
    : isFocused
      ? isDark
        ? '#38BDF8'
        : '#1D6E8C'
      : isHovered || value.length > 0
        ? isDark
          ? '#334155'
          : '#CBD5E1'
        : isDark
          ? '#1E293B'
          : '#E2E8F0';

  const backgroundColor = isFocused
    ? isDark
      ? '#0F172A'
      : '#FFFFFF'
    : value.length > 0
      ? isDark
        ? 'rgba(15, 23, 42, 0.88)'
        : '#FFFFFF'
      : isDark
        ? 'rgba(15, 23, 42, 0.68)'
        : '#F8FAFC';

  const boxShadow = hasError
    ? isFocused
      ? isDark
        ? '0 0 0 4px rgba(251, 113, 133, 0.16)'
        : '0 0 0 4px rgba(225, 29, 72, 0.10)'
      : '0 0 0 0px rgba(225, 29, 72, 0)'
    : isFocused
      ? isDark
        ? '0 0 0 4px rgba(56, 189, 248, 0.15)'
        : '0 0 0 4px rgba(29, 110, 140, 0.12)'
      : '0 0 0 0px rgba(29, 110, 140, 0)';

  const duration = prefersReducedMotion ? 0 : 0.22;

  return (
    <motion.div
      initial={false}
      animate={{
        borderColor,
        backgroundColor,
        boxShadow,
        scale: isFocused && !prefersReducedMotion ? 1.015 : 1,
      }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.995 }}
      transition={{ duration, ease: EASE_OUT_EXPO }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative h-14 overflow-hidden rounded-xl border will-change-transform"
    >
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{ scale: isFocused ? 1.08 : 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: EASE_OUT_EXPO }}
        className={`pointer-events-none absolute left-3.5 top-5 transition-colors duration-200 ${
          hasError
            ? 'text-rose-500 dark:text-rose-400'
            : isFocused
              ? 'text-[#1D6E8C] dark:text-[#38BDF8]'
              : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        <Icon className="h-4 w-4" />
      </motion.div>

      <motion.label
        htmlFor={id}
        initial={false}
        animate={{
          y: isFloating ? -11 : 0,
          scale: isFloating ? 0.78 : 1,
        }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: EASE_OUT_EXPO }}
        className={`pointer-events-none absolute left-10 top-[18px] origin-left select-none text-sm leading-5 font-medium transition-colors duration-200 ${
          hasError
            ? 'text-rose-600 dark:text-rose-400'
            : isFocused
              ? 'text-[#1D6E8C] dark:text-[#38BDF8]'
              : isFloating
                ? 'text-slate-600 dark:text-slate-300'
                : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {label}
      </motion.label>

      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isFocused ? placeholder : ''}
        className={`h-full w-full bg-transparent pt-5 pb-1.5 pl-10 text-sm font-medium text-slate-900 placeholder:text-slate-400/80 focus:outline-none dark:text-white dark:placeholder:text-slate-500 ${
          rightSlot ? 'pr-12' : 'pr-4'
        }`}
      />

      {rightSlot}

      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{
          scaleX: isFocused ? 1 : 0,
          opacity: isFocused ? 1 : 0,
        }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.24, ease: EASE_OUT_EXPO }}
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left ${
          hasError
            ? 'bg-rose-500'
            : 'bg-gradient-to-r from-[#0B2447] via-[#1D6E8C] to-[#D4941F] dark:from-[#38BDF8] dark:via-[#1D6E8C] dark:to-[#E5A93B]'
        }`}
      />
    </motion.div>
  );
}

interface LoginScreenProps {
  onRequestBiometricSetup?: (creds: { email: string; password: string }) => void;
}

export function LoginScreen({ onRequestBiometricSetup }: LoginScreenProps) {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const prefersReducedMotion = Boolean(useReducedMotion());

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<string>(() => getBiometricLabel());
  const [enrolledProfile, setEnrolledProfile] = useState<BiometricDeviceProfile | null>(null);
  const [enableBiometricOnLogin, setEnableBiometricOnLogin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([checkBiometricAvailability(), getEnrolledBiometricProfile()])
      .then(([avail, existing]) => {
        if (!active) return;
        setBiometricSupported(avail.supported && avail.platformAuthenticator);
        setBiometricLabel(avail.label);
        setEnrolledProfile(existing);
      })
      .catch(() => {
        // Silently degrade to password-only sign-in
      });
    return () => {
      active = false;
    };
  }, []);

  const triggerError = (message: string) => {
    setErrorMsg(message);
    setShakeKey((prev) => prev + 1);
  };

  const handleBiometricLogin = async () => {
    if (loading || biometricLoading || !enrolledProfile) return;
    setErrorMsg(null);
    setBiometricLoading(true);
    try {
      const result = await authenticateWithBiometrics();
      await signInWithEmailAndPassword(auth, result.email, result.password);
      showToast(`Signed in with ${biometricLabel}`, 'success');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        await clearBiometricCredential();
        setEnrolledProfile(null);
        triggerError(
          'Saved password is no longer valid. Please sign in once with your current password.'
        );
      } else {
        triggerError(formatWebAuthnError(err));
      }
      showToast('Biometric sign-in failed', 'error');
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleRemoveBiometric = async () => {
    try {
      await clearBiometricCredential();
      setEnrolledProfile(null);
      showToast('Biometric quick sign-in removed from this device', 'info');
    } catch {
      showToast('Could not remove biometric profile', 'error');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || biometricLoading) return;

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      triggerError('Please enter both your email and password.');
      return;
    }

    setErrorMsg(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      if (enableBiometricOnLogin && biometricSupported && !enrolledProfile) {
        onRequestBiometricSetup?.({ email: cleanEmail, password });
      }
      showToast('Signed in successfully', 'success');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        triggerError('Incorrect email or password. Please check your credentials.');
      } else if (code === 'auth/operation-not-allowed') {
        triggerError(
          'Email/Password sign-in is not enabled in Firebase Console -> Authentication -> Sign-in method.'
        );
      } else if (code === 'auth/too-many-requests') {
        triggerError('Too many attempts. Please wait a moment and try again.');
      } else {
        triggerError('Unable to sign in right now. Verify your credentials and connection.');
      }
      showToast('Sign-in failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-slate-50 px-4 py-5 text-slate-900 dark:bg-[#060D1A] dark:text-slate-100 sm:px-6">
      {/* Subtle Ambient Brand Aura */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  scale: [1, 1.08, 1],
                  opacity: [0.3, 0.5, 0.3],
                  x: [0, 14, 0],
                  y: [0, -10, 0],
                }
          }
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#1D6E8C]/14 blur-3xl dark:bg-[#1D6E8C]/20"
        />
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  scale: [1.05, 0.96, 1.05],
                  opacity: [0.22, 0.4, 0.22],
                  x: [0, -14, 0],
                  y: [0, 14, 0],
                }
          }
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#D4941F]/14 blur-3xl dark:bg-[#D4941F]/12"
        />
      </div>

      {/* Minimal Top Utility Controls */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, ease: EASE_OUT_EXPO }}
        className="relative z-10 mx-auto flex w-full max-w-[420px] items-center justify-end gap-2"
      >
        <PWAInstallButton />
        <ThemeToggleButton />
      </motion.div>

      {/* Focused Centered Sign-In Card */}
      <main className="relative z-10 mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-6">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.44, ease: EASE_OUT_EXPO }}
        >
          <motion.div
            key={shakeKey}
            animate={
              shakeKey > 0 && !prefersReducedMotion
                ? { x: [0, -7, 7, -5, 5, -2, 0] }
                : undefined
            }
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-xl shadow-[#0B2447]/[0.05] backdrop-blur-md dark:border-slate-800 dark:bg-[#0B162B]/95 dark:shadow-black/30"
          >
            {/* Brand Top Accent Line */}
            <motion.div
              aria-hidden="true"
              initial={prefersReducedMotion ? false : { scaleX: 0, opacity: 0.6 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.55, delay: 0.08, ease: EASE_OUT_EXPO }}
              className="h-1 w-full origin-left bg-gradient-to-r from-[#0B2447] via-[#1D6E8C] to-[#D4941F]"
            />

            <div className="p-6 sm:p-8">
              {/* Standard Centered Brand Emblem & Title */}
              <div className="flex flex-col items-center text-center">
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.38, delay: 0.06, ease: EASE_OUT_EXPO }}
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                >
                  <BrandMark size="lg" className="shadow-sm" />
                </motion.div>
                <motion.p
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.34, delay: 0.1, ease: EASE_OUT_EXPO }}
                  className="mt-3.5 text-xs font-semibold tracking-wide text-[#1D6E8C] dark:text-[#38BDF8]"
                >
                  Hasanah Tech Solutions
                </motion.p>
                <motion.h1
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.36, delay: 0.14, ease: EASE_OUT_EXPO }}
                  className="mt-1 text-2xl font-bold tracking-tight text-[#0B2447] dark:text-white"
                >
                  Sign in to HasanahPay
                </motion.h1>
                <motion.p
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.34, delay: 0.18, ease: EASE_OUT_EXPO }}
                  className="mt-1 text-sm text-slate-500 dark:text-slate-400"
                >
                  Enter your credentials to access your portal.
                </motion.p>
              </div>

              {/* Returning Client Biometric Quick Unlock */}
              <AnimatePresence>
                {enrolledProfile && (
                  <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                    className="mt-5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900/75">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1D6E8C]/12 text-[#1D6E8C] dark:bg-[#38BDF8]/15 dark:text-[#38BDF8]">
                          <Fingerprint className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#0B2447] dark:text-white">
                            {enrolledProfile.companyName || enrolledProfile.displayName}
                          </p>
                          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {enrolledProfile.email}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveBiometric}
                        aria-label="Remove saved biometric profile"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <motion.button
                      type="button"
                      disabled={biometricLoading || loading}
                      onClick={handleBiometricLogin}
                      whileHover={
                        biometricLoading || loading || prefersReducedMotion
                          ? undefined
                          : { y: -1 }
                      }
                      whileTap={
                        biometricLoading || loading || prefersReducedMotion
                          ? undefined
                          : { scale: 0.985 }
                      }
                      transition={{ duration: 0.16, ease: EASE_OUT_EXPO }}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#1D6E8C]/35 bg-[#1D6E8C]/10 text-sm font-semibold text-[#0B2447] shadow-xs transition-colors hover:bg-[#1D6E8C]/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#38BDF8]/30 dark:bg-[#1D6E8C]/25 dark:text-white dark:hover:bg-[#1D6E8C]/35"
                    >
                      {biometricLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-[#1D6E8C] dark:text-[#38BDF8]" />
                          <span>Verifying biometrics...</span>
                        </>
                      ) : (
                        <>
                          <Fingerprint className="h-4.5 w-4.5 text-[#1D6E8C] dark:text-[#38BDF8]" />
                          <span>Sign in with {biometricLabel}</span>
                        </>
                      )}
                    </motion.button>

                    <div className="flex items-center gap-3 pt-1">
                      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                      <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        or sign in with password
                      </span>
                      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleLogin} className="mt-5 space-y-4">
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.36, delay: 0.2, ease: EASE_OUT_EXPO }}
                >
                  <AnimatedAuthInput
                    id="login-email"
                    label="Email Address"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(val) => {
                      setEmail(val);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="you@company.com"
                    icon={Mail}
                    isDark={isDark}
                    hasError={Boolean(errorMsg)}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                </motion.div>

                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.36, delay: 0.25, ease: EASE_OUT_EXPO }}
                >
                  <AnimatedAuthInput
                    id="login-password"
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(val) => {
                      setPassword(val);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Enter your password"
                    icon={Lock}
                    isDark={isDark}
                    hasError={Boolean(errorMsg)}
                    prefersReducedMotion={prefersReducedMotion}
                    rightSlot={
                      <motion.button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
                        whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-[#0B2447] dark:hover:text-slate-200"
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={showPassword ? 'hide' : 'show'}
                            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.14 }}
                            className="flex items-center justify-center"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </motion.span>
                        </AnimatePresence>
                      </motion.button>
                    }
                  />
                </motion.div>

                {biometricSupported && !enrolledProfile && (
                  <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, delay: 0.28, ease: EASE_OUT_EXPO }}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={enableBiometricOnLogin}
                      onClick={() => setEnableBiometricOnLogin((v) => !v)}
                      className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl px-1 text-left text-xs font-medium text-slate-600 transition-colors hover:text-[#0B2447] dark:text-slate-300 dark:hover:text-white"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Fingerprint className="h-4 w-4 text-[#1D6E8C] dark:text-[#38BDF8]" />
                        <span>Enable {biometricLabel} for faster sign-in</span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
                          enableBiometricOnLogin
                            ? 'bg-[#1D6E8C]'
                            : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      >
                        <motion.span
                          animate={{ x: enableBiometricOnLogin ? 22 : 2 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                          className="h-5 w-5 rounded-full bg-white shadow-xs"
                        />
                      </span>
                    </button>
                  </motion.div>
                )}

                <AnimatePresence>
                  {errorMsg && (
                    <motion.div
                      role="alert"
                      initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                      transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                      className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.36, delay: 0.3, ease: EASE_OUT_EXPO }}
                >
                  <motion.button
                    type="submit"
                    disabled={loading || biometricLoading}
                    whileHover={
                      loading || biometricLoading || prefersReducedMotion
                        ? undefined
                        : { y: -1 }
                    }
                    whileTap={
                      loading || biometricLoading || prefersReducedMotion
                        ? undefined
                        : { scale: 0.985 }
                    }
                    transition={{ duration: 0.16, ease: EASE_OUT_EXPO }}
                    className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#0B2447] via-[#13386B] to-[#1D6E8C] text-sm font-semibold text-white shadow-md shadow-[#0B2447]/15 transition-shadow hover:shadow-lg hover:shadow-[#1D6E8C]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                    />
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </>
                    )}
                  </motion.button>
                </motion.div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* Quiet Contact Footer */}
      <motion.footer
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.32, ease: EASE_OUT_EXPO }}
        className="relative z-10 mx-auto w-full max-w-[420px] pb-1 text-center"
      >
        <AgencyContactStrip
          phone={DEFAULT_PAYMENT_ACCOUNTS.supportPhone}
          email={DEFAULT_PAYMENT_ACCOUNTS.supportEmail}
          website={DEFAULT_PAYMENT_ACCOUNTS.website}
          centered
        />
      </motion.footer>
    </div>
  );
}
