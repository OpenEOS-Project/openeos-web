import * as Sentry from '@sentry/nextjs';

import { scrubBreadcrumb, scrubErrorEvent } from './src/lib/error-report-scrub.mjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 1.0,

  // Datensparsamkeit: keine IP, keine Cookies, kein Request-Body. Was das
  // SDK dennoch an Anfragedaten mitschickt, reduziert scrubErrorEvent auf
  // Pfad, Methode und eine kleine Allowlist von Kopfzeilen.
  sendDefaultPii: false,
  beforeSend: (event) => scrubErrorEvent(event),
  beforeSendTransaction: (event) => scrubErrorEvent(event),
  beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),

  // Enable debug in development
  debug: process.env.NODE_ENV === 'development',

  // Disable in development unless explicitly enabled
  enabled: process.env.NODE_ENV === 'production' || !!process.env.SENTRY_DSN,
});
