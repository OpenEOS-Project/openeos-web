'use client';

import { useEffect, type ReactNode } from 'react';

import { isIntegrationEnabled } from '@/config/integrations';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from '@/i18n/routing';
import { useAuthStore } from '@/stores/auth-store';
import type { IntegrationId } from '@/types/organization';

interface IntegrationGuardProps {
  id: IntegrationId;
  children: ReactNode;
}

/**
 * Schützt die Konfigurationsseite einer Integration: nur Admins, und nur
 * solange die Integration eingeschaltet ist. Spiegelt die Seitenleiste —
 * dort erscheint der Eintrag unter denselben Bedingungen — und deckt den
 * direkt eingegebenen Link ab. Nach dem Ausschalten auf der Seite selbst
 * führt derselbe Weg zurück in den Katalog.
 */
export function IntegrationGuard({ id, children }: IntegrationGuardProps) {
  const router = useRouter();
  const { isLoading, isAdmin } = usePermissions();
  const settings = useAuthStore((state) => state.currentOrganization?.organization?.settings);
  const allowed = isAdmin && isIntegrationEnabled(settings, id);

  useEffect(() => {
    if (!isLoading && !allowed) {
      router.replace('/integrations');
    }
  }, [isLoading, allowed, router]);

  // Wie ModuleGuard: lieber nichts zeigen als kurz die geschützte Seite.
  if (isLoading || !allowed) return null;

  return <>{children}</>;
}
