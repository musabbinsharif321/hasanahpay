import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Hasanah Tech Solutions — Billing Portal',
    short_name: 'HasanahPay',
    description:
      'Mobile-first client billing, subscription management, and instant digital invoicing for Hasanah Tech Solutions.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0B2447',
    theme_color: '#0B2447',
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
