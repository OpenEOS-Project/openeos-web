import { expect, test } from '@playwright/test';

import { assistantUsable, privacyUrl, quotaLine } from '@/lib/assistant';
import {
  EMPTY_MENU_SUGGESTION,
  MENU_IMPORT_ACCEPT,
  MENU_IMPORT_IMAGE_ACCEPT,
  buildApplyPayload,
  buildPreview,
  checkMenuFiles,
  formatPriceInput,
  matchPfandType,
  menuImportAccept,
  menuImportPending,
  parsePrice,
  preselectIcon,
} from '@/lib/menu-import';

import type { MenuSuggestion } from '@/types/assistant';

/*
 * Speisekarten-Import: Dateiprüfung vor dem Hochladen, Aufbau der
 * Vorschau-Tabelle aus dem Vorschlag der API und der Körper für
 * `POST …/apply`; dazu die Kontingent-Zeile der Einstellungen.
 */

function file(name: string, type: string, mb = 1) {
  return { name, type, size: Math.round(mb * 1024 * 1024) };
}

const suggestion: MenuSuggestion = {
  categories: [
    { key: 'c1', name: 'Vom Grill' },
    { key: 'c2', name: 'Getränke', existingCategoryId: 'cat-drinks' },
  ],
  products: [
    {
      key: 'p1',
      categoryKey: 'c1',
      name: 'Bratwurst im Brötchen',
      price: 3.5,
      taxRate: 19,
      iconSuggestions: [
        { icon: 'pos-icon:grillwurst-brot', score: 0.9 },
        { icon: 'pos-icon:bratwurst', score: 0.7 },
      ],
      confidence: 'high',
    },
    {
      key: 'p2',
      categoryKey: 'c2',
      name: 'Pils',
      description: 'vom Fass',
      price: 3,
      taxRate: 19,
      pfand: { suggested: true, amount: 2 },
      variants: [
        { name: '0,3 l', priceModifier: 0 },
        { name: '0,5 l', priceModifier: 1 },
      ],
      existingProductId: 'prod-pils',
      confidence: 'medium',
      note: 'Preis der 0,5 l schlecht lesbar',
    },
    {
      key: 'p3',
      categoryKey: 'c9',
      name: 'Kaffee',
      price: 0,
      taxRate: 19,
      confidence: 'low',
    },
  ],
  warnings: ['Seite 2 ist unscharf'],
};

const pfandTypes = [
  { id: 'pf-cup', name: 'Becher', amount: 2, isActive: true },
  { id: 'pf-glass', name: 'Glas', amount: 5, isActive: true },
  { id: 'pf-old', name: 'Alt', amount: 1, isActive: false },
];

test.describe('checkMenuFiles', () => {
  test('accepts up to six images and exactly one PDF', () => {
    expect(checkMenuFiles([file('a.jpg', 'image/jpeg')])).toEqual({ ok: true, kind: 'images' });
    expect(
      checkMenuFiles(Array.from({ length: 6 }, (_, i) => file(`${i}.png`, 'image/png')))
    ).toEqual({ ok: true, kind: 'images' });
    expect(checkMenuFiles([file('karte.pdf', 'application/pdf')])).toEqual({
      ok: true,
      kind: 'pdf',
    });
  });

  test('rejects empty, unknown types, too many, too large and PDF with images', () => {
    expect(checkMenuFiles([])).toMatchObject({ ok: false, problem: 'empty' });
    expect(checkMenuFiles([file('karte.docx', 'application/vnd.openxmlformats')])).toMatchObject({
      ok: false,
      problem: 'type',
      params: { name: 'karte.docx' },
    });
    expect(
      checkMenuFiles(Array.from({ length: 7 }, (_, i) => file(`${i}.webp`, 'image/webp')))
    ).toMatchObject({ ok: false, problem: 'tooMany', params: { max: 6 } });
    expect(checkMenuFiles([file('gross.jpg', 'image/jpeg', 10.5)])).toMatchObject({
      ok: false,
      problem: 'tooLarge',
      params: { maxMb: 10, name: 'gross.jpg' },
    });
    expect(
      checkMenuFiles([file('a.pdf', 'application/pdf'), file('b.jpg', 'image/jpeg')])
    ).toMatchObject({
      ok: false,
      problem: 'pdfAlone',
    });
  });

  test('falls back to the file extension when the browser sends no type', () => {
    expect(checkMenuFiles([file('Karte.JPG', '')])).toEqual({ ok: true, kind: 'images' });
    expect(checkMenuFiles([file('karte.pdf', '')])).toEqual({ ok: true, kind: 'pdf' });
    expect(checkMenuFiles([file('karte', '')])).toMatchObject({ ok: false, problem: 'type' });
  });

  test('honours custom limits', () => {
    expect(
      checkMenuFiles([file('a.jpg', 'image/jpeg'), file('b.jpg', 'image/jpeg')], { max: 1 })
    ).toMatchObject({
      ok: false,
      problem: 'tooMany',
      params: { max: 1 },
    });
    expect(checkMenuFiles([file('a.jpg', 'image/jpeg', 3)], { maxMb: 2 })).toMatchObject({
      problem: 'tooLarge',
    });
  });

  test('rejects PDF when the provider does not read it', () => {
    // Same answer the API would give as MENU_IMPORT_PDF_UNSUPPORTED.
    expect(checkMenuFiles([file('karte.pdf', 'application/pdf')], { pdfSupported: false })).toEqual(
      {
        ok: false,
        problem: 'pdfUnsupported',
        params: { max: 6, maxMb: 10, name: 'karte.pdf' },
      }
    );
    // The flag wins over the "PDF only on its own" rule.
    expect(
      checkMenuFiles([file('b.jpg', 'image/jpeg'), file('karte.pdf', '')], { pdfSupported: false })
    ).toMatchObject({ ok: false, problem: 'pdfUnsupported', params: { name: 'karte.pdf' } });
    // Images are unaffected; the default keeps PDF allowed.
    expect(checkMenuFiles([file('a.jpg', 'image/jpeg')], { pdfSupported: false })).toEqual({
      ok: true,
      kind: 'images',
    });
    expect(checkMenuFiles([file('karte.pdf', 'application/pdf')], { pdfSupported: true })).toEqual({
      ok: true,
      kind: 'pdf',
    });
  });

  test('accept list offers PDF only when supported', () => {
    expect(menuImportAccept(true)).toBe(MENU_IMPORT_ACCEPT);
    expect(menuImportAccept(false)).toBe(MENU_IMPORT_IMAGE_ACCEPT);
    expect(MENU_IMPORT_ACCEPT).toContain('application/pdf');
    expect(MENU_IMPORT_IMAGE_ACCEPT).not.toContain('pdf');
    expect(MENU_IMPORT_IMAGE_ACCEPT.split(',')).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });
});

test.describe('prices', () => {
  test('parses German and English input', () => {
    expect(parsePrice('4,50')).toBe(4.5);
    expect(parsePrice('4.5')).toBe(4.5);
    expect(parsePrice(' 12 € ')).toBe(12);
    expect(parsePrice('3,999')).toBe(4);
    expect(parsePrice(2.345)).toBe(2.35);
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('1,2,3')).toBeNull();
  });

  test('formats for the input field', () => {
    expect(formatPriceInput(3.5)).toBe('3.50');
    expect(formatPriceInput(0)).toBe('0.00');
    expect(formatPriceInput(1.005)).toBe('1.00');
  });
});

test.describe('matchPfandType', () => {
  test('matches the amount, otherwise the only active type, otherwise nothing', () => {
    expect(matchPfandType(undefined, pfandTypes)).toBe('');
    expect(matchPfandType({ suggested: false }, pfandTypes)).toBe('');
    expect(matchPfandType({ suggested: true, amount: 2 }, pfandTypes)).toBe('pf-cup');
    expect(matchPfandType({ suggested: true, amount: 1 }, pfandTypes)).toBe('');
    expect(matchPfandType({ suggested: true }, pfandTypes)).toBe('');
    expect(matchPfandType({ suggested: true }, [pfandTypes[0]])).toBe('pf-cup');
    expect(matchPfandType({ suggested: true, amount: 3 }, [pfandTypes[0]])).toBe('pf-cup');
  });
});

test.describe('buildPreview', () => {
  test('prefills every row from the suggestion', () => {
    const state = buildPreview(suggestion, {
      pfandTypes,
      existingCategories: [
        { id: 'cat-drinks', name: 'Getränke' },
        { id: 'cat-sweets', name: 'Süßes' },
      ],
    });

    expect(state.categories).toEqual([
      { key: 'c1', name: 'Vom Grill' },
      { key: 'c2', name: 'Getränke', existingCategoryId: 'cat-drinks' },
      { key: 'e1', name: 'Süßes', existingCategoryId: 'cat-sweets' },
    ]);

    const [wurst, pils, kaffee] = state.rows;
    expect(wurst).toMatchObject({
      key: 'p1',
      selected: true,
      price: '3.50',
      icon: 'pos-icon:grillwurst-brot',
      action: 'create',
      pfandTypeId: '',
      variants: [],
    });
    expect(pils).toMatchObject({
      action: 'update',
      existingProductId: 'prod-pils',
      pfandTypeId: 'pf-cup',
      pfandSuggested: true,
      pfandAmount: 2,
      description: 'vom Fass',
      icon: null,
      variants: [
        { name: '0,3 l', priceModifier: '0.00' },
        { name: '0,5 l', priceModifier: '1.00' },
      ],
      note: 'Preis der 0,5 l schlecht lesbar',
    });
    // Unknown category key falls back to the first category.
    expect(kaffee.categoryKey).toBe('c1');
    expect(kaffee.price).toBe('0.00');
  });

  test('yields no rows for a menu without products (done, not failed)', () => {
    expect(buildPreview(EMPTY_MENU_SUGGESTION)).toEqual({ categories: [], rows: [] });
    // Warnings travel alongside; existing categories still become options.
    const state = buildPreview(
      { categories: [], products: [], warnings: ['Nichts erkannt'] },
      { existingCategories: [{ id: 'cat-drinks', name: 'Getränke' }] }
    );
    expect(state.rows).toEqual([]);
    expect(state.categories).toEqual([
      { key: 'e1', name: 'Getränke', existingCategoryId: 'cat-drinks' },
    ]);
    expect(buildApplyPayload(state)).toEqual({
      data: { categories: [], products: [] },
      problems: {},
      counts: { create: 0, update: 0 },
    });
  });

  test('works without pfand types and existing categories', () => {
    const state = buildPreview({ categories: [], products: [], warnings: [] });
    expect(state).toEqual({ categories: [], rows: [] });
  });
});

test.describe('buildApplyPayload', () => {
  test('sends only selected rows and the categories they use', () => {
    const state = buildPreview(suggestion, { pfandTypes });
    state.rows[2].selected = false;
    state.rows[0].name = '  Bratwurst  ';
    state.rows[0].price = '3,80';
    state.rows[1].variants[1].priceModifier = '1,50';

    const build = buildApplyPayload(state);
    expect(build.problems).toEqual({});
    expect(build.counts).toEqual({ create: 1, update: 1 });
    expect(build.data.categories).toEqual([
      { key: 'c1', name: 'Vom Grill' },
      { key: 'c2', name: 'Getränke', existingCategoryId: 'cat-drinks' },
    ]);
    expect(build.data.products).toEqual([
      {
        key: 'p1',
        categoryKey: 'c1',
        name: 'Bratwurst',
        price: 3.8,
        taxRate: 19,
        icon: 'pos-icon:grillwurst-brot',
        action: 'create',
      },
      {
        key: 'p2',
        categoryKey: 'c2',
        name: 'Pils',
        description: 'vom Fass',
        price: 3,
        taxRate: 19,
        pfandTypeId: 'pf-cup',
        variants: [
          { name: '0,3 l', priceModifier: 0 },
          { name: '0,5 l', priceModifier: 1.5 },
        ],
        action: 'update',
        existingProductId: 'prod-pils',
      },
    ]);
  });

  test('creates instead of updating when the user switches the action', () => {
    const state = buildPreview(suggestion, { pfandTypes });
    state.rows[1].action = 'create';
    const build = buildApplyPayload(state);
    const pils = build.data.products.find((product) => product.key === 'p2');
    expect(pils).toMatchObject({ action: 'create' });
    expect(pils).not.toHaveProperty('existingProductId');
    expect(build.counts).toEqual({ create: 3, update: 0 });
  });

  test('reports incomplete rows instead of sending them', () => {
    const state = buildPreview(suggestion, { pfandTypes });
    state.rows[0].name = ' ';
    state.rows[1].price = 'drei';
    state.rows[2].variants = [{ name: 'groß', priceModifier: '' }];
    const build = buildApplyPayload(state);
    expect(build.problems).toEqual({ p1: 'name', p2: 'price', p3: 'variant' });
    expect(build.data.products).toEqual([]);
    expect(build.data.categories).toEqual([]);
  });

  test('ignores problems in rows that are not selected', () => {
    const state = buildPreview(suggestion, { pfandTypes });
    state.rows[0].name = '';
    state.rows[0].selected = false;
    expect(buildApplyPayload(state).problems).toEqual({});
  });
});

test.describe('preselectIcon', () => {
  test('takes the best suggestion when it is lexical (also without source)', () => {
    expect(preselectIcon([{ icon: 'pos-icon:bratwurst', score: 0.4 }])).toBe('pos-icon:bratwurst');
    expect(
      preselectIcon([
        { icon: 'pos-icon:bratwurst', score: 0.6, source: 'lexical' },
        { icon: 'pos-icon:steak', score: 0.75, source: 'model' },
      ])
    ).toBe('pos-icon:bratwurst');
  });

  test('model suggestions only from 0.75 upwards', () => {
    expect(preselectIcon([{ icon: 'pos-icon:steak', score: 0.75, source: 'model' }])).toBe(
      'pos-icon:steak'
    );
    expect(preselectIcon([{ icon: 'pos-icon:steak', score: 0.9, source: 'model' }])).toBe(
      'pos-icon:steak'
    );
    expect(
      preselectIcon([
        { icon: 'pos-icon:steak', score: 0.74, source: 'model' },
        { icon: 'pos-icon:bratwurst', score: 0.3, source: 'lexical' },
      ])
    ).toBeNull();
    expect(preselectIcon([])).toBeNull();
    expect(preselectIcon(undefined)).toBeNull();
  });

  test('buildPreview leaves the icon empty for an unsure model suggestion', () => {
    const state = buildPreview({
      categories: [{ key: 'c1', name: 'Vom Grill' }],
      products: [
        {
          key: 'p1',
          categoryKey: 'c1',
          name: 'Tagesgericht',
          price: 5,
          taxRate: 19,
          confidence: 'high',
          iconSuggestions: [{ icon: 'pos-icon:eintopf', score: 0.5, source: 'model' }],
        },
      ],
      warnings: [],
    });
    expect(state.rows[0].icon).toBeNull();
    expect(state.rows[0].iconSuggestions).toHaveLength(1);
  });
});

test.describe('assistant status', () => {
  test('menuImportPending only while queued or processing', () => {
    expect(menuImportPending('queued')).toBe(true);
    expect(menuImportPending('processing')).toBe(true);
    expect(menuImportPending('done')).toBe(false);
    expect(menuImportPending('failed')).toBe(false);
    expect(menuImportPending(undefined)).toBe(false);
  });

  test('usable only when available and enabled', () => {
    const quotas = {
      menuImports: { limit: 5, used: 0, remaining: 5, resetAt: '2026-10-30T00:00:00+01:00' },
      classifications: {
        limit: 500,
        used: 0,
        remaining: 500,
        resetAt: '2026-10-30T00:00:00+01:00',
      },
    };
    expect(assistantUsable({ enabled: true, available: true, pdfSupported: true, quotas })).toBe(
      true
    );
    expect(assistantUsable({ enabled: true, available: false, pdfSupported: true, quotas })).toBe(
      false
    );
    expect(assistantUsable({ enabled: false, available: true, pdfSupported: false, quotas })).toBe(
      false
    );
    expect(assistantUsable(undefined)).toBe(false);
  });

  test('quota line: remaining, exhausted or nothing', () => {
    const resetAt = '2026-10-30T00:00:00+01:00';
    expect(quotaLine({ limit: 5, used: 1, remaining: 4, resetAt })).toEqual({
      kind: 'remaining',
      remaining: 4,
      limit: 5,
    });
    expect(quotaLine({ limit: 5, used: 5, remaining: 0, resetAt })).toEqual({
      kind: 'exhausted',
      limit: 5,
    });
    expect(quotaLine({ limit: 5, used: 7, remaining: -2, resetAt })).toEqual({
      kind: 'exhausted',
      limit: 5,
    });
    expect(quotaLine({ limit: 5, used: 0, remaining: 9, resetAt })).toEqual({
      kind: 'remaining',
      remaining: 5,
      limit: 5,
    });
    expect(quotaLine({ limit: 0, used: 0, remaining: 0, resetAt })).toEqual({ kind: 'none' });
    expect(quotaLine(undefined)).toEqual({ kind: 'none' });
  });

  test('privacy policy per language', () => {
    expect(privacyUrl('de')).toBe('https://openeos.de/privacy');
    expect(privacyUrl('en')).toBe('https://openeos.de/en/privacy');
  });
});
