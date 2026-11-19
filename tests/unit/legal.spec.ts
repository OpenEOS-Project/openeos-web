import { expect, test } from '@playwright/test';

import {
  isHttpUrl,
  isLegalInfoComplete,
  localizePlatformUrl,
  parseLegalInline,
  parseLegalText,
} from '@/lib/legal';
import { isAcceptableLegalDocument, pendingLegalDocuments } from '@/lib/legal-platform';

test.describe('legal: platform links', () => {
  test('English openeos.de pages live under /en', () => {
    expect(localizePlatformUrl('https://openeos.de/impressum', 'en')).toBe('https://openeos.de/en/impressum');
    expect(localizePlatformUrl('https://openeos.de/datenschutz', 'en-GB')).toBe('https://openeos.de/en/datenschutz');
    expect(localizePlatformUrl('https://openeos.de/en/datenschutz', 'en')).toBe('https://openeos.de/en/datenschutz');
    expect(localizePlatformUrl('https://openeos.de/impressum', 'de')).toBe('https://openeos.de/impressum');
    expect(localizePlatformUrl('https://openeos.de/agb/2026-11-04', 'en')).toBe('https://openeos.de/en/agb/2026-11-04');
  });

  test('staging website is localized too, PDFs are not', () => {
    expect(localizePlatformUrl('https://staging.openeos.de/avv', 'en')).toBe('https://staging.openeos.de/en/avv');
    expect(localizePlatformUrl('https://openeos.de/rechtstexte/agb-2026-11-04.pdf', 'en')).toBe(
      'https://openeos.de/rechtstexte/agb-2026-11-04.pdf',
    );
  });

  test('self-hosted links stay as configured', () => {
    expect(localizePlatformUrl('https://verein.example/impressum', 'en')).toBe('https://verein.example/impressum');
  });
});

test.describe('legal: settings', () => {
  test('complete needs imprint and privacy, link or text each', () => {
    expect(isLegalInfoComplete(undefined)).toBe(false);
    expect(isLegalInfoComplete({ imprintUrl: 'https://a.example' })).toBe(false);
    expect(isLegalInfoComplete({ imprintUrl: 'https://a.example', privacyText: 'Text' })).toBe(true);
    expect(isLegalInfoComplete({ imprintText: '  ', privacyText: 'Text' })).toBe(false);
  });

  test('only http(s) links count as links', () => {
    expect(isHttpUrl('https://tsv.example/impressum')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('tsv.example/impressum')).toBe(false);
  });
});

test.describe('legal: markdown-light', () => {
  test('paragraphs, line breaks and headings', () => {
    const blocks = parseLegalText('# Impressum\nTSV Musterstadt e.V.\nHauptstr. 1\n\n## Kontakt\nTel. 0123');
    expect(blocks).toEqual([
      { type: 'heading', level: 1, content: [{ type: 'text', text: 'Impressum' }] },
      {
        type: 'paragraph',
        lines: [[{ type: 'text', text: 'TSV Musterstadt e.V.' }], [{ type: 'text', text: 'Hauptstr. 1' }]],
      },
      { type: 'heading', level: 2, content: [{ type: 'text', text: 'Kontakt' }] },
      { type: 'paragraph', lines: [[{ type: 'text', text: 'Tel. 0123' }]] },
    ]);
  });

  test('bold, links and e-mail addresses; no HTML', () => {
    expect(parseLegalInline('**Vorstand:** Max, info@tsv.example, https://tsv.example/x.')).toEqual([
      { type: 'bold', text: 'Vorstand:' },
      { type: 'text', text: ' Max, ' },
      { type: 'link', text: 'info@tsv.example', href: 'mailto:info@tsv.example' },
      { type: 'text', text: ', ' },
      { type: 'link', text: 'https://tsv.example/x', href: 'https://tsv.example/x' },
      { type: 'text', text: '.' },
    ]);
    expect(parseLegalInline('<script>alert(1)</script> javascript:alert(1)')).toEqual([
      { type: 'text', text: '<script>alert(1)</script> javascript:alert(1)' },
    ]);
  });
});

test.describe('legal: documents to accept again', () => {
  const state = (upToDate: boolean, reacceptanceRequired?: boolean) => ({
    currentVersion: '2027-01-15',
    acceptedVersion: '2026-11-18',
    acceptedAt: null,
    upToDate,
    ...(reacceptanceRequired === undefined ? {} : { reacceptanceRequired }),
    acceptedUrl: null,
    acceptedPdfUrl: null,
  });

  test('names exactly the documents the API asks for', () => {
    expect(
      pendingLegalDocuments({
        required: true,
        documents: { agb: state(false, true), avv: state(true, false), anlage1: state(true, false) },
      })
    ).toEqual(['agb']);
    expect(
      pendingLegalDocuments({
        required: true,
        documents: { agb: state(true, false), avv: state(false, true), anlage1: state(false, true) },
      })
    ).toEqual(['avv', 'anlage1']);
  });

  test('ignores outdated documents the API does not ask for', () => {
    // Anlage 1 ohne Zeile in der Ausgangsfassung: nicht fällig.
    expect(
      pendingLegalDocuments({
        required: true,
        documents: { agb: state(false, true), avv: state(true, false), anlage1: state(false, false) },
      })
    ).toEqual(['agb']);
  });

  test('falls back to outdated AGB/AVV for older API versions', () => {
    expect(
      pendingLegalDocuments({ required: true, documents: { agb: state(true), avv: state(false) } })
    ).toEqual(['avv']);
    expect(
      pendingLegalDocuments({ required: true, documents: { agb: state(true), avv: state(true) } })
    ).toEqual(['agb', 'avv']);
    expect(pendingLegalDocuments(undefined)).toEqual(['agb', 'avv']);
  });
});

test.describe('legal: acceptable documents', () => {
  test('AGB, Anlage 1 and AVV are accepted, privacy policy and imprint are not', () => {
    expect(isAcceptableLegalDocument('agb')).toBe(true);
    expect(isAcceptableLegalDocument('anlage1')).toBe(true);
    expect(isAcceptableLegalDocument('avv')).toBe(true);
    expect(isAcceptableLegalDocument('privacy')).toBe(false);
    expect(isAcceptableLegalDocument('imprint')).toBe(false);
  });
});
