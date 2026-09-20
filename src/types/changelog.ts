/** Spiegel der Typen aus der API — Quelle der Einträge ist dort. */
export type ChangelogArt = 'neu' | 'verbessert' | 'behoben';

export interface ChangelogEintrag {
  datum: string;
  art: ChangelogArt;
  titel: { de: string; en: string };
  text: { de: string; en: string };
}

export interface ChangelogAntwort {
  entries: ChangelogEintrag[];
  /** Neuester Stand insgesamt — wird als „gesehen" gemerkt. */
  latest: string | null;
}
