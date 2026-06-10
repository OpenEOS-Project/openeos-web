// Build version injected by the GitHub Action (NEXT_PUBLIC_APP_VERSION,
// e.g. "1.0.123" = run number); 'dev' for local development.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';
