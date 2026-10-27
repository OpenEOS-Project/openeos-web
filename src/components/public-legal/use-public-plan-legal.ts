'use client';

import { useQuery } from '@tanstack/react-query';

import { shiftsPublicApi } from '@/lib/api-client';
import type { PublicLegalInfo } from '@/lib/legal';

/**
 * Impressum/Datenschutz des Vereins fuer Seiten, die den Plan erst nach
 * einer Aktion kennen (Bestaetigung, Verschiebungsvorschlag). Dieselbe
 * Abfrage wie die Planseite — teilt sich also deren Cache.
 */
export function usePublicPlanLegal(slug: string | null | undefined): PublicLegalInfo | undefined {
  const { data } = useQuery({
    queryKey: ['public-shift-plan', slug],
    queryFn: () => shiftsPublicApi.getPlan(slug!),
    enabled: !!slug,
    retry: false,
  });
  return data?.data?.legal;
}
