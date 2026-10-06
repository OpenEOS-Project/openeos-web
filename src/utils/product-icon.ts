import {
  isIconName,
  LEGACY_FALLBACK_ICON,
  legacyIcon,
  type IconName,
} from '@openeos/ui/icons';

/**
 * Welches Bild ein Produkt bzw. eine Kategorie zeigt — gemeinsam für
 * Verwaltung und Kasse.
 *
 * Gespeicherte Werte:
 * - `oe:<name>`      Icon aus dem OpenEOS-Set (neu, `product.icon` / `category.icon`)
 * - `pos-icon:<id>`  PNG aus @openeos/pos-icons (Altbestand) — wird, wo möglich,
 *                    auf ein OpenEOS-Icon abgebildet
 * - URL/Pfad         hochgeladenes Foto (`/uploads/…`, http(s), data:)
 * - Emoji            Altbestand in `category.icon` — über die Mapping-Tabelle
 *
 * Reihenfolge für Produkte: `product.icon` → `product.imageUrl` →
 * `category.icon` → `utensils`.
 */

export type IconSource =
  | { kind: 'icon'; name: IconName }
  /** PNG aus @openeos/pos-icons, für das es kein OpenEOS-Icon gibt. */
  | { kind: 'pos-icon'; id: string }
  /** Foto; vor dem Anzeigen mit `resolveUploadUrl` auflösen. */
  | { kind: 'photo'; url: string };

export const OE_ICON_PREFIX = 'oe:';
export const POS_ICON_PREFIX = 'pos-icon:';

/** Speicherwert für ein OpenEOS-Icon, z. B. `oe:beer`. */
export function toIconValue(name: IconName): string {
  return `${OE_ICON_PREFIX}${name}`;
}

/** Name aus einem `oe:`-Wert, sonst `null`. */
export function parseOeIcon(value: string | null | undefined): IconName | null {
  if (!value?.startsWith(OE_ICON_PREFIX)) return null;
  const name = value.slice(OE_ICON_PREFIX.length);
  return isIconName(name) ? name : null;
}

const PHOTO = /^(https?:|data:|blob:|\/)/i;

/** Liest einen gespeicherten Wert; `null`, wenn er nichts Darstellbares enthält. */
export function parseIconValue(value: string | null | undefined): IconSource | null {
  const raw = value?.trim();
  if (!raw) return null;

  if (raw.startsWith(OE_ICON_PREFIX)) {
    const name = parseOeIcon(raw);
    return name ? { kind: 'icon', name } : null;
  }

  if (raw.startsWith(POS_ICON_PREFIX)) {
    const mapped = legacyIcon(raw);
    if (mapped) return { kind: 'icon', name: mapped };
    const id = raw.slice(POS_ICON_PREFIX.length);
    return id ? { kind: 'pos-icon', id } : null;
  }

  if (PHOTO.test(raw)) return { kind: 'photo', url: raw };

  // Emoji oder anderer Kurztext aus Altdaten
  const mapped = legacyIcon(raw);
  return mapped ? { kind: 'icon', name: mapped } : null;
}

const FALLBACK: IconSource = { kind: 'icon', name: LEGACY_FALLBACK_ICON };

export interface IconCategoryLike {
  icon?: string | null;
}

export interface IconProductLike {
  /** `oe:<name>` — kommt mit der API-Erweiterung „Tische“ (Produkt-Icon). */
  icon?: string | null;
  imageUrl?: string | null;
  category?: IconCategoryLike | null;
}

/**
 * Bild eines Produkts: eigenes Icon, sonst Bild/Foto, sonst Icon der
 * Kategorie, sonst `utensils`. `category` überschreibt `product.category`
 * (z. B. wenn die Kategorie getrennt geladen wurde).
 */
export function resolveProductIcon(
  product: IconProductLike,
  category?: IconCategoryLike | null,
): IconSource {
  return (
    parseIconValue(product.icon) ??
    parseIconValue(product.imageUrl) ??
    parseIconValue((category ?? product.category)?.icon) ??
    FALLBACK
  );
}

/** Bild einer Kategorie: gespeicherter Wert, sonst `utensils`. */
export function resolveCategoryIcon(category: IconCategoryLike | null | undefined): IconSource {
  return parseIconValue(category?.icon) ?? FALLBACK;
}
