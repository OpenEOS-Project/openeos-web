import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV === 'development';

// No security headers were set anywhere before this (no CSP, no
// X-Frame-Options, no HSTS, etc.). This is a pragmatic baseline, not a
// strict nonce-based CSP — 'unsafe-inline' on script/style is here because
// Next.js's App Router injects inline bootstrap scripts and styles that a
// strict CSP would break without wiring per-request nonces through
// middleware, which is a larger change than this pass covers. Even this
// still blocks the two things this audit flagged as missing outright:
// clickjacking (frame-ancestors) and MIME-sniffing (X-Content-Type-Options).
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // API/shop run on separate subdomains (NEXT_PUBLIC_API_URL /
      // NEXT_PUBLIC_SHOP_URL) — connect-src needs https: broadly rather
      // than a fixed origin, since which domain is in play depends on the
      // build (production vs. staging URLs are baked in as build args).
      // In development the API is plain http on another port, which is
      // neither 'self' nor https:, so it has to be allowed explicitly —
      // otherwise the local dashboard silently can't reach the backend.
      isDev
        ? "connect-src 'self' https: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*"
        : "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; '),
  },
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
