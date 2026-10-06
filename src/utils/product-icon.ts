import { isIconName, LEGACY_FALLBACK_ICON, legacyIcon, type IconName } from '@openeos/ui/icons';

/**
 * Welches Bild ein Produkt bzw. eine Kategorie zeigt — gemeinsam für
 * Verwaltung und Kasse.
 *
 * Regel: **Produkte** zeigen ein Produktbild — ein POS-Icon aus
 * @openeos/pos-icons oder ein hochgeladenes Foto. **Kategorien** zeigen ein
 * Linien-Icon aus @openeos/ui (Lucide). Hat ein Produkt kein Bild, steht
 * das Icon seiner Kategorie da, sonst `utensils`.
 *
 * Gespeicherte Werte:
 * - `pos-icon:<id>`  POS-Icon (Produkt: `product.icon`, Altbestand auch in
 *                    `product.imageUrl`); Datei unter /pos-icons/<id>.png,
 *                    bereitgestellt von scripts/sync-pos-icons.mjs
 * - URL/Pfad         hochgeladenes Foto (`/uploads/…`, http(s), data:)
 * - `oe:<name>`      Linien-Icon (Kategorie). An Produkten Altbestand aus
 *                    0.4 — wird auf ein passendes POS-Icon abgebildet
 *                    (`OE_TO_POS_ICON`), sonst greift die Kategorie.
 * - Emoji            Altbestand in `category.icon` — über `legacyIcon`
 *
 * Reihenfolge für Produkte: `product.icon` → `product.imageUrl` →
 * `category.icon` → `utensils`.
 */

export type IconSource =
  /** Linien-Icon (Kategorie oder Rückfall). */
  | { kind: 'icon'; name: IconName }
  /** Produktbild aus @openeos/pos-icons. */
  | { kind: 'pos-icon'; id: string }
  /** Foto; vor dem Anzeigen mit `resolveUploadUrl` auflösen. */
  | { kind: 'photo'; url: string };

export const OE_ICON_PREFIX = 'oe:';
export const POS_ICON_PREFIX = 'pos-icon:';

/** Rückfall, wenn weder Produkt noch Kategorie etwas Darstellbares haben. */
export const FALLBACK_ICON: IconName = LEGACY_FALLBACK_ICON;

/**
 * Produkt-Icons aus der Zeit, als Produkte Linien-Icons trugen (`oe:<name>`),
 * auf das passende POS-Icon. Was fehlt (z. B. `coffee`, `cake` — dafür gibt
 * es kein POS-Icon), zeigt das Icon der Kategorie.
 */
export const OE_TO_POS_ICON: Readonly<Partial<Record<IconName, string>>> = {
  beer: 'pils',
  wine: 'wein',
  soda: 'cola',
  water: 'wasser',
  bottle: 'apfelschorle',
  sausage: 'grillwurst-brot',
  fries: 'pommes',
  flame: 'steak',
};

const POS_ICON_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Speicherwert für ein Linien-Icon, z. B. `oe:beer` (Kategorien). */
export function toIconValue(name: IconName): string {
  return `${OE_ICON_PREFIX}${name}`;
}

/** Speicherwert für ein POS-Icon, z. B. `pos-icon:pils` (Produkte). */
export function toPosIconValue(id: string): string {
  return `${POS_ICON_PREFIX}${id}`;
}

/** Statische Datei eines POS-Icons (siehe scripts/sync-pos-icons.mjs). */
export function posIconUrl(id: string): string {
  return `/pos-icons/${id}.png`;
}

/** Name aus einem `oe:`-Wert, sonst `null`. */
export function parseOeIcon(value: string | null | undefined): IconName | null {
  if (!value?.startsWith(OE_ICON_PREFIX)) return null;
  const name = value.slice(OE_ICON_PREFIX.length);
  return isIconName(name) ? name : null;
}

/** ID aus einem `pos-icon:`-Wert, sonst `null`. */
export function parsePosIcon(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw?.startsWith(POS_ICON_PREFIX)) return null;
  const id = raw.slice(POS_ICON_PREFIX.length).toLowerCase();
  return POS_ICON_ID.test(id) ? id : null;
}

const PHOTO = /^(https?:|data:|blob:|\/)/i;

/** Bild eines Produkts aus einem gespeicherten Wert; `null`, wenn keins. */
export function parseProductValue(value: string | null | undefined): IconSource | null {
  const raw = value?.trim();
  if (!raw) return null;

  const posId = parsePosIcon(raw);
  if (posId) return { kind: 'pos-icon', id: posId };
  if (raw.startsWith(POS_ICON_PREFIX)) return null;

  if (raw.startsWith(OE_ICON_PREFIX)) {
    const name = parseOeIcon(raw);
    const mapped = name ? OE_TO_POS_ICON[name] : undefined;
    return mapped ? { kind: 'pos-icon', id: mapped } : null;
  }

  if (PHOTO.test(raw)) return { kind: 'photo', url: raw };
  return null;
}

/** Bild einer Kategorie aus einem gespeicherten Wert; `null`, wenn keins. */
export function parseCategoryValue(value: string | null | undefined): IconSource | null {
  const raw = value?.trim();
  if (!raw) return null;

  if (raw.startsWith(OE_ICON_PREFIX)) {
    const name = parseOeIcon(raw);
    return name ? { kind: 'icon', name } : null;
  }

  // Altbestand: Kategorien mit POS-Icon zeigen weiter das Bild.
  const posId = parsePosIcon(raw);
  if (posId) return { kind: 'pos-icon', id: posId };
  if (raw.startsWith(POS_ICON_PREFIX)) return null;

  if (PHOTO.test(raw)) return { kind: 'photo', url: raw };

  // Emoji oder anderer Kurztext aus Altdaten
  const mapped = legacyIcon(raw);
  return mapped ? { kind: 'icon', name: mapped } : null;
}

const FALLBACK: IconSource = { kind: 'icon', name: FALLBACK_ICON };

export interface IconCategoryLike {
  icon?: string | null;
}

export interface IconProductLike {
  /** `pos-icon:<id>` (oder Altbestand `oe:<name>`). */
  icon?: string | null;
  imageUrl?: string | null;
  category?: IconCategoryLike | null;
}

/**
 * Bild eines Produkts: POS-Icon, sonst Foto, sonst Icon der Kategorie,
 * sonst `utensils`. `category` überschreibt `product.category` (z. B. wenn
 * die Kategorie getrennt geladen wurde).
 */
export function resolveProductIcon(
  product: IconProductLike,
  category?: IconCategoryLike | null,
): IconSource {
  return (
    parseProductValue(product.icon) ??
    parseProductValue(product.imageUrl) ??
    parseCategoryValue((category ?? product.category)?.icon) ??
    FALLBACK
  );
}

/** Bild einer Kategorie: gespeicherter Wert, sonst `utensils`. */
export function resolveCategoryIcon(category: IconCategoryLike | null | undefined): IconSource {
  return parseCategoryValue(category?.icon) ?? FALLBACK;
}

/** Linien-Icon einer Kategorie für Stellen, die nur Linien-Icons kennen. */
export function categoryIconName(category: IconCategoryLike | null | undefined): IconName {
  const source = resolveCategoryIcon(category);
  return source.kind === 'icon' ? source.name : FALLBACK_ICON;
}
