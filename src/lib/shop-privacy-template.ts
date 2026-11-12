/**
 * Muster für den Datenschutzhinweis im Shop eines Vereins.
 *
 * Das Muster (src/content/legal/…md) besteht aus drei Teilen: einer
 * Einleitung für den Verein, dem Text, der veröffentlicht wird, und
 * „Hinweisen für den Kunden (nicht veröffentlichen)“. Im veröffentlichten
 * Teil stehen Platzhalter: `{{kunde.…}}` für Angaben der Organisation und
 * `[…]` für alles, was der Verein selbst entscheiden muss.
 */
import { SHOP_PRIVACY_TEMPLATE_SOURCE } from '@/content/legal/muster-datenschutzhinweise-shop';

export const PUBLISH_START = '# Datenschutzhinweise für Online-Bestellungen, Helferanmeldung und Kasse';
export const GUIDANCE_HEADING = '## Hinweise für den Kunden (nicht veröffentlichen)';

export type TemplateFieldKind = 'name' | 'address' | 'email' | 'text' | 'payment';

export interface TemplateField {
  /** Schlüssel im Formular. */
  id: string;
  /** Platzhalter, wie er im Muster steht (`{{kunde.name}}`, `[…]`). */
  placeholder: string;
  kind: TemplateFieldKind;
  /** Beschriftung: bei `[…]` der Text in der Klammer. */
  label: string;
}

export interface ShopPrivacyTemplate {
  title: string;
  /** „Stand: 4. November 2026“ (ohne Sternchen). */
  stand: string | null;
  /** Einleitung für den Verein (nicht veröffentlicht). */
  intro: string[];
  /** Der Text zum Veröffentlichen, mit Platzhaltern. */
  body: string;
  fields: TemplateField[];
  /** „Hinweise für den Kunden“ als Aufzählung (nicht veröffentlicht). */
  guidance: string[];
}

/**
 * Auswahl für den Zahlungsdienstleister-Platzhalter des Musters. Nur SumUp:
 * die PayPal-Anbindung ist seit 1.8 entfernt (der Platzhaltertext des
 * vendorten Musters nennt PayPal noch, bis die Rechtstexte nachziehen).
 */
export const PAYMENT_PROVIDER_OPTIONS = ['SumUp'] as const;

const ORG_PLACEHOLDERS: Record<string, TemplateFieldKind> = {
  '{{kunde.name}}': 'name',
  '{{kunde.anschrift}}': 'address',
  '{{kunde.email}}': 'email',
};

const PLACEHOLDER_PATTERN = /\{\{kunde\.[a-z]+\}\}|\[[^\]\n]+\]/g;

export function parseShopPrivacyTemplate(source: string = SHOP_PRIVACY_TEMPLATE_SOURCE): ShopPrivacyTemplate {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((line) => line.trim() === PUBLISH_START);
  const guidanceAt = lines.findIndex((line) => line.trim() === GUIDANCE_HEADING);
  if (start < 0 || guidanceAt < 0 || guidanceAt < start) {
    throw new Error('Muster: Abschnitte nicht gefunden');
  }
  // Ende des veröffentlichten Teils: der Trennstrich vor den Hinweisen.
  let end = guidanceAt;
  for (let i = guidanceAt - 1; i > start; i--) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }

  const head = lines.slice(0, start);
  const title = (head.find((line) => line.startsWith('# ')) ?? '').replace(/^#\s+/, '');
  const standLine = head.find((line) => /^\*\*Stand:/.test(line.trim()));
  const stand = standLine ? standLine.trim().replace(/^\*\*|\*\*$/g, '') : null;
  const intro = head
    .filter((line) => line.trim() && !line.startsWith('#') && line !== standLine && line.trim() !== '---')
    .map((line) => line.trim());

  const body = lines.slice(start, end).join('\n').trim();

  const fields: TemplateField[] = [];
  const seen = new Set<string>();
  for (const match of body.matchAll(PLACEHOLDER_PATTERN)) {
    const placeholder = match[0];
    if (seen.has(placeholder)) continue;
    seen.add(placeholder);
    const orgKind = ORG_PLACEHOLDERS[placeholder];
    if (orgKind) {
      fields.push({ id: placeholder.slice(2, -2), placeholder, kind: orgKind, label: placeholder });
      continue;
    }
    if (placeholder.startsWith('{{')) continue;
    const label = placeholder.slice(1, -1);
    fields.push({
      id: `field-${fields.length}`,
      placeholder,
      kind: /SumUp|PayPal/.test(label) ? 'payment' : 'text',
      label,
    });
  }

  const guidance = lines
    .slice(guidanceAt + 1)
    .filter((line) => line.trim().startsWith('- '))
    .map((line) => line.trim().slice(2));

  return { title, stand, intro, body, fields, guidance };
}

/** Werte bereinigen: Mehrzeiliges ohne Leerzeilen (sonst bricht der Absatz). */
function cleanValue(field: TemplateField, value: string): string {
  const trimmed = value.replace(/\r\n?/g, '\n').trim();
  if (field.kind === 'address' || field.kind === 'text') {
    return trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n');
  }
  return trimmed.replace(/\s*\n\s*/g, ' ');
}

/**
 * Platzhalter durch die Eingaben ersetzen. Leere Felder bleiben als
 * Platzhalter stehen — so sieht man in der Vorschau, was noch fehlt.
 */
export function fillShopPrivacyTemplate(
  template: ShopPrivacyTemplate,
  values: Record<string, string>,
): string {
  let text = template.body;
  for (const field of template.fields) {
    const value = cleanValue(field, values[field.id] ?? '');
    if (!value) continue;
    text = text.split(field.placeholder).join(value);
  }
  return text;
}

export function missingTemplateFields(template: ShopPrivacyTemplate, values: Record<string, string>): TemplateField[] {
  return template.fields.filter((field) => !cleanValue(field, values[field.id] ?? ''));
}

/**
 * Platzhalter des Musters, die in einem Text noch stehen (`{{kunde.…}}`
 * oder eine der Klammern aus dem Muster). Solche Texte gehören nicht in
 * den Shop — die API lehnt `{{kunde.` ebenfalls ab.
 */
export function unfilledTemplatePlaceholders(
  text: string,
  template: ShopPrivacyTemplate = parseShopPrivacyTemplate(),
): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\{\{kunde\.[^}]*\}\}/g)) found.add(match[0]);
  if (text.includes('{{kunde.') && found.size === 0) found.add('{{kunde.');
  for (const field of template.fields) {
    if (field.placeholder.startsWith('[') && text.includes(field.placeholder)) found.add(field.placeholder);
  }
  return [...found];
}

export interface OrganizationTemplateSource {
  name?: string | null;
  settings?: {
    legalName?: string;
    address?: { street?: string; zip?: string; city?: string };
    contact?: { address?: string; zipCode?: string; city?: string };
    legal?: { contactEmail?: string };
  } | null;
  billingEmail?: string | null;
}

/** Vorbelegung der `{{kunde.…}}`-Felder aus den Angaben der Organisation. */
export function organizationTemplateValues(org: OrganizationTemplateSource | null | undefined): Record<string, string> {
  const settings = org?.settings ?? {};
  const name = settings.legalName?.trim() || org?.name?.trim() || '';
  const address = settings.address;
  const contact = settings.contact;
  const street = address?.street?.trim() || contact?.address?.trim() || '';
  const zip = address?.zip?.trim() || contact?.zipCode?.trim() || '';
  const city = address?.city?.trim() || contact?.city?.trim() || '';
  const place = [zip, city].filter(Boolean).join(' ');
  const email = settings.legal?.contactEmail?.trim() || org?.billingEmail?.trim() || '';
  return {
    'kunde.name': name,
    'kunde.anschrift': [street, place].filter(Boolean).join('\n'),
    'kunde.email': email,
  };
}
