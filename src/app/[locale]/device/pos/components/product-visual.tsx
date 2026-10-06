'use client';

import type { CSSProperties } from 'react';
import { Icon, type IconName } from '@openeos/ui';
import { PosIconImage } from '@/components/shared/pos-icon-image';
import { resolveUploadUrl } from '@/utils/upload-url';
import {
  categoryIconName,
  resolveCategoryIcon,
  resolveProductIcon,
  type IconSource,
} from '@/utils/product-icon';
import type { Category } from '@/types/category';
import type { Product } from '@/types/product';

/** Produkt mit den Feldern, die mit der API-Erweiterung „Tische“ kommen. */
export type PosProduct = Product & { icon?: string | null; isFavorite?: boolean };

/**
 * Linien-Icon für Stellen, die nur Linien-Icons kennen (Blattkopf): bei
 * Produktbildern und Fotos das Icon der Kategorie.
 */
export function sheetIconOf(product: PosProduct, category?: Category | null): IconName {
  const source = productIconSource(product, category);
  return source.kind === 'icon' ? source.name : categoryIconName(category ?? product.category);
}

/**
 * Inhalt einer Icon-Box: Produktbild (POS-Icon), Foto oder Linien-Icon.
 * Bilder sind dekorativ — der Produktname steht daneben.
 */
export function IconVisual({ source }: { source: IconSource }) {
  if (source.kind === 'photo') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={resolveUploadUrl(source.url)} alt="" loading="lazy" />;
  }
  if (source.kind === 'pos-icon') return <PosIconImage id={source.id} />;
  return <Icon name={source.name} />;
}

export function productIconSource(product: PosProduct, category?: Category | null): IconSource {
  return resolveProductIcon(product, category ?? product.category);
}

export function categoryIconSource(category: Category | null | undefined): IconSource {
  return resolveCategoryIcon(category);
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Kategoriefarbe für die getönte Icon-Box (Kategorieleiste, Produkte ohne
 * eigenes Bild): Klasse + CSS-Variable `--pos-cat`. Ohne gültige Farbe
 * bleibt es beim Standard.
 */
export function categoryTint(
  category: Pick<Category, 'color'> | null | undefined,
  className: string,
): { className?: string; style?: CSSProperties } {
  const color = category?.color?.trim();
  if (!color || !HEX_COLOR.test(color)) return {};
  return { className, style: { '--pos-cat': color } as CSSProperties };
}
