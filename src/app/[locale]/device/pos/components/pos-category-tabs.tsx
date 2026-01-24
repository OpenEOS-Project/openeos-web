'use client';

import { cx } from '@/utils/cx';
import type { Category } from '@/types/category';

interface PosCategoryTabsProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export function PosCategoryTabs({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: PosCategoryTabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-secondary bg-primary px-4 py-3">
      <button
        type="button"
        onClick={() => onSelectCategory(null)}
        className={cx(
          'shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
          selectedCategoryId === null
            ? 'bg-brand-primary text-white'
            : 'bg-secondary text-secondary hover:bg-tertiary'
        )}
      >
        Alle
      </button>
      {categories
        .filter((c) => c.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelectCategory(category.id)}
            className={cx(
              'shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              selectedCategoryId === category.id
                ? 'text-white'
                : 'bg-secondary text-secondary hover:bg-tertiary'
            )}
            style={{
              backgroundColor:
                selectedCategoryId === category.id
                  ? category.color || undefined
                  : undefined,
            }}
          >
            {category.name}
          </button>
        ))}
    </div>
  );
}
