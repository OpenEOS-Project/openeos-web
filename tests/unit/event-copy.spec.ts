import { expect, test } from '@playwright/test';

import { buildCopyTree, eventsByStart, suggestCopyEnd, suggestCopyName } from '@/lib/event-copy';
import type { Category } from '@/types/category';
import type { Product } from '@/types/product';

test.describe('event copy helpers', () => {
  test('default source: latest start first, without a start last', () => {
    const events = [
      { id: 'a', startDate: '2026-01-01' },
      { id: 'b', startDate: null },
      { id: 'c', startDate: '2026-06-01' },
      { id: 'd', startDate: null },
    ];
    expect(eventsByStart(events as never).map((e: { id: string }) => e.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  test('suggests the next year or a suffix', () => {
    expect(suggestCopyName('Sommerfest 2026', 'Kopie')).toBe('Sommerfest 2027');
    expect(suggestCopyName('Sommerfest', 'Kopie')).toBe('Sommerfest (Kopie)');
  });

  test('keeps the duration of the source', () => {
    expect(suggestCopyEnd('2026-07-10', '2026-07-12', '2027-07-09')).toBe('2027-07-11');
    expect(suggestCopyEnd('', '', '2027-07-09')).toBe('2027-07-09');
  });

  test('tree: subcategories follow their parent, orphans are kept', () => {
    const category = (id: string, parentId: string | null, sortOrder: number) =>
      ({ id, parentId, name: id, sortOrder }) as Category;
    const product = (id: string, categoryId: string) => ({ id, categoryId, name: id, sortOrder: 0 }) as Product;
    const tree = buildCopyTree(
      [category('essen', null, 1), category('bier', 'trinken', 0), category('trinken', null, 0), category('waise', 'weg', 2)],
      [product('pils', 'bier'), product('wurst', 'essen')],
    );
    expect(tree.map((n) => [n.category.id, n.depth, n.products.length])).toEqual([
      ['trinken', 0, 0],
      ['bier', 1, 1],
      ['essen', 0, 1],
      ['waise', 0, 0],
    ]);
  });
});
