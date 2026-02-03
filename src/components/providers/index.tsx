'use client';

import { type ReactNode } from 'react';

import { AuthProvider } from './auth-provider';
import { QueryProvider } from './query-provider';
import { SetupProvider } from './setup-provider';
import { ThemeProvider } from './theme-provider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <SetupProvider>
          <AuthProvider>{children}</AuthProvider>
        </SetupProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
