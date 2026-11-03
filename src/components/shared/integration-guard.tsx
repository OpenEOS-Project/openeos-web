'use client';

import { useEffect, type ReactNode } from 'react';

import { getIntegration, isIntegrationEnabled } from '@/config/integrations';
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
 * solange die Integration eingeschaltet ist (außer `pageWhenDisabled`). Spiegelt die Seitenleiste —
 * dort erscheint der Eintrag unter denselben Bedingungen — und deckt den
 * direkt eingegebenen Link ab. Nach dem Ausschalten auf der Seite selbst
 * führt derselbe Weg zurück in den Katalog.
 */
export function IntegrationGuard({ id, children }: IntegrationGuardProps) {
  const router = useRouter();
  const { isLoading, isAdmin } = usePermissions();
  const settings = useAuthStore((state) => state.currentOrganization?.organization?.settings);
  // Manche Seiten (Cloud-TSE) erklären ausgeschaltet, was noch fehlt.
  const allowed = isAdmin && (isIntegrationEnabled(settings, id) || !!getIntegration(id)?.pageWhenDisabled);

  useEffect(() => {
    if (!isLoading && !allowed) {
      router.replace('/integrations');
    }
  }, [isLoading, allowed, router]);

  // Wie ModuleGuard: lieber nichts zeigen als kurz die geschützte Seite.
  if (isLoading || !allowed) return null;

  return <>{children}</>;
}
