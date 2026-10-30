import type {
  ApplyMenuImportData,
  ApplyMenuImportProduct,
  IconSuggestion,
  MenuConfidence,
  MenuSuggestion,
  MenuSuggestionVariant,
  MenuTaxRate,
} from '@/types/assistant';

/**
 * Speisekarten-Import: die reinen Funktionen hinter dem Dialog —
 * Dateiprüfung vor dem Hochladen, der Zustand der Vorschau-Tabelle aus
 * dem Vorschlag der API und daraus der Körper für `POST …/apply`.
 *
 * Grenzen wie in openeos-api (AI_MENU_PAGES_PER_IMPORT, AI_MAX_UPLOAD_MB,
 * MAX_TEXT_LENGTH); maßgeblich bleibt der Server.
 */

export const MENU_IMPORT_MAX_FILES = 6;
export const MENU_IMPORT_MAX_MB = 10;
export const MENU_IMPORT_MAX_TEXT = 20000;
export const MENU_IMPORT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MENU_IMPORT_PDF_TYPE = 'application/pdf';
export const MENU_IMPORT_ACCEPT = [...MENU_IMPORT_IMAGE_TYPES, MENU_IMPORT_PDF_TYPE].join(',');
export const MENU_IMPORT_IMAGE_ACCEPT = MENU_IMPORT_IMAGE_TYPES.join(',');

/**
 * `accept` für die Dateiauswahl: PDF nur, wenn der Anbieter auf dem Server
 * sie liest (`pdfSupported` im Assistent-Status).
 */
export function menuImportAccept(pdfSupported: boolean): string {
  return pdfSupported ? MENU_IMPORT_ACCEPT : MENU_IMPORT_IMAGE_ACCEPT;
}

export type MenuFileProblem =
  | 'empty'
  | 'type'
  | 'tooMany'
  | 'tooLarge'
  | 'pdfAlone'
  | 'pdfUnsupported';

export type MenuFilesCheck =
  | { ok: true; kind: 'images' | 'pdf' }
  | { ok: false; problem: MenuFileProblem; params: { max: number; maxMb: number; name?: string } };

interface FileLike {
  name: string;
  type: string;
  size: number;
}

function mediaTypeOf(file: FileLike): string {
  if (file.type) return file.type.toLowerCase();
  // Manche Browser lassen den Typ leer (z. B. Drag & Drop aus Mail-Programmen).
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'pdf') return MENU_IMPORT_PDF_TYPE;
  return '';
}

/**
 * Prüft eine Auswahl vor dem Hochladen: 1–6 Bilder (JPG, PNG, WebP) oder
 * genau eine PDF, jede Datei höchstens `maxMb` MB. Liest der Anbieter keine
 * PDF (`pdfSupported: false`), wird sie mit `pdfUnsupported` abgewiesen —
 * dieselbe Antwort, die die API als `MENU_IMPORT_PDF_UNSUPPORTED` gäbe.
 */
export function checkMenuFiles(
  files: readonly FileLike[],
  limits: { max?: number; maxMb?: number; pdfSupported?: boolean } = {}
): MenuFilesCheck {
  const max = limits.max ?? MENU_IMPORT_MAX_FILES;
  const maxMb = limits.maxMb ?? MENU_IMPORT_MAX_MB;
  const pdfSupported = limits.pdfSupported ?? true;
  const params = { max, maxMb };
  if (files.length === 0) return { ok: false, problem: 'empty', params };

  const types = files.map(mediaTypeOf);
  const bad = types.findIndex(
    (type) =>
      type !== MENU_IMPORT_PDF_TYPE &&
      !(MENU_IMPORT_IMAGE_TYPES as readonly string[]).includes(type)
  );
  if (bad >= 0) return { ok: false, problem: 'type', params: { ...params, name: files[bad].name } };

  const big = files.findIndex((file) => file.size > maxMb * 1024 * 1024);
  if (big >= 0)
    return { ok: false, problem: 'tooLarge', params: { ...params, name: files[big].name } };

  const pdf = types.findIndex((type) => type === MENU_IMPORT_PDF_TYPE);
  if (pdf >= 0) {
    if (!pdfSupported)
      return { ok: false, problem: 'pdfUnsupported', params: { ...params, name: files[pdf].name } };
    if (files.length > 1) return { ok: false, problem: 'pdfAlone', params };
    return { ok: true, kind: 'pdf' };
  }
  if (files.length > max) return { ok: false, problem: 'tooMany', params };
  return { ok: true, kind: 'images' };
}

/** „4,50“ oder „4.5“ → 4.5; leer oder unlesbar → null. */
export function parsePrice(input: string | number): number | null {
  if (typeof input === 'number')
    return Number.isFinite(input) ? Math.round(input * 100) / 100 : null;
  const text = input.trim().replace(/\s|€/g, '').replace(',', '.');
  if (!text || !/^-?\d*(?:\.\d*)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

/** Preis für ein Eingabefeld: immer zwei Nachkommastellen, Punkt als Trenner. */
export function formatPriceInput(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

export interface PreviewCategory {
  key: string;
  name: string;
  existingCategoryId?: string;
}

export interface PreviewVariant {
  name: string;
  /** Eingabetext; wird beim Anwenden geparst. */
  priceModifier: string;
}

export interface PreviewRow {
  key: string;
  selected: boolean;
  name: string;
  description: string;
  categoryKey: string;
  /** Eingabetext; wird beim Anwenden geparst. */
  price: string;
  taxRate: MenuTaxRate;
  /** Pfand-Typ der Organisation; leer = kein Pfand. */
  pfandTypeId: string;
  pfandSuggested: boolean;
  pfandAmount?: number;
  variants: PreviewVariant[];
  icon: string | null;
  iconSuggestions: IconSuggestion[];
  existingProductId?: string;
  /** Bei vorhandenem Produkt: aktualisieren oder trotzdem neu anlegen. */
  action: 'create' | 'update';
  confidence: MenuConfidence;
  note?: string;
}

export interface PreviewState {
  categories: PreviewCategory[];
  rows: PreviewRow[];
}

export interface PfandTypeLike {
  id: string;
  name: string;
  amount: number;
  isActive?: boolean;
}

export interface CategoryLike {
  id: string;
  name: string;
}

/**
 * Welcher Pfand-Typ der Organisation zu einem erkannten Pfand passt: gleicher
 * Betrag, sonst der einzige aktive Typ, sonst keiner (der Verein wählt).
 */
export function matchPfandType(
  pfand: { suggested: boolean; amount?: number } | undefined,
  pfandTypes: readonly PfandTypeLike[]
): string {
  if (!pfand?.suggested) return '';
  const active = pfandTypes.filter((type) => type.isActive !== false);
  if (pfand.amount !== undefined) {
    const same = active.find((type) => Math.abs(type.amount - pfand.amount!) < 0.005);
    if (same) return same.id;
  }
  return active.length === 1 ? active[0].id : '';
}

/** Ab diesem Score gilt ein Modell-Treffer als sicher genug für die Vorbelegung. */
export const MODEL_ICON_MIN_SCORE = 0.75;

/**
 * Icon für die Vorbelegung einer Zeile: der beste Vorschlag, wenn er aus dem
 * lexikalischen Index stammt (ohne `source` = lexikalisch, ältere API) oder
 * das Modell ihn mit mindestens 0,75 bewertet. Sonst keins — ein unsicherer
 * Modell-Treffer soll nicht ungeprüft am Produkt landen; angeboten wird er
 * in der Tabelle trotzdem.
 */
export function preselectIcon(suggestions: readonly IconSuggestion[] | undefined): string | null {
  const best = suggestions?.[0];
  if (!best) return null;
  if (best.source === 'model' && best.score < MODEL_ICON_MIN_SCORE) return null;
  return best.icon;
}

/**
 * Zustand der Vorschau-Tabelle aus dem Vorschlag der API: alle Zeilen
 * angehakt, Preise als Text, Icon vorbelegt mit dem besten Vorschlag, Pfand
 * mit dem passenden Typ, vorhandene Produkte auf „aktualisieren“.
 *
 * Kategorien der Veranstaltung, die der Vorschlag nicht nennt, kommen als
 * weitere Auswahl dazu (`e<n>`, mit `existingCategoryId`), damit sich ein
 * Produkt auch dorthin schieben lässt.
 */
export function buildPreview(
  suggestion: MenuSuggestion,
  options: {
    pfandTypes?: readonly PfandTypeLike[];
    existingCategories?: readonly CategoryLike[];
  } = {}
): PreviewState {
  const pfandTypes = options.pfandTypes ?? [];
  const categories: PreviewCategory[] = suggestion.categories.map((category) => ({
    key: category.key,
    name: category.name,
    ...(category.existingCategoryId ? { existingCategoryId: category.existingCategoryId } : {}),
  }));
  const mapped = new Set(categories.map((category) => category.existingCategoryId).filter(Boolean));
  const used = new Set(categories.map((category) => category.key));
  let extra = 0;
  for (const category of options.existingCategories ?? []) {
    if (mapped.has(category.id)) continue;
    let key = `e${++extra}`;
    while (used.has(key)) key = `e${++extra}`;
    used.add(key);
    categories.push({ key, name: category.name, existingCategoryId: category.id });
  }

  const fallbackKey = categories[0]?.key ?? '';
  const rows: PreviewRow[] = suggestion.products.map((product) => ({
    key: product.key,
    selected: true,
    name: product.name,
    description: product.description ?? '',
    categoryKey: used.has(product.categoryKey) ? product.categoryKey : fallbackKey,
    price: formatPriceInput(product.price),
    taxRate: product.taxRate,
    pfandTypeId: matchPfandType(product.pfand, pfandTypes),
    pfandSuggested: product.pfand?.suggested === true,
    ...(product.pfand?.amount !== undefined ? { pfandAmount: product.pfand.amount } : {}),
    variants: (product.variants ?? []).map((variant) => ({
      name: variant.name,
      priceModifier: formatPriceInput(variant.priceModifier),
    })),
    icon: preselectIcon(product.iconSuggestions),
    iconSuggestions: product.iconSuggestions ?? [],
    ...(product.existingProductId ? { existingProductId: product.existingProductId } : {}),
    action: product.existingProductId ? 'update' : 'create',
    confidence: product.confidence,
    ...(product.note ? { note: product.note } : {}),
  }));

  return { categories, rows };
}

export type RowProblem = 'name' | 'price' | 'category' | 'variant';

export interface ApplyBuild {
  data: ApplyMenuImportData;
  /** Angehakte Zeilen, die so nicht gesendet werden können (Schlüssel → Fehler). */
  problems: Record<string, RowProblem>;
  counts: { create: number; update: number };
}

/**
 * Körper für `POST …/apply` aus der Tabelle: nur angehakte Zeilen, nur die
 * Kategorien, die diese Zeilen benutzen (Reihenfolge wie im Vorschlag).
 * Unvollständige Zeilen (ohne Namen, mit unlesbarem Preis) landen in
 * `problems` statt im Körper.
 */
export function buildApplyPayload(state: PreviewState): ApplyBuild {
  const problems: Record<string, RowProblem> = {};
  const products: ApplyMenuImportProduct[] = [];
  const categoryKeys = new Set<string>();
  const known = new Set(state.categories.map((category) => category.key));
  let create = 0;
  let update = 0;

  for (const row of state.rows) {
    if (!row.selected) continue;
    const name = row.name.trim();
    const price = parsePrice(row.price);
    if (!name) {
      problems[row.key] = 'name';
      continue;
    }
    if (price === null || price < 0) {
      problems[row.key] = 'price';
      continue;
    }
    if (!known.has(row.categoryKey)) {
      problems[row.key] = 'category';
      continue;
    }
    const variants: MenuSuggestionVariant[] = [];
    let variantProblem = false;
    for (const variant of row.variants) {
      const variantName = variant.name.trim();
      const modifier = parsePrice(variant.priceModifier);
      if (!variantName || modifier === null) {
        variantProblem = true;
        break;
      }
      variants.push({ name: variantName, priceModifier: modifier });
    }
    if (variantProblem) {
      problems[row.key] = 'variant';
      continue;
    }

    const isUpdate = row.action === 'update' && !!row.existingProductId;
    const description = row.description.trim();
    products.push({
      key: row.key,
      categoryKey: row.categoryKey,
      name,
      ...(description ? { description } : {}),
      price,
      taxRate: row.taxRate,
      ...(row.icon ? { icon: row.icon } : {}),
      ...(row.pfandTypeId ? { pfandTypeId: row.pfandTypeId } : {}),
      ...(variants.length > 0 ? { variants } : {}),
      action: isUpdate ? 'update' : 'create',
      ...(isUpdate ? { existingProductId: row.existingProductId } : {}),
    });
    categoryKeys.add(row.categoryKey);
    if (isUpdate) update += 1;
    else create += 1;
  }

  const categories = state.categories
    .filter((category) => categoryKeys.has(category.key))
    .map((category) => ({
      key: category.key,
      name: category.name.trim(),
      ...(category.existingCategoryId ? { existingCategoryId: category.existingCategoryId } : {}),
    }));

  return { data: { categories, products }, problems, counts: { create, update } };
}

/** Läuft der Import noch? Dann pollt der Dialog weiter. */
export function menuImportPending(status: string | undefined): boolean {
  return status === 'queued' || status === 'processing';
}

/** Vorschlag ohne Produkte — die API meldet das als `done`, nicht als Fehler. */
export const EMPTY_MENU_SUGGESTION: MenuSuggestion = { categories: [], products: [], warnings: [] };
