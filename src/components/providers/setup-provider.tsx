'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { setupApi } from '@/lib/api-client';
import type { SetupStatus } from '@/types/setup';

interface SetupContextValue {
  setupStatus: SetupStatus | null;
  isLoading: boolean;
  refetch: () => Promise<SetupStatus | null>;
}

const SetupContext = createContext<SetupContextValue>({
  setupStatus: null,
  isLoading: true,
  refetch: async () => null,
});

export const useSetup = () => useContext(SetupContext);

// Routes that don't require setup check (setup pages themselves)
const SETUP_ROUTES = ['/setup'];
// Routes that are always accessible (public pages)
const PUBLIC_ROUTES = ['/s/', '/device/'];

interface SetupProviderProps {
  children: ReactNode;
}

export function SetupProvider({ children }: SetupProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSetupStatus = async () => {
    try {
      // API returns { required: boolean, reason?: string } directly (no data wrapper)
      const status = await setupApi.getStatus();
      setSetupStatus(status);
      return status;
    } catch (error) {
      console.error('Failed to fetch setup status:', error);
      // If we can't reach the API, assume setup is not required to avoid blocking
      setSetupStatus({ required: false });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSetupStatus();
  }, []);

  useEffect(() => {
    if (isLoading || !setupStatus) return;

    // Extract locale-independent path (remove /de or /en prefix)
    const pathWithoutLocale = pathname.replace(/^\/(de|en)/, '') || '/';

    // Skip redirect for setup pages and public routes
    const isSetupRoute = SETUP_ROUTES.some(route => pathWithoutLocale.startsWith(route));
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathWithoutLocale.startsWith(route));

    if (isSetupRoute || isPublicRoute) return;

    // If setup is required, redirect to setup wizard
    if (setupStatus.required) {
      router.replace('/setup');
    }
  }, [isLoading, setupStatus, pathname, router]);

  // Show loading while checking setup status
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <SetupContext.Provider value={{ setupStatus, isLoading, refetch: fetchSetupStatus }}>
      {children}
    </SetupContext.Provider>
  );
}
