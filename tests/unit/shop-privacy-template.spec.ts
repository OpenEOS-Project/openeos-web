import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { SHOP_PRIVACY_TEMPLATE_SOURCE } from '@/content/legal/muster-datenschutzhinweise-shop';
import {
  fallbackLegalVersions,
  formatLegalVersion,
  subprocessorsUrl,
  withLegalFallback,
} from '@/lib/legal-platform';
import {
  fillShopPrivacyTemplate,
  missingTemplateFields,
  organizationTemplateValues,
  parseShopPrivacyTemplate,
  PUBLISH_START,
  unfilledTemplatePlaceholders,
} from '@/lib/shop-privacy-template';

const template = parseShopPrivacyTemplate();

test.describe('shop privacy template', () => {
  test('generated module matches the vendored markdown byte for byte', () => {
    const md = readFileSync(join(__dirname, '../../src/content/legal/muster-datenschutzhinweise-shop.md'), 'utf8');
    expect(SHOP_PRIVACY_TEMPLATE_SOURCE).toBe(md);
  });

  test('publishable part runs from the title to the rule before the guidance', () => {
    expect(template.body.startsWith(PUBLISH_START)).toBe(true);
    // Abschnitt 7 „Kassenpersonal (Bedienungen)“ steht am Ende.
    expect(
      template.body.endsWith('Eine Auskunft über die zu Ihrem Profil gespeicherten Daten können wir Ihnen als Datei geben.'),
    ).toBe(true);
    expect(template.body).toContain('## 7. Kassenpersonal (Bedienungen)');
    expect(template.body).not.toContain('Hinweise für den Kunden');
    expect(template.body).not.toContain('\n---');
    // Wortlaut unverändert: der Teil steht so im Muster.
    expect(SHOP_PRIVACY_TEMPLATE_SOURCE).toContain(template.body);
  });

  test('intro, stand and guidance are read for the club', () => {
    expect(template.stand).toBe('Stand: 4. November 2026');
    expect(template.intro).toHaveLength(1);
    expect(template.intro[0]).toMatch(/^Dieses Muster stellt LUXCODE/);
    expect(template.guidance).toHaveLength(5);
    expect(template.guidance[4]).toMatch(/Kassenpersonal über Abschnitt 7/);
    expect(template.guidance[0]).toMatch(/ersetzt keine Rechtsberatung/);
  });

  test('every placeholder becomes a field', () => {
    expect(template.fields.map((f) => f.kind)).toEqual(['name', 'address', 'email', 'text', 'text', 'payment', 'text', 'text']);
    expect(template.fields[3].label).toBe('Vertretungsberechtigte Person, z. B. Vorstand nach § 26 BGB');
    expect(template.fields[5].placeholder).toBe('[SumUp und/oder PayPal, nicht Genutztes streichen]');
  });

  test('filling replaces all placeholders, empty ones stay visible', () => {
    const values: Record<string, string> = {
      'kunde.name': 'TSV Musterstadt e.V.',
      'kunde.anschrift': 'Hauptstraße 1\n\n12345 Musterstadt',
      'kunde.email': 'info@tsv.example',
    };
    const partial = fillShopPrivacyTemplate(template, values);
    expect(partial).toContain('TSV Musterstadt e.V.\nHauptstraße 1\n12345 Musterstadt\nE-Mail: info@tsv.example');
    expect(missingTemplateFields(template, values)).toHaveLength(5);
    expect(unfilledTemplatePlaceholders(partial, template)).toHaveLength(5);

    for (const field of template.fields.slice(3)) values[field.id] = field.kind === 'payment' ? 'SumUp' : 'Wert';
    const full = fillShopPrivacyTemplate(template, values);
    expect(missingTemplateFields(template, values)).toEqual([]);
    expect(unfilledTemplatePlaceholders(full, template)).toEqual([]);
    expect(full).toContain('abgewickelt: SumUp.');
    expect(full).not.toMatch(/\{\{|\[/);
  });

  test('unfinished texts are detected', () => {
    expect(unfilledTemplatePlaceholders('Verantwortlich: {{kunde.name}}', template)).toEqual(['{{kunde.name}}']);
    expect(unfilledTemplatePlaceholders('Eigener Text ohne Platzhalter [1]', template)).toEqual([]);
  });

  test('organization data prefills name, address and email', () => {
    expect(
      organizationTemplateValues({
        name: 'TSV',
        billingEmail: 'rechnung@tsv.example',
        settings: {
          legalName: 'TSV Musterstadt e.V.',
          contact: { address: 'Hauptstraße 1', zipCode: '12345', city: 'Musterstadt' },
          legal: { contactEmail: 'datenschutz@tsv.example' },
        },
      }),
    ).toEqual({
      'kunde.name': 'TSV Musterstadt e.V.',
      'kunde.anschrift': 'Hauptstraße 1\n12345 Musterstadt',
      'kunde.email': 'datenschutz@tsv.example',
    });
    expect(organizationTemplateValues({ name: 'TSV', settings: null })).toEqual({
      'kunde.name': 'TSV',
      'kunde.anschrift': '',
      'kunde.email': '',
    });
  });
});

test.describe('legal versions', () => {
  test('fallback points to openeos.de', () => {
    const fallback = fallbackLegalVersions();
    expect(fallback.enabled).toBe(true);
    expect(fallback.documents.agb.url).toBe('https://openeos.de/agb');
    expect(fallback.documents.privacy.versionUrl).toBe('https://openeos.de/datenschutz');
    expect(fallback.documents.imprint.pdfUrl).toBeNull();
  });

  test('API answer is used and gaps are filled', () => {
    const versions = withLegalFallback({
      enabled: false,
      siteUrl: 'https://staging.openeos.de',
      documents: {
        agb: {
          version: '2026-11-04',
          url: 'https://staging.openeos.de/agb',
          versionUrl: 'https://staging.openeos.de/agb/2026-11-04',
          pdfUrl: 'https://staging.openeos.de/rechtstexte/agb-2026-11-04.pdf',
        },
      } as never,
    });
    expect(versions.enabled).toBe(false);
    expect(versions.documents.agb.versionUrl).toBe('https://staging.openeos.de/agb/2026-11-04');
    expect(versions.documents.avv.url).toBe('https://staging.openeos.de/avv');
  });

  test('version dates and AVV annex', () => {
    expect(formatLegalVersion('2026-11-04', 'de')).toBe('4. November 2026');
    expect(formatLegalVersion('2026-11-04', 'en')).toBe('4 November 2026');
    expect(formatLegalVersion(null, 'de')).toBe('');
    expect(subprocessorsUrl('https://openeos.de/avv')).toBe('https://openeos.de/avv#anhang-b');
  });
});
