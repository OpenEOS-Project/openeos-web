import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { hasModelSuggestion } from '@/lib/assistant';

/*
 * Kennzeichnung KI-generierter Vorschläge (Art. 50 KI-VO, ab 2.12.2026):
 * Modell-Treffer tragen das Label, Treffer aus dem Icon-Verzeichnis nicht;
 * der Text steht in beiden Sprachen so, wie ihn die Rechtsprüfung vorgibt.
 */

function messages(lang: 'de' | 'en') {
  const file = path.join(process.cwd(), 'src', 'messages', `${lang}.json`);
  return JSON.parse(readFileSync(file, 'utf8')) as { common: { aiSuggestion: { label: string } } };
}

test.describe('AI suggestion label', () => {
  test('only model suggestions are AI-generated', () => {
    expect(hasModelSuggestion([{ source: 'lexical' }, { source: 'lexical' }])).toBe(false);
    expect(hasModelSuggestion([{ source: 'lexical' }, { source: 'model' }])).toBe(true);
    expect(hasModelSuggestion([])).toBe(false);
    expect(hasModelSuggestion(undefined)).toBe(false);
  });

  test('label text in German and English', () => {
    expect(messages('de').common.aiSuggestion.label).toBe('KI-generierter Vorschlag');
    expect(messages('en').common.aiSuggestion.label).toBe('AI-generated suggestion');
  });
});
