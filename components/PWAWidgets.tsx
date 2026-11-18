'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Download, Moon, Share, Sun, WifiOff, X } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const emptySubscribe = () => () => {};

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getStandaloneSnapshot() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function getIOSSnapshot() {
  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [acceptedInstall, setAcceptedInstall] = useState(false);

  const standaloneMode = useSyncExternalStore(emptySubscribe, getStandaloneSnapshot, () => false);
  const isIOS = useSyncExternalStore(emptySubscribe, getIOSSnapshot, () => false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setAcceptedInstall(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setAcceptedInstall(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled: standaloneMode || acceptedInstall,
    isIOS,
    install,
  };
}

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#0B2447] px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#13386B] active:scale-[0.97] dark:bg-[#1D6E8C] dark:hover:bg-[#2381A4] whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4 text-[#E5A93B] dark:text-white" />
        <span>Install</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Install app on iOS"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#0B2447] transition hover:bg-slate-50 active:scale-[0.97] dark:border-slate-700 dark:bg-[#0B162B] dark:text-slate-200 whitespace-nowrap shrink-0"
        >
          <Download className="h-4 w-4 text-[#1D6E8C] dark:text-[#38BDF8]" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center">
            <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#0B162B]">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#0B2447] dark:text-slate-100">
                  Install HasanahPay on iOS
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close guide"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ol className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0B2447] text-xs font-semibold text-white dark:bg-[#1D6E8C]">
                    1
                  </span>
                  <span>
                    Tap the <Share className="mx-1 inline h-4 w-4 text-[#1D6E8C]" />{' '}
                    <strong>Share</strong> button in Safari.
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0B2447] text-xs font-semibold text-white dark:bg-[#1D6E8C]">
                    2
                  </span>
                  <span>
                    Scroll down and choose <strong>Add to Home Screen</strong>.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 h-12 w-full rounded-xl bg-[#0B2447] text-sm font-medium text-white dark:bg-[#1D6E8C]"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}

export function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 active:scale-[0.96] dark:border-slate-800 dark:bg-[#0B162B] dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 text-[#E5A93B]" />
      ) : (
        <Moon className="h-5 w-5 text-[#0B2447]" />
      )}
    </button>
  );
}

export function OfflineIndicator() {
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#D4941F]/40 bg-[#0B2447] px-3.5 py-1.5 text-xs font-medium text-white shadow-lg whitespace-nowrap">
      <WifiOff className="h-3.5 w-3.5 text-[#E5A93B]" />
      <span>Offline Mode — Showing cached data</span>
    </div>
  );
}
