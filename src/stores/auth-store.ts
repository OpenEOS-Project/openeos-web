import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { apiClient, authApi } from '@/lib/api-client';
import type { User, UserOrganization } from '@/types/auth';

interface AuthState {
  user: User | null;
  organizations: UserOrganization[];
  currentOrganization: UserOrganization | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setOrganizations: (organizations: UserOrganization[]) => void;
  setCurrentOrganization: (organization: UserOrganization | null) => void;
  setLoading: (isLoading: boolean) => void;
  logout: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  user: null,
  organizations: [],
  currentOrganization: null,
  isAuthenticated: false,
  isLoading: true,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...initialState,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setOrganizations: (organizations) =>
        set((state) => {
          const currentId = state.currentOrganization?.organizationId;
          const refreshedCurrent = currentId
            ? organizations.find((o) => o.organizationId === currentId) ?? null
            : null;
          return {
            organizations,
            // Always reconcile current to a fresh ref; auto-pick first if stale or none
            currentOrganization:
              refreshedCurrent ?? (organizations.length > 0 ? organizations[0] : null),
          };
        }),

      setCurrentOrganization: (organization) =>
        set({
          currentOrganization: organization,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      logout: async () => {
        // Access- und Refresh-Token liegen in httpOnly-Cookies, die nur der
        // Server löschen kann. Ohne diesen Aufruf bliebe die Sitzung dort
        // gültig — und weil unten ein voller Seitenwechsel folgt, würde der
        // AuthProvider sie beim Laden der Login-Seite sofort aus dem Cookie
        // wiederherstellen und direkt zurück ins Dashboard schicken.
        try {
          await authApi.logout();
        } catch {
          // Server nicht erreichbar oder Sitzung schon abgelaufen: lokal
          // trotzdem abmelden, damit der Klick nie wirkungslos bleibt.
        }
        apiClient.clearAccessToken();
        set({
          ...initialState,
          isLoading: false,
        });
        window.location.href = '/login';
      },

      reset: () => set(initialState),
    }),
    {
      name: 'openeos-auth',
      partialize: (state) => ({
        currentOrganization: state.currentOrganization,
      }),
    }
  )
);
