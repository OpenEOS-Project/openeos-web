'use client';

import { useEffect, type ReactNode } from 'react';

import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from '@/i18n/routing';

/**
 * Seiten, die nur Admins der Organisation betreffen und an keinem
 * Modul-Recht haengen (z. B. der Integrationskatalog). Die Seitenleiste
 * blendet sie per `adminOnly` aus; das hier deckt den direkt eingegebenen
 * Link ab. Aufbau wie ModuleGuard.
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isLoading, isAdmin } = usePermissions();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAdmin, router]);

  if (isLoading || !isAdmin) return null;

  return <>{children}</>;
}
