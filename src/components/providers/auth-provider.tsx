'use client';

import { useEffect, type ReactNode } from 'react';

import { apiClient, authApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setUser, setOrganizations, setLoading } = useAuthStore();

  useEffect(() => {
    const initializeAuth = async () => {
      const token = apiClient.getAccessToken();

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await authApi.me();
        const user = response.data.user;
        setUser(user);
        setOrganizations(user.userOrganizations || []);
      } catch (error) {
        console.error('Auth check failed:', error);
        apiClient.clearAccessToken();
        setUser(null);
        setOrganizations([]);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [setUser, setOrganizations, setLoading]);

  return <>{children}</>;
}
