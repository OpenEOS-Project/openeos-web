'use client';

import { LucideProvider } from 'lucide-react';
import { type ReactNode } from 'react';

import { AuthProvider } from './auth-provider';
import { QueryProvider } from './query-provider';
import { SetupProvider } from './setup-provider';
import { ThemeProvider } from './theme-provider';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Strichstärke aller Lucide-Icons der Verwaltung: 1,8 wie `ICON_STROKE_WIDTH` aus
 * `@openeos/ui` (Kasse, Tische), damit beide Oberflächen gleich wirken.
 */
const ICON_STROKE_WIDTH = 1.8;

export function Providers({ children }: ProvidersProps) {
  return (
    <LucideProvider strokeWidth={ICON_STROKE_WIDTH}>
      <QueryProvider>
        <ThemeProvider>
          <SetupProvider>
            <AuthProvider>{children}</AuthProvider>
          </SetupProvider>
        </ThemeProvider>
      </QueryProvider>
    </LucideProvider>
  );
}
