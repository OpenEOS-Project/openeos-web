import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { apiClient } from '@/lib/api-client';
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
  logout: () => void;
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
        set((state) => ({
          organizations,
          // Auto-select first organization if none selected
          currentOrganization:
            state.currentOrganization ||
            (organizations.length > 0 ? organizations[0] : null),
        })),

      setCurrentOrganization: (organization) =>
        set({
          currentOrganization: organization,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      logout: () => {
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
