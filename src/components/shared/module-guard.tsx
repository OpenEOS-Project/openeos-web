'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { usePermissions } from '@/hooks/use-permissions';
import type { OrganizationPermissions } from '@/types/auth';

interface ModuleGuardProps {
  requiredPermission: keyof OrganizationPermissions;
  children: ReactNode;
}

/**
 * Schuetzt eine Modul-Seite auf Routenebene. Die Sidebar blendet den
 * Navigationspunkt ohne das passende Modul-Recht bereits aus
 * (canSeeNavItem in app-sidebar.tsx), aber eine direkt eingegebene URL kam
 * bisher trotzdem durch — die API lehnte die Aktion zwar ab, aber die Seite
 * selbst zeigte Erstellen/Loeschen-Buttons an, die ohnehin nie funktionieren
 * wuerden. Spiegelt dieselbe Pruefung wie canSeeNavItem.
 */
export function ModuleGuard({ requiredPermission, children }: ModuleGuardProps) {
  const router = useRouter();
  const { isLoading, hasPermission } = usePermissions();
  const allowed = hasPermission(requiredPermission);

  useEffect(() => {
    if (!isLoading && !allowed) {
      router.replace('/dashboard');
    }
  }, [isLoading, allowed, router]);

  // Waehrend die Organisation noch laedt oder nachdem der Redirect
  // ausgeloest wurde, lieber nichts zeigen als kurz die geschuetzte Seite.
  if (isLoading || !allowed) return null;

  return <>{children}</>;
}
