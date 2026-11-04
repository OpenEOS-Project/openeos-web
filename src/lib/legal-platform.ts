/**
 * Rechtstexte von OpenEOS (LUXCODE): Adressen, Fassungen, Rückfallwerte.
 *
 * Die gültigen Adressen nennt `GET /legal/versions` — auf Staging zeigen
 * sie auf staging.openeos.de, im Betrieb auf openeos.de. Bis die Antwort da
 * ist (oder wenn die API sie nicht kennt), gelten die Seiten auf
 * openeos.de; ein Link soll nie ins Leere zeigen.
 */
import type { LegalDocumentKey, LegalDocumentVersion, LegalVersions } from '@/types/legal';

export const FALLBACK_LEGAL_SITE = 'https://openeos.de';

/** Pfade der Rechtstexte auf der Website. */
export const LEGAL_DOCUMENT_PATHS: Record<LegalDocumentKey, string> = {
  agb: '/agb',
  avv: '/avv',
  privacy: '/datenschutz',
  imprint: '/impressum',
};

export const LEGAL_DOCUMENT_KEYS: LegalDocumentKey[] = ['agb', 'avv', 'privacy', 'imprint'];

function fallbackDocument(key: LegalDocumentKey, site: string): LegalDocumentVersion {
  const url = `${site}${LEGAL_DOCUMENT_PATHS[key]}`;
  return { version: null, url, versionUrl: url, pdfUrl: null };
}

/** Rückfall: aktuelle Fassungen auf openeos.de, ohne Stand und PDF. */
export function fallbackLegalVersions(site: string = FALLBACK_LEGAL_SITE): LegalVersions {
  return {
    enabled: true,
    siteUrl: site,
    documents: {
      agb: fallbackDocument('agb', site),
      avv: fallbackDocument('avv', site),
      privacy: fallbackDocument('privacy', site),
      imprint: fallbackDocument('imprint', site),
    },
  };
}

/**
 * Antwort der API mit dem Rückfall auffüllen: fehlt ein Dokument oder eine
 * Adresse, steht dort die Seite auf openeos.de.
 */
export function withLegalFallback(data: Partial<LegalVersions> | null | undefined): LegalVersions {
  const fallback = fallbackLegalVersions(data?.siteUrl || FALLBACK_LEGAL_SITE);
  if (!data) return fallback;
  const documents = { ...fallback.documents };
  for (const key of LEGAL_DOCUMENT_KEYS) {
    const doc = data.documents?.[key];
    if (!doc) continue;
    documents[key] = {
      version: doc.version || null,
      url: doc.url || fallback.documents[key].url,
      versionUrl: doc.versionUrl || doc.url || fallback.documents[key].versionUrl,
      pdfUrl: doc.pdfUrl || null,
    };
  }
  return { enabled: data.enabled !== false, siteUrl: fallback.siteUrl, documents };
}

/** Stand „2026-11-04“ als Datum der Oberfläche, ohne Zeitzonen-Verschiebung. */
export function formatLegalVersion(version: string | null | undefined, locale: string): string {
  if (!version) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version);
  if (!match) return version;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat(locale.startsWith('en') ? 'en-GB' : 'de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Sprungmarke auf Anhang B des AVV (Unterauftragsverarbeiter). */
export function subprocessorsUrl(avvUrl: string): string {
  return `${avvUrl.replace(/#.*$/, '')}#anhang-b`;
}
