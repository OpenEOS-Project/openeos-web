import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 1.0,

  // Enable debug in development
  debug: process.env.NODE_ENV === 'development',

  // Disable in development unless explicitly enabled
  enabled: process.env.NODE_ENV === 'production' || !!process.env.SENTRY_DSN,
});
