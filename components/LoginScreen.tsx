'use client';

import React, { useEffect, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Fingerprint,
  Hash,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { generateUniqueClientCode, normalizeClientCode } from '@/lib/clientCode';
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
import { Auth3DBackground } from './Auth3DBackground';
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
      ? 'rgba(15, 23, 42, 0.72)'
      : 'rgba(255, 255, 255, 0.86)'
    : value.length > 0
      ? isDark
        ? 'rgba(15, 23, 42, 0.56)'
        : 'rgba(255, 255, 255, 0.72)'
      : isDark
        ? 'rgba(15, 23, 42, 0.42)'
        : 'rgba(255, 255, 255, 0.54)';

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

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [regStep, setRegStep] = useState<'form' | 'otp'>('form');
  const [identifier, setIdentifier] = useState('');
  const [regName, setRegName] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<string>(() => getBiometricLabel());
  const [enrolledProfile, setEnrolledProfile] = useState<BiometricDeviceProfile | null>(null);
  const [enableBiometricOnLogin, setEnableBiometricOnLogin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  // 3D Stage Tilt & Specular Glare Tracking
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const smoothX = useSpring(pointerX, { stiffness: 180, damping: 24 });
  const smoothY = useSpring(pointerY, { stiffness: 180, damping: 24 });
  const cardRotateY = useTransform(smoothX, [0, 1], [-6, 6]);
  const cardRotateX = useTransform(smoothY, [0, 1], [6, -6]);
  const glareX = useTransform(smoothX, [0, 1], ['0%', '100%']);
  const glareY = useTransform(smoothY, [0, 1], ['0%', '100%']);
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(56, 189, 248, 0.14), rgba(212, 148, 31, 0.06) 35%, transparent 65%)`;

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointerX.set((e.clientX - rect.left) / rect.width);
    pointerY.set((e.clientY - rect.top) / rect.height);
  };

  const handleStageMouseLeave = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
  };

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

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const triggerError = (message: string) => {
    setInfoMsg(null);
    setErrorMsg(message);
    setShakeKey((prev) => prev + 1);
  };

  const resolveLoginEmail = async (rawInput: string): Promise<string | null> => {
    const trimmed = rawInput.trim();
    if (!trimmed) return null;

    if (trimmed.includes('@')) {
      return trimmed.toLowerCase();
    }

    const clientCode = normalizeClientCode(trimmed);
    if (!clientCode) {
      triggerError('Enter a valid Client ID (e.g. HP-123456) or Email address.');
      return null;
    }

    const idSnap = await getDoc(doc(db, 'clientIds', clientCode));
    if (!idSnap.exists()) {
      triggerError(`Client ID ${clientCode} not found. Please check your ID or use your Email.`);
      return null;
    }

    const mappedEmail = idSnap.data()?.email;
    if (typeof mappedEmail !== 'string' || !mappedEmail) {
      triggerError(`No email linked to Client ID ${clientCode}.`);
      return null;
    }

    return mappedEmail.trim().toLowerCase();
  };

  const handleForgotPassword = async () => {
    if (loading || resetSending || biometricLoading) return;
    if (!identifier.trim()) {
      triggerError('Enter your Client ID or Email first, then click Forgot password.');
      return;
    }
    setErrorMsg(null);
    setInfoMsg(null);
    setResetSending(true);
    try {
      const targetEmail = await resolveLoginEmail(identifier);
      if (!targetEmail) return;
      await sendPasswordResetEmail(auth, targetEmail);
      setInfoMsg(`Password reset link sent to ${targetEmail}. Check your inbox or spam folder.`);
      showToast('Password reset email sent', 'success');
    } catch {
      triggerError('Could not send password reset email. Verify your Client ID or Email.');
    } finally {
      setResetSending(false);
    }
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || biometricLoading) return;

    if (!identifier.trim() || !password) {
      triggerError('Please enter your Client ID or Email and password.');
      return;
    }

    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const resolvedEmail = await resolveLoginEmail(identifier);
      if (!resolvedEmail) {
        setLoading(false);
        return;
      }

      await signInWithEmailAndPassword(auth, resolvedEmail, password);
      if (enableBiometricOnLogin && biometricSupported && !enrolledProfile) {
        onRequestBiometricSetup?.({ email: resolvedEmail, password });
      }
      showToast('Signed in successfully', 'success');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        triggerError('Incorrect Client ID/Email or password. Please check your credentials.');
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

  const sendGmailOtp = async () => {
    if (loading || biometricLoading) return;

    const cleanName = regName.trim();
    const cleanPhone = regPhone.trim();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (!cleanName || cleanName.length < 2) {
      triggerError('Please enter your full name.');
      return;
    }
    if (!cleanPhone || cleanPhone.length < 6) {
      triggerError('Please enter a valid phone number.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      triggerError('Please enter a valid Gmail or email address.');
      return;
    }
    if (password.length < 6) {
      triggerError('Password must be at least 6 characters.');
      return;
    }

    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/email-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, name: cleanName }),
      });
      const data = (await res.json()) as { sent?: boolean; otpToken?: string; error?: string };

      if (!res.ok || !data.sent || !data.otpToken) {
        triggerError(data.error || 'Could not send OTP to your Gmail. Please try again.');
        showToast('Could not send OTP', 'error');
        return;
      }

      setOtpToken(data.otpToken);
      setOtpCode('');
      setRegStep('otp');
      setResendSeconds(60);
      setInfoMsg(`6-digit OTP sent to ${cleanEmail}. Check your Gmail inbox or spam folder.`);
      showToast('OTP sent to your Gmail', 'success');
    } catch {
      triggerError('Network error while sending OTP. Please try again.');
      showToast('Could not send OTP', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyGmailOtpAndRegister = async () => {
    if (loading || biometricLoading) return;

    const cleanOtp = otpCode.trim();
    if (!/^[0-9]{6}$/.test(cleanOtp)) {
      triggerError('Please enter the 6-digit OTP sent to your Gmail.');
      return;
    }

    const cleanName = regName.trim();
    const cleanCompany = regCompany.trim() || cleanName;
    const cleanPhone = regPhone.trim();
    const cleanEmail = regEmail.trim().toLowerCase();

    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    let createdUserCred: Awaited<ReturnType<typeof createUserWithEmailAndPassword>> | null = null;
    try {
      const verifyRes = await fetch('/api/auth/email-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, otp: cleanOtp, otpToken }),
      });
      const verifyData = (await verifyRes.json()) as { verified?: boolean; error?: string };

      if (!verifyRes.ok || !verifyData.verified) {
        triggerError(verifyData.error || 'Incorrect or expired OTP. Please check your Gmail.');
        showToast('Invalid OTP', 'error');
        setLoading(false);
        return;
      }

      createdUserCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const uid = createdUserCred.user.uid;
      const clientCode = await generateUniqueClientCode(db);

      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid), {
        uid,
        clientCode,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        companyName: cleanCompany,
        role: 'client',
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'clientIds', clientCode), {
        clientCode,
        email: cleanEmail,
        uid,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      // Optional Welcome SMS if SMS gateway is configured
      fetch('/api/sms/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          clientCode,
          name: cleanName,
        }),
      }).catch(() => {});

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('hasanah_just_registered_id', clientCode);
        } catch {
          // ignore storage errors
        }
      }

      if (enableBiometricOnLogin && biometricSupported && !enrolledProfile) {
        onRequestBiometricSetup?.({ email: cleanEmail, password });
      }

      showToast(`Verified! Your Client ID is ${clientCode}`, 'success');
    } catch (err: unknown) {
      if (createdUserCred?.user) {
        try {
          await createdUserCred.user.delete();
        } catch {
          // ignore rollback error
        }
      }

      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/email-already-in-use') {
        setRegStep('form');
        triggerError(
          'This email is already registered. One email can only be used once — please sign in instead.'
        );
      } else if (code === 'auth/invalid-email') {
        setRegStep('form');
        triggerError('Please enter a valid Gmail or email address.');
      } else if (code === 'auth/weak-password') {
        setRegStep('form');
        triggerError('Password is too weak. Use at least 6 characters.');
      } else {
        triggerError('Could not complete registration. Please check your details and try again.');
      }
      showToast('Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regStep === 'form') {
      await sendGmailOtp();
    } else {
      await handleVerifyGmailOtpAndRegister();
    }
  };

  return (
    <div
      onMouseMove={handleStageMouseMove}
      onMouseLeave={handleStageMouseLeave}
      style={{ perspective: 1200 }}
      className="relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-slate-50 px-4 py-5 text-slate-900 dark:bg-[#060D1A] dark:text-slate-100 sm:px-6"
    >
      {/* Real-time 3D Interactive Canvas Background */}
      <Auth3DBackground isDark={isDark} prefersReducedMotion={prefersReducedMotion} />

      {/* 3D Ambient Brand Aura & Floating Geometric Depth */}
      <div
        aria-hidden="true"
        style={{ transformStyle: 'preserve-3d' }}
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(29,110,140,0.08),transparent_55%)] dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.10),transparent_55%)]" />
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  rotateX: [12, 34, 12],
                  rotateY: [-18, 22, -18],
                  rotateZ: [0, 360],
                  y: [0, -18, 0],
                }
          }
          transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
          className="absolute left-[8%] top-[14%] h-24 w-24 rounded-3xl border border-[#1D6E8C]/20 bg-white/30 shadow-lg backdrop-blur-xs dark:border-[#38BDF8]/20 dark:bg-[#0B162B]/40"
        />
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  rotateX: [-20, 18, -20],
                  rotateY: [24, -20, 24],
                  rotateZ: [360, 0],
                  y: [0, 20, 0],
                }
          }
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
          className="absolute bottom-[16%] right-[8%] h-28 w-28 rounded-full border-2 border-dashed border-[#D4941F]/25 bg-[#D4941F]/5 shadow-md backdrop-blur-xs dark:border-[#E5A93B]/20"
        />
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  rotateX: [25, -25, 25],
                  rotateY: [-25, 25, -25],
                  y: [-10, 14, -10],
                }
          }
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="hidden sm:block absolute right-[16%] top-[22%] h-14 w-14 rounded-2xl border border-[#0B2447]/15 bg-gradient-to-br from-white/50 to-[#1D6E8C]/10 shadow-md dark:border-[#38BDF8]/20 dark:from-[#132544]/60 dark:to-[#1D6E8C]/15"
        />
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
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  scale: [0.95, 1.08, 0.95],
                  opacity: [0.14, 0.28, 0.14],
                  y: [0, -18, 0],
                }
          }
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-[#0B2447]/10 blur-3xl dark:bg-[#38BDF8]/10"
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

      {/* Focused Centered 3D Sign-In Card */}
      <main
        style={{ perspective: 1200 }}
        className="relative z-10 mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-6"
      >
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 24, rotateX: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
          transition={{ duration: 0.52, ease: EASE_OUT_EXPO }}
          style={
            prefersReducedMotion
              ? undefined
              : {
                  rotateX: cardRotateX,
                  rotateY: cardRotateY,
                  transformStyle: 'preserve-3d',
                }
          }
          className="relative will-change-transform"
        >
          {/* 3D Floating Floor Shadow */}
          <div
            aria-hidden="true"
            style={{ transform: 'translateZ(-28px)' }}
            className="pointer-events-none absolute -inset-x-3 -bottom-4 top-6 rounded-[2rem] bg-gradient-to-b from-[#1D6E8C]/12 via-[#0B2447]/15 to-transparent blur-2xl dark:from-[#38BDF8]/10 dark:via-black/50"
          />

          <motion.div
            key={shakeKey}
            layout={!prefersReducedMotion}
            animate={
              shakeKey > 0 && !prefersReducedMotion
                ? { x: [0, -7, 7, -5, 5, -2, 0] }
                : undefined
            }
            transition={{
              duration: 0.35,
              ease: 'easeOut',
              layout: { duration: 0.28, ease: EASE_OUT_EXPO },
            }}
            style={{ transformStyle: 'preserve-3d' }}
            className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/60 shadow-[0_24px_60px_-15px_rgba(11,36,71,0.20)] ring-1 ring-white/40 backdrop-blur-2xl dark:border-white/15 dark:bg-[#0B162B]/55 dark:ring-white/10 dark:shadow-[0_28px_70px_-15px_rgba(0,0,0,0.75)]"
          >
            {/* Dynamic 3D Specular Glare Overlay */}
            {!prefersReducedMotion && (
              <motion.div
                aria-hidden="true"
                style={{ background: glareBackground }}
                className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-300"
              />
            )}
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
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.08, rotateY: 12 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                  style={{ transform: 'translateZ(24px)' }}
                >
                  <BrandMark size="lg" className="shadow-md" />
                </motion.div>
                <motion.p
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.34, delay: 0.1, ease: EASE_OUT_EXPO }}
                  className="mt-3.5 text-xs font-semibold tracking-wide text-[#1D6E8C] dark:text-[#38BDF8]"
                >
                  Hasanah Tech Solutions
                </motion.p>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`${mode}-${regStep}`}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
                  >
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0B2447] dark:text-white">
                      {mode === 'login'
                        ? 'Sign in to HasanahPay'
                        : regStep === 'otp'
                          ? 'Verify Your Gmail'
                          : 'Create Client Account'}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {mode === 'login'
                        ? 'Use your Client ID (HP-XXXXXX) or Email to sign in.'
                        : regStep === 'otp'
                          ? 'Enter the 6-digit OTP code sent to your Gmail.'
                          : 'Register once to get your unique Client ID automatically.'}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Animated Sign In / Register Mode Switcher */}
              <div
                role="tablist"
                aria-label="Authentication mode"
                className="relative mt-5 grid grid-cols-2 rounded-2xl border border-white/40 bg-slate-200/50 p-1 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/55"
              >
                {(['login', 'register'] as const).map((tab) => {
                  const active = mode === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setMode(tab);
                        setRegStep('form');
                        setErrorMsg(null);
                        setInfoMsg(null);
                      }}
                      className={`relative z-10 h-10 rounded-xl text-xs font-semibold transition-colors ${
                        active
                          ? 'text-[#0B2447] dark:text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="auth-mode-pill"
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                          className="absolute inset-0 -z-10 rounded-xl bg-white shadow-xs dark:bg-[#132544]"
                        />
                      )}
                      {tab === 'login' ? 'Sign In' : 'New Registration'}
                    </button>
                  );
                })}
              </div>

              <form
                onSubmit={mode === 'login' ? handleLogin : handleRegister}
                className="mt-5 space-y-3.5"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {mode === 'login' ? (
                    <motion.div
                      key="login-fields"
                      initial={prefersReducedMotion ? false : { opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0, x: 12 }}
                      transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
                    >
                      <AnimatedAuthInput
                        id="login-identifier"
                        label="Client ID or Email"
                        type="text"
                        autoComplete="username"
                        value={identifier}
                        onChange={(val) => {
                          setIdentifier(val);
                          if (errorMsg) setErrorMsg(null);
                          if (infoMsg) setInfoMsg(null);
                        }}
                        placeholder="HP-123456 or you@gmail.com"
                        icon={Hash}
                        isDark={isDark}
                        hasError={Boolean(errorMsg)}
                        prefersReducedMotion={prefersReducedMotion}
                      />
                    </motion.div>
                  ) : regStep === 'otp' ? (
                    <motion.div
                      key="register-otp"
                      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.97, y: -8 }}
                      transition={{ duration: 0.26, ease: EASE_OUT_EXPO }}
                      className="space-y-3.5"
                    >
                      <div className="rounded-2xl border border-[#1D6E8C]/25 bg-[#1D6E8C]/5 p-3.5 dark:border-[#38BDF8]/25 dark:bg-[#1D6E8C]/15">
                        <p className="text-xs font-semibold text-[#0B2447] dark:text-white">
                          Verify Your Gmail
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                          We sent a 6-digit OTP code to{' '}
                          <span className="font-semibold text-[#1D6E8C] dark:text-[#38BDF8]">
                            {regEmail.trim().toLowerCase()}
                          </span>
                        </p>
                      </div>

                      <AnimatedAuthInput
                        id="reg-otp"
                        label="6-Digit Gmail OTP"
                        type="text"
                        autoComplete="one-time-code"
                        value={otpCode}
                        onChange={(val) => {
                          setOtpCode(val.replace(/\D/g, '').slice(0, 6));
                          if (errorMsg) setErrorMsg(null);
                        }}
                        placeholder="Enter 6-digit OTP from Gmail"
                        icon={ShieldCheck}
                        isDark={isDark}
                        hasError={Boolean(errorMsg)}
                        prefersReducedMotion={prefersReducedMotion}
                      />

                      <div className="flex items-center justify-between text-xs">
                        <motion.button
                          type="button"
                          disabled={loading}
                          whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                          onClick={() => {
                            setRegStep('form');
                            setOtpCode('');
                            setErrorMsg(null);
                            setInfoMsg(null);
                          }}
                          className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-[#0B2447] dark:text-slate-400 dark:hover:text-white"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          <span>Change details</span>
                        </motion.button>

                        <motion.button
                          type="button"
                          disabled={loading || resendSeconds > 0}
                          whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                          onClick={sendGmailOtp}
                          className="font-semibold text-[#1D6E8C] hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#38BDF8]"
                        >
                          {resendSeconds > 0 ? `Resend OTP in ${resendSeconds}s` : 'Resend OTP'}
                        </motion.button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="register-fields"
                      initial={prefersReducedMotion ? false : { opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0, x: -12 }}
                      transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
                      className="space-y-3.5"
                    >
                      {[
                        {
                          id: 'reg-name',
                          label: 'Full Name',
                          type: 'text',
                          autoComplete: 'name',
                          value: regName,
                          onChange: setRegName,
                          placeholder: 'Your full name',
                          icon: User,
                        },
                        {
                          id: 'reg-company',
                          label: 'Company / Business Name',
                          type: 'text',
                          autoComplete: 'organization',
                          value: regCompany,
                          onChange: setRegCompany,
                          placeholder: 'Business name (or Personal)',
                          icon: Building2,
                        },
                        {
                          id: 'reg-phone',
                          label: 'Phone Number',
                          type: 'tel',
                          autoComplete: 'tel',
                          value: regPhone,
                          onChange: setRegPhone,
                          placeholder: '01XXXXXXXXX',
                          icon: Phone,
                        },
                        {
                          id: 'reg-email',
                          label: 'Gmail / Email Address',
                          type: 'email',
                          autoComplete: 'email',
                          value: regEmail,
                          onChange: setRegEmail,
                          placeholder: 'you@gmail.com (one account per email)',
                          icon: Mail,
                        },
                      ].map((field, idx) => (
                        <motion.div
                          key={field.id}
                          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.26,
                            delay: idx * 0.04,
                            ease: EASE_OUT_EXPO,
                          }}
                        >
                          <AnimatedAuthInput
                            id={field.id}
                            label={field.label}
                            type={field.type}
                            autoComplete={field.autoComplete}
                            value={field.value}
                            onChange={(val) => {
                              field.onChange(val);
                              if (errorMsg) setErrorMsg(null);
                            }}
                            placeholder={field.placeholder}
                            icon={field.icon}
                            isDark={isDark}
                            hasError={Boolean(errorMsg)}
                            prefersReducedMotion={prefersReducedMotion}
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {!(mode === 'register' && regStep === 'otp') && (
                  <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.36, delay: 0.25, ease: EASE_OUT_EXPO }}
                    className="flex items-center gap-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <AnimatedAuthInput
                        id="login-password"
                        label={mode === 'login' ? 'Password' : 'Create Password (min 6 chars)'}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(val) => {
                          setPassword(val);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        placeholder={mode === 'login' ? 'Enter your password' : 'Minimum 6 characters'}
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
                    </div>

                    {mode === 'login' && enrolledProfile && (
                      <motion.button
                        type="button"
                        disabled={biometricLoading || loading}
                        onClick={handleBiometricLogin}
                        whileHover={
                          biometricLoading || loading || prefersReducedMotion
                            ? undefined
                            : { scale: 1.04 }
                        }
                        whileTap={
                          biometricLoading || loading || prefersReducedMotion
                            ? undefined
                            : { scale: 0.94 }
                        }
                        title={`Sign in with ${biometricLabel}`}
                        aria-label={`Sign in with ${biometricLabel}`}
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#1D6E8C]/35 bg-[#1D6E8C]/10 text-[#1D6E8C] shadow-xs backdrop-blur-md transition-colors hover:bg-[#1D6E8C]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#38BDF8]/35 dark:bg-[#1D6E8C]/25 dark:text-[#38BDF8] dark:hover:bg-[#1D6E8C]/40"
                      >
                        {biometricLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Fingerprint className="h-6 w-6" />
                        )}
                      </motion.button>
                    )}
                  </motion.div>
                )}

                {mode === 'login' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={resetSending || loading || biometricLoading}
                      onClick={handleForgotPassword}
                      className="text-xs font-semibold text-[#1D6E8C] transition hover:underline disabled:opacity-50 dark:text-[#38BDF8]"
                    >
                      {resetSending ? 'Sending reset link...' : 'Forgot password?'}
                    </button>
                  </div>
                )}

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
                  {infoMsg && (
                    <motion.div
                      role="status"
                      initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                      transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                      className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300"
                    >
                      <span>{infoMsg}</span>
                    </motion.div>
                  )}
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
                        <span>
                          {mode === 'login'
                            ? 'Signing in...'
                            : regStep === 'form'
                              ? 'Sending OTP to Gmail...'
                              : 'Verifying OTP...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          {mode === 'login'
                            ? 'Sign In'
                            : regStep === 'form'
                              ? 'Send OTP to Gmail'
                              : 'Verify OTP & Get Client ID'}
                        </span>
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
