/**
 * Rechtliche Angaben der Vereine (Impressum, Datenschutzhinweis) und die
 * Plattform-Links von OpenEOS.
 *
 * Der Verein verkauft im Shop und erhebt auf den Helferseiten Daten — sein
 * Impressum und sein Datenschutzhinweis gehoeren deshalb auf diese Seiten.
 * OpenEOS steht darunter nur als Plattformbetreiber ("Bereitgestellt mit
 * OpenEOS"). Die Angaben liegen in `settings.legal` der Organisation, die
 * oeffentlichen Endpunkte liefern sie als `legal` mit aus.
 */

/** So liegen die Angaben in den Organisationseinstellungen. */
export interface OrganizationLegalSettings {
  imprintUrl?: string;
  imprintText?: string;
  privacyUrl?: string;
  privacyText?: string;
  contactEmail?: string;
}

/** Was oeffentliche Endpunkte ausliefern (`data.legal`). */
export interface PublicLegalInfo {
  organizationName: string;
  imprintUrl: string | null;
  imprintText: string | null;
  privacyUrl: string | null;
  privacyText: string | null;
  contactEmail: string | null;
  complete: boolean;
  platform: { imprintUrl: string | null; privacyUrl: string | null };
}

/** Dieselben Grenzen wie in der API (legal-settings.util.ts). */
export const LEGAL_LIMITS = {
  url: 500,
  imprintText: 5000,
  privacyText: 20000,
  contactEmail: 255,
} as const;

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/** Hat der Verein Impressum und Datenschutzhinweis hinterlegt? */
export function isLegalInfoComplete(legal: OrganizationLegalSettings | null | undefined): boolean {
  if (!legal) return false;
  const has = (url?: string, text?: string) => Boolean(url?.trim() || text?.trim());
  return has(legal.imprintUrl, legal.imprintText) && has(legal.privacyUrl, legal.privacyText);
}

/**
 * Die Seiten von openeos.de gibt es auf Englisch unter `/en/...`. Andere
 * Adressen (Self-Hosting) bleiben unveraendert — deren Sprachaufteilung
 * kennen wir nicht.
 */
export function localizePlatformUrl(url: string, locale: string): string {
  if (!locale.startsWith('en')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'openeos.de' && parsed.hostname !== 'www.openeos.de') return url;
    if (parsed.pathname === '/en' || parsed.pathname.startsWith('/en/')) return url;
    parsed.pathname = `/en${parsed.pathname === '/' ? '' : parsed.pathname}`;
    return parsed.toString();
  } catch {
    return url;
  }
}

// ── Markdown-light ────────────────────────────────────────────────────────
//
// Der Freitext wird als reiner Text gespeichert. Angezeigt werden Absaetze
// (Leerzeile), Zeilenumbrueche, Ueberschriften (`#`, `##`, `###`), fett
// (`**text**`) sowie Links und E-Mail-Adressen, die automatisch klickbar
// werden. Kein HTML — gerendert wird ueber React-Elemente.

export type LegalInline =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'link'; text: string; href: string };

export type LegalBlock =
  | { type: 'heading'; level: 1 | 2 | 3; content: LegalInline[] }
  | { type: 'paragraph'; lines: LegalInline[][] };

const LINK_PATTERN = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

function linkify(text: string, bold: boolean): LegalInline[] {
  const out: LegalInline[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ type: bold ? 'bold' : 'text', text: text.slice(last, index) });
    const [value] = match;
    out.push({ type: 'link', text: value, href: match[1] ? value : `mailto:${value}` });
    last = index + value.length;
  }
  if (last < text.length) out.push({ type: bold ? 'bold' : 'text', text: text.slice(last) });
  return out;
}

export function parseLegalInline(line: string): LegalInline[] {
  const out: LegalInline[] = [];
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    const isBold = part.startsWith('**') && part.endsWith('**') && part.length > 4;
    out.push(...linkify(isBold ? part.slice(2, -2) : part, isBold));
  }
  return out;
}

export function parseLegalText(text: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  const chunks = text.replace(/\r\n?/g, '\n').split(/\n\s*\n/);
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((line) => line.trimEnd()).filter((line) => line.trim() !== '');
    let paragraph: LegalInline[][] = [];
    const flush = () => {
      if (paragraph.length) blocks.push({ type: 'paragraph', lines: paragraph });
      paragraph = [];
    };
    for (const line of lines) {
      const heading = /^(#{1,3})\s+(.+)$/.exec(line.trim());
      if (heading) {
        flush();
        blocks.push({
          type: 'heading',
          level: heading[1].length as 1 | 2 | 3,
          content: parseLegalInline(heading[2]),
        });
      } else {
        paragraph.push(parseLegalInline(line));
      }
    }
    flush();
  }
  return blocks;
}
