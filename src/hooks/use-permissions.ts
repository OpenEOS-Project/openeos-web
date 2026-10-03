import { useAuthStore } from '@/stores/auth-store';
import type { OrganizationPermissions } from '@/types/auth';

/**
 * Buendelt dieselbe Pruefung, die bisher in canSeeNavItem (app-sidebar.tsx)
 * und canSeeWidget (dashboard-container.tsx) jeweils separat nachgebaut
 * wurde: Admins der aktuellen Organisation duerfen alles, Mitglieder nur mit
 * dem passenden Modul-Recht.
 */
export function usePermissions() {
  const user = useAuthStore((state) => state.user);
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const isLoading = useAuthStore((state) => state.isLoading);

  const isSuperAdmin = user?.isSuperAdmin ?? false;
  const isAdmin = currentOrganization?.role === 'admin';

  const hasPermission = (requiredPermission?: keyof OrganizationPermissions): boolean => {
    if (!requiredPermission) return true;
    if (isAdmin) return true;
    return !!currentOrganization?.permissions?.[requiredPermission];
  };

  return { isLoading, isSuperAdmin, isAdmin, hasPermission };
}
