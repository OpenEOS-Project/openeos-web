'use client';

import { Icon, type IconName } from '@openeos/ui';
import { resolveUploadUrl } from '@/utils/upload-url';
import { resolveCategoryIcon, resolveProductIcon, type IconSource } from '@/utils/product-icon';
import type { Category } from '@/types/category';
import type { Product } from '@/types/product';

/** Produkt mit den Feldern, die mit der API-Erweiterung „Tische“ kommen. */
export type PosProduct = Product & { icon?: string | null; isFavorite?: boolean };

/** Name eines Linien-Icons für Stellen, die nur Icons kennen (Blattkopf). */
export function iconNameOf(source: IconSource): IconName {
  return source.kind === 'icon' ? source.name : 'utensils';
}

/**
 * Inhalt einer Icon-Box: Linien-Icon oder Foto. PNGs aus
 * @openeos/pos-icons ohne Gegenstück zeigt die Kasse als `utensils`
 * (das PNG bleibt der Verwaltung vorbehalten).
 */
export function IconVisual({ source }: { source: IconSource }) {
  if (source.kind === 'photo') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={resolveUploadUrl(source.url)} alt="" loading="lazy" />;
  }
  return <Icon name={source.kind === 'icon' ? source.name : 'utensils'} />;
}

export function productIconSource(product: PosProduct, category?: Category | null): IconSource {
  return resolveProductIcon(product, category ?? product.category);
}

export function categoryIconSource(category: Category | null | undefined): IconSource {
  return resolveCategoryIcon(category);
}
