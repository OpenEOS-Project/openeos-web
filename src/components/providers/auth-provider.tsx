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
    // Der Access-Token liegt seit der Umstellung auf httpOnly-Cookies nicht
    // mehr im localStorage und ist nach einem Reload für JS unsichtbar. Ein
    // "kein Token da -> nicht eingeloggt" wie früher würde die Sitzung
    // deshalb bei jedem Seitenneuladen wegwerfen. Stattdessen fragen wir den
    // Server: das Cookie beantwortet die Frage, wer angemeldet ist.
    const initializeAuth = async () => {
      const applyUser = (user: Awaited<ReturnType<typeof authApi.me>>['data']['user']) => {
        setUser(user);
        setOrganizations(user.userOrganizations || []);
      };

      // Das finally muss jeden Ausgang abdecken, auch den Erfolgsfall —
      // sonst bleibt isLoading true und der AuthGuard zeigt ewig den Spinner.
      try {
        try {
          // 1. Versuch: gültiges Access-Cookie — der Normalfall.
          const response = await authApi.meSilent();
          applyUser(response.data.user);
          return;
        } catch {
          // Access-Cookie fehlt oder ist abgelaufen — kein Grund aufzugeben,
          // das Refresh-Cookie hält deutlich länger.
        }

        try {
          // 2. Versuch: über das Refresh-Cookie eine neue Sitzung holen.
          const refreshed = await authApi.refresh();
          apiClient.setAccessToken(refreshed.data.accessToken);
          const response = await authApi.meSilent();
          applyUser(response.data.user);
        } catch {
          // Wirklich nicht angemeldet. Bewusst ohne Redirect: der AuthGuard
          // entscheidet, ob die aufgerufene Seite überhaupt Anmeldung braucht.
          apiClient.clearAccessToken();
          setUser(null);
          setOrganizations([]);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [setUser, setOrganizations, setLoading]);

  return <>{children}</>;
}
