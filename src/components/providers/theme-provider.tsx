'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ReactNode } from 'react';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      // next-themes schrieb bisher die Klassen "light"/"dark", das CSS
      // des Projekts hört aber durchgehend auf ".dark-mode" (siehe
      // @custom-variant dark in globals.css und den .dark-mode-Block in
      // theme.css). Der Dark-Mode war dadurch wirkungslos.
      value={{ light: 'light-mode', dark: 'dark-mode' }}
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
