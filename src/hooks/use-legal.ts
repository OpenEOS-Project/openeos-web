'use client';

import { useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authApi } from '@/lib/api-client';
import { localizePlatformUrl } from '@/lib/legal';
import { legalApi } from '@/lib/legal-api';
import { fallbackLegalVersions, withLegalFallback } from '@/lib/legal-platform';
import { useAuthStore } from '@/stores/auth-store';
import type {
  LegalAcceptData,
  LegalDocumentKey,
  LegalStatus,
  LegalVersions,
  UpcomingLegalChange,
} from '@/types/legal';

export const LEGAL_VERSIONS_KEY = ['legal', 'versions'] as const;
export const LEGAL_STATUS_KEY = ['legal', 'status'] as const;
export const LEGAL_ANNOUNCEMENTS_KEY = ['legal', 'announcements'] as const;

export interface UseLegalVersionsResult {
  versions: LegalVersions;
  /** Die API hat geantwortet — vorher stehen die Rückfall-Adressen da. */
  isLoaded: boolean;
  /** Adressen in der Sprache der Oberfläche (englische Seiten unter /en). */
  pageUrl: (doc: LegalDocumentKey) => string;
  versionUrl: (doc: LegalDocumentKey) => string;
  localize: (url: string) => string;
}

/**
 * Gültige Fassungen und Adressen der Rechtstexte (öffentlich, auch vor dem
 * Anmelden). Bis die Antwort da ist oder wenn sie fehlschlägt, zeigen die
 * Links auf openeos.de.
 */
export function useLegalVersions(): UseLegalVersionsResult {
  const locale = useLocale();
  const { data, isSuccess } = useQuery({
    queryKey: LEGAL_VERSIONS_KEY,
    queryFn: async () => (await legalApi.versions()).data,
    // Ändert sich nur mit einer neuen Fassung.
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const versions = useMemo(() => (data ? withLegalFallback(data) : fallbackLegalVersions()), [data]);
  const localize = useCallback((url: string) => localizePlatformUrl(url, locale), [locale]);

  return {
    versions,
    isLoaded: isSuccess,
    pageUrl: (doc) => localize(versions.documents[doc].url),
    versionUrl: (doc) => localize(versions.documents[doc].versionUrl),
    localize,
  };
}

/** Was der angemeldete Benutzer von AGB und AVV angenommen hat. */
export function useLegalStatus(enabled = true) {
  return useQuery({
    queryKey: LEGAL_STATUS_KEY,
    queryFn: async () => (await legalApi.status()).data,
    enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * AGB und AVV annehmen. Danach den Benutzer neu laden: `/auth/me` meldet,
 * ob noch eine Annahme aussteht (Hinweisfenster im Dashboard).
 */
export function useAcceptLegal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: LegalAcceptData) => (await legalApi.accept(data)).data,
    onSuccess: async (status: LegalStatus) => {
      queryClient.setQueryData(LEGAL_STATUS_KEY, status);
      const { user, setUser } = useAuthStore.getState();
      if (user && !status.required) setUser({ ...user, legalReacceptanceRequired: false });
      try {
        const me = await authApi.me();
        useAuthStore.getState().setUser(me.data.user);
      } catch {
        // Der Stand von oben reicht, um das Fenster zu schließen.
      }
    },
  });
}

/**
 * Vor dem kostenpflichtigen Buchen: AGB und AVV für diese Buchung annehmen
 * (Nachweis je Kauf). Auf eigenen Installationen gibt es keine
 * LUXCODE-Verträge — dann passiert nichts.
 */
export function usePurchaseTermsAcceptance(organizationId: string) {
  const { versions, isLoaded } = useLegalVersions();
  const accept = useAcceptLegal();
  const skip = isLoaded && !versions.enabled;

  const run = useCallback(async () => {
    if (skip) return;
    await accept.mutateAsync({ context: 'purchase', organizationId });
  }, [skip, accept, organizationId]);

  return { accept: run, isPending: accept.isPending };
}

/**
 * Angekündigte neue Fassungen, die noch nicht gelten (Hinweis im
 * Dashboard). Nur Admins einer Organisation bekommen welche; für alle
 * anderen fragt die Oberfläche gar nicht erst.
 */
export function useUpcomingLegalChanges() {
  const user = useAuthStore((s) => s.user);
  const { versions, isLoaded } = useLegalVersions();
  const isAdmin = !!user?.userOrganizations?.some((uo) => uo.role === 'admin');
  return useQuery({
    queryKey: LEGAL_ANNOUNCEMENTS_KEY,
    queryFn: async () => (await legalApi.announcements()).data,
    enabled: isAdmin && isLoaded && versions.enabled,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}

/** Hinweis auf eine Ankündigung ausblenden (sofort, dann am Konto speichern). */
export function useDismissLegalAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await legalApi.dismissAnnouncement(id);
    },
    onMutate: (id: string) => {
      const previous = queryClient.getQueryData<UpcomingLegalChange[]>(LEGAL_ANNOUNCEMENTS_KEY);
      queryClient.setQueryData<UpcomingLegalChange[]>(LEGAL_ANNOUNCEMENTS_KEY, (list) =>
        (list ?? []).filter((c) => c.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(LEGAL_ANNOUNCEMENTS_KEY, context.previous);
    },
  });
}

/** Angaben für die Mitteilung der Kasse ans Finanzamt (ELSTER). */
export function useElsterInfo(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['legal', 'elster', organizationId],
    queryFn: async () => (await legalApi.elster(organizationId!)).data,
    enabled: !!organizationId,
  });
}
