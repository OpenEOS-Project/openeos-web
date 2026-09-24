/** Spiegel der Typen aus der API — Quelle der Einträge ist dort. */
export type ChangelogArt = 'neu' | 'verbessert' | 'behoben';

export interface ChangelogEintrag {
  datum: string;
  art: ChangelogArt;
  titel: { de: string; en: string };
  text: { de: string; en: string };
  /** Eine Zeile für das Fenster beim Anmelden; sonst der volle Text. */
  kurz?: { de: string; en: string };
  /** Veröffentlichung, in der dieser Eintrag erschienen ist. */
  version: string | null;
}

export interface ChangelogAntwort {
  entries: ChangelogEintrag[];
  /** Neuester Stand insgesamt — wird als „gesehen" gemerkt. */
  latest: string | null;
  /** Dieselbe Veröffentlichung als Nummer, wie sie die Website zeigt. */
  latestVersion: string | null;
}
