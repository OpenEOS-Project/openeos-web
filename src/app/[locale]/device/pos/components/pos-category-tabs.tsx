'use client';

import { Tabs, TabList, Tab } from '@/components/ui/tabs/tabs';
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
  const activeCategories = categories
    .filter((c) => c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const selected = selectedCategoryId ?? activeCategories[0]?.id;

  return (
    <Tabs
      selectedKey={selected}
      onSelectionChange={(key) => onSelectCategory(key as string)}
      className="border-b border-secondary bg-primary"
    >
      <TabList type="button-gray" size="sm" className="overflow-x-auto px-4 py-2">
        {activeCategories.map((category) => (
          <Tab key={category.id} id={category.id}>
            {category.name}
          </Tab>
        ))}
      </TabList>
    </Tabs>
  );
}
