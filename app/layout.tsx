import type { Metadata, Viewport } from 'next';
import { DM_Sans, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ToastProvider } from '@/components/ToastProvider';
import { OfflineIndicator } from '@/components/PWAWidgets';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#060D1A' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Hasanah Tech Solutions — Client Billing Portal',
  description:
    'Mobile-first Progressive Web App for Hasanah Tech Solutions client billing, subscriptions, local mobile banking payments, and instant digital invoices.',
  openGraph: {
    title: 'Hasanah Tech Solutions — Client Billing Portal',
    description:
      'Mobile-first Progressive Web App for Hasanah Tech Solutions client billing, subscriptions, local mobile banking payments, and instant digital invoices.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hasanah Tech Solutions — Client Billing Portal',
    description:
      'Mobile-first Progressive Web App for Hasanah Tech Solutions client billing, subscriptions, local mobile banking payments, and instant digital invoices.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HasanahPay',
  },
  icons: {
    icon: [
      { url: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased selection:bg-[#1D6E8C]/20" suppressHydrationWarning>
        <ErrorBoundary>
          <ThemeProvider>
            <ToastProvider>
              {children}
              <OfflineIndicator />
            </ToastProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
