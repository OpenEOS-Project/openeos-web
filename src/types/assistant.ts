/**
 * Assistent-Funktionen (ki-plan.md, Abschnitt 6): Opt-in je Organisation,
 * Tageskontingente, Icon-Vorschläge und der Speisekarten-Import.
 *
 * Die Formen spiegeln `src/modules/assistant/**` in openeos-api.
 */

/** Tageskontingent (Kalendertag Europe/Berlin). */
export interface AssistantQuota {
  limit: number;
  used: number;
  remaining: number;
  /** Beginn des nächsten Tages (ISO). */
  resetAt: string;
}

export interface AssistantStatus {
  /** Opt-in der Organisation (Admin). */
  enabled: boolean;
  /** Auf dem Server ist ein Anbieter eingerichtet (`AI_PROVIDER` + Schlüssel). */
  available: boolean;
  /**
   * Der Anbieter liest PDF-Dateien. Sonst nimmt der Speisekarten-Import nur
   * Fotos; eine PDF weist die API mit `MENU_IMPORT_PDF_UNSUPPORTED` ab.
   */
  pdfSupported: boolean;
  quotas: {
    menuImports: AssistantQuota;
    classifications: AssistantQuota;
  };
}

export interface IconSuggestion {
  /** Vollständige Referenz `pos-icon:<id>`, wie sie am Produkt gespeichert wird. */
  icon: string;
  /** 0–1, höher ist besser. */
  score: number;
}

export interface IconSuggestionResult {
  name: string;
  /** Höchstens drei, beste zuerst. */
  suggestions: IconSuggestion[];
}

export type MenuImportStatus = 'queued' | 'processing' | 'done' | 'failed' | 'applied';
export type MenuImportSource = 'images' | 'pdf' | 'text';
export type MenuTaxRate = 0 | 7 | 19;
export type MenuConfidence = 'high' | 'medium' | 'low';

export interface MenuSuggestionCategory {
  /** Stabiler Kurzschlüssel für den Vorschau-Ablauf (`c1`, `c2`, …). */
  key: string;
  name: string;
  /** Kategorie gleichen Namens gibt es in der Veranstaltung schon. */
  existingCategoryId?: string;
}

export interface MenuSuggestionVariant {
  name: string;
  /** Aufpreis zur Basis in Euro. */
  priceModifier: number;
}

export interface MenuSuggestionProduct {
  key: string;
  categoryKey: string;
  name: string;
  description?: string;
  /** Preis in Euro ohne Pfand. */
  price: number;
  taxRate: MenuTaxRate;
  pfand?: { suggested: boolean; amount?: number };
  variants?: MenuSuggestionVariant[];
  /** Produkt gleichen Namens gibt es in der Veranstaltung schon. */
  existingProductId?: string;
  iconSuggestions?: IconSuggestion[];
  confidence: MenuConfidence;
  note?: string;
}

export interface MenuSuggestion {
  categories: MenuSuggestionCategory[];
  products: MenuSuggestionProduct[];
  warnings: string[];
}

export interface MenuImportUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface MenuImport {
  id: string;
  status: MenuImportStatus;
  source: MenuImportSource;
  /** Bei `failed`: Text für die Anzeige, so wie die API ihn formuliert. */
  error?: string;
  createdAt: string;
  finishedAt?: string;
  appliedAt?: string;
  /**
   * Nur bei `done` (und in der Liste nie). Eine Karte ohne erkennbare
   * Produkte endet ebenfalls als `done` — mit leerem `products` und einem
   * Hinweis in `warnings`.
   */
  suggestion?: MenuSuggestion;
  usage?: MenuImportUsage;
}

export interface CreateMenuImportInput {
  /** 1–6 Bilder (JPG, PNG, WebP) oder genau eine PDF (nur bei `pdfSupported`). */
  files?: File[];
  /** Alternativ: die Speisekarte als Text (max. 20.000 Zeichen). */
  text?: string;
}

export interface ApplyMenuImportCategory {
  key: string;
  name: string;
  existingCategoryId?: string;
}

export type MenuImportAction = 'create' | 'update' | 'skip';

export interface ApplyMenuImportProduct {
  key: string;
  categoryKey: string;
  name: string;
  description?: string;
  price: number;
  taxRate: MenuTaxRate;
  icon?: string;
  pfandTypeId?: string;
  variants?: MenuSuggestionVariant[];
  action: MenuImportAction;
  existingProductId?: string;
}

export interface ApplyMenuImportData {
  categories: ApplyMenuImportCategory[];
  products: ApplyMenuImportProduct[];
}

export interface ApplyMenuImportResult {
  createdCategories: number;
  createdProducts: number;
  updatedProducts: number;
}
