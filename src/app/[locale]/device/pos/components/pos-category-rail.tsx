'use client';

import { useTranslations } from 'next-intl';
import { CategoryButton, CategoryNav, Icon } from '@openeos/ui';
import type { Category } from '@/types/category';
import { categoryIconSource, IconVisual } from './product-visual';

export const FAVORITES_ID = 'fav';

interface PosCategoryRailProps {
  categories: Category[];
  /** Anzahl sichtbarer Produkte je Kategorie-ID (inkl. `fav`). */
  counts: Record<string, number>;
  showFavorites: boolean;
  /** `null` während der Suche: keine Kategorie hervorgehoben. */
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Kategorienleiste: breit 208 px mit Anzahl, mittel schmale Spalte,
 * kompakt waagerechte Chip-Leiste (`CategoryNav responsive`).
 */
export function PosCategoryRail({
  categories,
  counts,
  showFavorites,
  selectedId,
  onSelect,
}: PosCategoryRailProps) {
  const t = useTranslations('pos.order');

  return (
    <CategoryNav responsive className="pos-order__rail" aria-label={t('categories')}>
      {showFavorites && (
        <CategoryButton
          icon={<Icon name="star" />}
          label={t('favorites')}
          count={counts[FAVORITES_ID] ?? 0}
          active={selectedId === FAVORITES_ID}
          onClick={() => onSelect(FAVORITES_ID)}
        />
      )}
      {categories.map((category) => (
        <CategoryButton
          key={category.id}
          icon={<IconVisual source={categoryIconSource(category)} />}
          label={category.name}
          count={counts[category.id] ?? 0}
          active={selectedId === category.id}
          onClick={() => onSelect(category.id)}
        />
      ))}
    </CategoryNav>
  );
}
