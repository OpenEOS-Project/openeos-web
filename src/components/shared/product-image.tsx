'use client';

import { IconBox } from '@openeos/ui';

import { PosIconImage } from '@/components/shared/pos-icon-image';
import { resolveUploadUrl } from '@/utils/upload-url';
import {
  resolveProductIcon,
  type IconCategoryLike,
  type IconProductLike,
  type IconSource,
} from '@/utils/product-icon';

const BOX = { sm: 'sm', md: 'md', lg: 'lg' } as const;

interface IconVisualProps {
  source: IconSource;
  /** Alternativtext für Bilder; Linien-Icons sind dekorativ. */
  alt: string;
  size?: keyof typeof BOX;
  className?: string;
}

/**
 * Zeigt eine aufgelöste Bildquelle (siehe utils/product-icon.ts) in der
 * Icon-Box des Designsystems: POS-Icon (Produktbild), Foto oder
 * Linien-Icon (Kategorie, Rückfall).
 */
export function IconVisual({ source, alt, size = 'md', className }: IconVisualProps) {
  if (source.kind === 'photo') {
    return (
      <IconBox size={BOX[size]} className={className}>
        {/* Hochgeladene Bilder liegen auf der API, nicht im Next-Build. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resolveUploadUrl(source.url)} alt={alt} />
      </IconBox>
    );
  }
  if (source.kind === 'pos-icon') {
    return (
      <IconBox size={BOX[size]} className={className}>
        <PosIconImage id={source.id} alt={alt} />
      </IconBox>
    );
  }
  return <IconBox icon={source.name} tone="accent" size={BOX[size]} className={className} />;
}

interface ProductImageProps {
  product: IconProductLike;
  /** Kategorie, falls sie nicht am Produkt hängt. */
  category?: IconCategoryLike | null;
  productName: string;
  size?: keyof typeof BOX;
  className?: string;
}

/** Bild eines Produkts: POS-Icon → Foto → Icon der Kategorie → `utensils`. */
export function ProductImage({ product, category, productName, size = 'md', className }: ProductImageProps) {
  return (
    <IconVisual source={resolveProductIcon(product, category)} alt={productName} size={size} className={className} />
  );
}
