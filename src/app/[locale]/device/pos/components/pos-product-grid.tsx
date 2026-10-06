'use client';

import { useTranslations } from 'next-intl';
import { Badge, Icon, Tile } from '@openeos/ui';
import { useFormatPrice } from '@/hooks/use-format-price';
import type { Category } from '@/types/category';
import { categoryTint, IconVisual, productIconSource, type PosProduct } from './product-visual';

interface PosProductGridProps {
  products: PosProduct[];
  categories: Category[];
  /** Menge je Produkt-ID im Warenkorb (ungesendete Zeilen). */
  quantities: Record<string, number>;
  /** Wird in diesem Kontext Pfand berechnet? (Hinweis-Icon) */
  chargePfand: boolean;
  onSelect: (product: PosProduct) => void;
}

/** Erste Zeile der Beschreibung als zweite Kachelzeile („0,5 l“). */
function subline(description: string | null | undefined): string | undefined {
  const first = description?.split(/\r?\n/)[0]?.trim();
  return first || undefined;
}

export function PosProductGrid({
  products,
  categories,
  quantities,
  chargePfand,
  onSelect,
}: PosProductGridProps) {
  const t = useTranslations('pos.order');
  const formatPrice = useFormatPrice();
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="pos-grid">
      {products.map((product) => {
        const soldOut = product.trackInventory && product.stockQuantity <= 0;
        const unavailable = !product.isAvailable;
        const lowStock =
          !unavailable && !soldOut && product.trackInventory && product.stockQuantity <= 5;
        const hasOptions = (product.options?.groups?.length ?? 0) > 0;
        const hasDeposit = chargePfand && !!product.pfandType;
        const qty = quantities[product.id] ?? 0;
        const sub = subline(product.description);
        const category = product.categoryId ? categoryById.get(product.categoryId) : null;
        const source = productIconSource(product, category);
        // Ohne eigenes Bild steht das Kategorie-Icon da — in der Kategoriefarbe.
        const tint = source.kind === 'icon' ? categoryTint(category ?? product.category, 'pos-tile-tint') : {};

        const flag = unavailable ? (
          <Badge tone="danger">{t('unavailable')}</Badge>
        ) : soldOut ? (
          <Badge tone="danger">{t('soldOut')}</Badge>
        ) : lowStock ? (
          <Badge tone="warn">{t('stockLeft', { count: product.stockQuantity })}</Badge>
        ) : undefined;

        return (
          <Tile
            key={product.id}
            variant="product"
            name={product.name}
            sub={sub}
            price={formatPrice(product.price)}
            {...tint}
            icon={<IconVisual source={source} />}
            qty={qty}
            inCart={qty > 0}
            disabled={unavailable || soldOut}
            flag={flag}
            hints={
              hasOptions || hasDeposit ? (
                <>
                  {hasOptions && <Icon name="sliders" label={t('hintOptions')} />}
                  {hasDeposit && <Icon name="deposit" label={t('hintDeposit')} />}
                </>
              ) : undefined
            }
            onClick={() => onSelect(product)}
          />
        );
      })}
    </div>
  );
}
