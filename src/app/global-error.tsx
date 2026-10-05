'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// Die globale Fehlerseite ersetzt das Root-Layout und laeuft damit
// ausserhalb von NextIntlClientProvider — kein t() verfuegbar. Die
// Sprache kommt deshalb aus dem Pfad (/en/... = Englisch, sonst Deutsch
// als Standardsprache), die beiden Texte stehen direkt hier.
const MESSAGES = {
  de: {
    title: 'Etwas ist schiefgelaufen',
    description: 'Ein unerwarteter Fehler ist aufgetreten.',
    retry: 'Erneut versuchen',
  },
  en: {
    title: 'Something went wrong',
    description: 'An unexpected error occurred.',
    retry: 'Try again',
  },
} as const;

function currentLanguage(): keyof typeof MESSAGES {
  if (typeof window === 'undefined') return 'de';
  return /^\/en(\/|$)/.test(window.location.pathname) ? 'en' : 'de';
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const lang = currentLanguage();
  const m = MESSAGES[lang];

  return (
    <html lang={lang}>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center">
          <h1 className="text-2xl font-bold">{m.title}</h1>
          <p className="mt-2 text-gray-600">{m.description}</p>
          <button
            onClick={() => reset()}
            className="mt-4 rounded bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
          >
            {m.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
