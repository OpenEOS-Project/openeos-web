import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';

import { routing } from './i18n/routing';
import { buildContentSecurityPolicy } from './lib/security-headers';

const intlMiddleware = createMiddleware(routing);

/** Beruecksichtigt einen vorgelagerten Reverse-Proxy, der TLS terminiert. */
function istUnverschluesselt(request: NextRequest): boolean {
  const weitergereicht = request.headers.get('x-forwarded-proto');
  if (weitergereicht) return weitergereicht.split(',')[0].trim() === 'http';
  return request.nextUrl.protocol === 'http:';
}

export default function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  /* Die uebrigen Sicherheits-Kopfzeilen stehen weiterhin in next.config.ts —
     sie haengen von nichts ab, was sich pro Anfrage unterscheidet. */
  response.headers.set(
    'content-security-policy',
    buildContentSecurityPolicy({
      isDev: process.env.NODE_ENV === 'development',
      insecureOrigin: istUnverschluesselt(request),
    }),
  );

  return response;
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - API routes
    // - Next.js internal routes
    // - Static files
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
