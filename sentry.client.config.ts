import * as Sentry from '@sentry/nextjs';

import { scrubBreadcrumb, scrubErrorEvent } from './src/lib/error-report-scrub.mjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 1.0,

  // Keine Sitzungsaufzeichnung (Session Replay) und keine personenbezogenen
  // Daten. Die Replay-Integration ist bewusst nicht eingebunden; die Raten
  // stehen zusaetzlich auf 0, falls sie spaeter jemand wieder hinzufuegt.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  sendDefaultPii: false,
  beforeSend: (event) => scrubErrorEvent(event),
  beforeSendTransaction: (event) => scrubErrorEvent(event),
  beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),

  // Enable debug in development
  debug: process.env.NODE_ENV === 'development',

  // Disable in development unless explicitly enabled
  enabled: process.env.NODE_ENV === 'production' || !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
