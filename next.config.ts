import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Sicherheits-Kopfzeilen, die von nichts abhaengen, was sich zur Laufzeit
// aendert. Die Content-Security-Policy steht bewusst NICHT hier, sondern in
// src/lib/security-headers.ts und wird von der Middleware gesetzt: Kopfzeilen
// aus dieser Datei werden beim Build in das Routen-Manifest geschrieben und
// koennten die API-Adresse einer eigenstaendigen Installation nicht kennen.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  // @openeos/ui liefert das Font-Modul als TypeScript-Quelle aus:
  // next/font-Aufrufe müssen als const im Quelltext ankommen, ein
  // gebündeltes dist würde daraus var machen und das Font-Plugin
  // von Next bricht ab.
  transpilePackages: ['@openeos/ui'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

// Sentry config (only in production)
const sentryConfig = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
};

const configWithIntl = withNextIntl(nextConfig);

export default process.env.SENTRY_DSN
  ? withSentryConfig(configWithIntl, sentryConfig)
  : configWithIntl;
