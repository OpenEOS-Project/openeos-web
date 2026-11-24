import { addDays, daysBetween } from '@/utils/calendar-date';
import type { Category } from '@/types/category';
import type { Event } from '@/types/event';
import type { Product } from '@/types/product';

/** Veranstaltungen, jüngster Beginn zuerst (ohne Beginn am Ende). */
export function eventsByStart<T extends Pick<Event, 'id' | 'startDate'>>(events: T[]): T[] {
  const time = (event: T) => (event.startDate ? new Date(event.startDate).getTime() : Number.NEGATIVE_INFINITY);
  return [...events].sort((a, b) => {
    const diff = time(b) - time(a);
    return Number.isNaN(diff) ? 0 : diff;
  });
}

/** „Sommerfest 2026“ → „Sommerfest 2027“; ohne Jahr mit Zusatz. */
export function suggestCopyName(name: string, suffix: string): string {
  const matches = [...name.matchAll(/\b20\d{2}\b/g)];
  const last = matches.at(-1);
  if (!last) return `${name} (${suffix})`;
  return name.slice(0, last.index) + String(Number(last[0]) + 1) + name.slice(last.index + 4);
}

/** Ende der Kopie: so viele Tage nach dem Beginn wie bei der Vorlage. */
export function suggestCopyEnd(sourceStart: string, sourceEnd: string, nextStart: string): string {
  if (!sourceStart || !nextStart) return nextStart;
  return addDays(nextStart, Math.max(0, daysBetween(sourceStart, sourceEnd || sourceStart) ?? 0));
}

export interface CopyTreeNode {
  category: Category;
  depth: number;
  products: Product[];
}

/** Kategorien mit ihren Produkten, Unterkategorien direkt unter der Oberkategorie. */
export function buildCopyTree(categories: Category[], products: Product[]): CopyTreeNode[] {
  const known = new Set(categories.map((c) => c.id));
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'de'));
  const nodes: CopyTreeNode[] = [];
  const add = (category: Category, depth: number) => {
    nodes.push({
      category,
      depth,
      products: products
        .filter((p) => p.categoryId === category.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'de')),
    });
    sorted.filter((c) => c.parentId === category.id).forEach((child) => add(child, depth + 1));
  };
  sorted.filter((c) => !c.parentId || !known.has(c.parentId)).forEach((c) => add(c, 0));
  return nodes;
}
