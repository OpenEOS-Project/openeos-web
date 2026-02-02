'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

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

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-gray-600">An unexpected error occurred</p>
          <button
            onClick={() => reset()}
            className="mt-4 rounded bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
