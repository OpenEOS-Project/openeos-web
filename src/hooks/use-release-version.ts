'use client';

import { useQuery } from '@tanstack/react-query';

import { changelogApi } from '@/lib/api-client';

/**
 * Die zuletzt veröffentlichte Version — dieselbe Nummer, die das Badge
 * auf der Website nennt.
 *
 * Bewusst nicht die Build-Nummer aus `@/lib/version`: die zählt bei
 * jedem Commit weiter, auch nach einer reinen Fehlerkorrektur. Neben der
 * 1.3 der Website hätte in der Seitenleiste also eine zweite Zahl
 * gestanden, die sich ebenfalls „Version" nennt und etwas anderes sagt.
 *
 * Derselbe Abfrageschlüssel wie beim Neuerungen-Fenster ohne Filter,
 * damit beide sich eine Abfrage teilen statt zweimal dasselbe zu holen.
 */
export function useReleaseVersion(): string | null {
  const { data } = useQuery({
    queryKey: ['changelog', 'alle'],
    queryFn: async () => (await changelogApi.list()).data,
    // Ändert sich nur bei einer Veröffentlichung.
    staleTime: 30 * 60 * 1000,
  });

  return data?.latestVersion ?? null;
}
