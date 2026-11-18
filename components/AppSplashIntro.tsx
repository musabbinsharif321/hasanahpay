'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export function AppSplashIntro({ children }: { children: React.ReactNode }) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [visible, setVisible] = useState(true);
  const showSplash = visible && !prefersReducedMotion;

  useEffect(() => {
    if (prefersReducedMotion) return;
    const timer = window.setTimeout(() => setVisible(false), 2100);
    return () => window.clearTimeout(timer);
  }, [prefersReducedMotion]);

  return (
    <>
      {children}

      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="app-3d-splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
            onClick={() => setVisible(false)}
            style={{ perspective: 1200 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#060D1A] via-[#0B2447] to-[#0E3654] text-white select-none"
          >
            {/* Ambient 3D Radial Glows */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <motion.div
                animate={{ scale: [0.9, 1.15, 1], opacity: [0.3, 0.55, 0.35] }}
                transition={{ duration: 2.2, ease: 'easeInOut' }}
                className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1D6E8C]/35 blur-3xl"
              />
              <motion.div
                animate={{ scale: [1.1, 0.95, 1.05], opacity: [0.18, 0.35, 0.2] }}
                transition={{ duration: 2.2, ease: 'easeInOut' }}
                className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E5A93B]/20 blur-3xl"
              />
            </div>

            {/* 3D Orbital Logo Stage */}
            <div
              style={{ transformStyle: 'preserve-3d' }}
              className="relative flex h-48 w-48 items-center justify-center"
            >
              {/* Outer 3D Orbital Ring */}
              <motion.div
                initial={{ opacity: 0, scale: 0.6, rotateX: 65, rotateY: -25 }}
                animate={{ opacity: 1, scale: 1, rotateX: 65, rotateY: -25, rotateZ: 360 }}
                transition={{
                  opacity: { duration: 0.4 },
                  scale: { duration: 0.7, ease: EASE_OUT_EXPO },
                  rotateZ: { duration: 4, repeat: Infinity, ease: 'linear' },
                }}
                className="absolute h-44 w-44 rounded-full border-2 border-[#38BDF8]/40 shadow-[0_0_24px_rgba(56,189,248,0.25)]"
              />

              {/* Inner Gold 3D Orbital Ring */}
              <motion.div
                initial={{ opacity: 0, scale: 0.6, rotateX: -58, rotateY: 32 }}
                animate={{ opacity: 1, scale: 1, rotateX: -58, rotateY: 32, rotateZ: -360 }}
                transition={{
                  opacity: { duration: 0.4 },
                  scale: { duration: 0.75, ease: EASE_OUT_EXPO },
                  rotateZ: { duration: 3.4, repeat: Infinity, ease: 'linear' },
                }}
                className="absolute h-36 w-36 rounded-full border border-dashed border-[#E5A93B]/55"
              />

              {/* 3D Spinning Logo Medallion */}
              <motion.div
                initial={{ opacity: 0, scale: 0.45, rotateY: -180, rotateX: 18 }}
                animate={{ opacity: 1, scale: [0.45, 1.08, 1], rotateY: 0, rotateX: 0 }}
                transition={{ duration: 0.95, ease: EASE_OUT_EXPO }}
                style={{ transformStyle: 'preserve-3d', transform: 'translateZ(40px)' }}
                className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-white/30 bg-white/95 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(56,189,248,0.3)]"
              >
                <Image
                  src="/assets/aistudio/hasanah_logo_main_694d71ec.png"
                  alt="HasanahPay Logo"
                  width={76}
                  height={76}
                  priority
                  className="h-full w-full object-contain"
                />
                {/* Specular Light Sweep */}
                <motion.span
                  aria-hidden="true"
                  initial={{ x: '-140%' }}
                  animate={{ x: '160%' }}
                  transition={{ duration: 0.9, delay: 0.65, ease: 'easeInOut' }}
                  className="pointer-events-none absolute inset-y-0 w-10 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/75 to-transparent"
                />
              </motion.div>
            </div>

            {/* Brand Title Reveal */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.45, ease: EASE_OUT_EXPO }}
              className="mt-4 text-center"
            >
              <h1 className="bg-gradient-to-r from-white via-[#BAE6FD] to-[#E5A93B] bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
                HasanahPay
              </h1>
              <p className="mt-1 text-xs font-medium tracking-widest text-sky-200/80 uppercase">
                Hasanah Tech Solutions
              </p>
            </motion.div>

            {/* Subtle Loading Bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
              className="mt-6 h-1 w-28 overflow-hidden rounded-full bg-white/15"
            >
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '0%' }}
                transition={{ duration: 1.4, delay: 0.55, ease: EASE_OUT_EXPO }}
                className="h-full w-full rounded-full bg-gradient-to-r from-[#38BDF8] to-[#E5A93B]"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
