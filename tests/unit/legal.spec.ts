import { expect, test } from '@playwright/test';

import {
  isHttpUrl,
  isLegalInfoComplete,
  localizePlatformUrl,
  parseLegalInline,
  parseLegalText,
} from '@/lib/legal';

test.describe('legal: platform links', () => {
  test('English openeos.de pages live under /en', () => {
    expect(localizePlatformUrl('https://openeos.de/imprint', 'en')).toBe('https://openeos.de/en/imprint');
    expect(localizePlatformUrl('https://openeos.de/privacy', 'en-GB')).toBe('https://openeos.de/en/privacy');
    expect(localizePlatformUrl('https://openeos.de/en/privacy', 'en')).toBe('https://openeos.de/en/privacy');
    expect(localizePlatformUrl('https://openeos.de/imprint', 'de')).toBe('https://openeos.de/imprint');
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
