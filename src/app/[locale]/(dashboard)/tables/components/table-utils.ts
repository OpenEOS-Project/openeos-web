import { clampToArea, snapToGrid } from '@openeos/ui';

import type { DiningTable, DiningTableShape, TableArea, TableDecor, TableDecorType } from '@/types/table';
import { toTableKey } from '@/types/table';

/** Grenzen wie in der API (Spezifikation §3.3). */
export const LABEL_MAX = 20;
export const SEATS_MAX = 99;
export const TABLE_SIZE_MIN = 20;
export const TABLE_SIZE_MAX = 1000;
export const BULK_MAX = 100;
export const AREA_SIZE_MIN = 400;
export const AREA_SIZE_MAX = 5000;
export const GRID_SIZE_MIN = 5;
export const GRID_SIZE_MAX = 100;
export const DEFAULT_TABLE_SIZE = 80;

/** Bezeichnungen einer Serie wie die API: A + 1..12, 2 Stellen → A01…A12. */
export function bulkLabels(prefix: string, start: number, count: number, padding: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => `${prefix}${String(start + i).padStart(padding, '0')}`);
}

/** Alle belegten Tischschlüssel der Organisation. */
export function takenKeys(areas: TableArea[], exceptId?: string): Set<string> {
  const keys = new Set<string>();
  for (const area of areas) for (const t of area.tables) if (t.id !== exceptId) keys.add(toTableKey(t.label));
  return keys;
}

const NUMBERED = /^(.*?)(\d+)$/;

/**
 * Nächste freie Bezeichnung: setzt die Nummerierung fort (A12 → A13,
 * Stellen bleiben), sonst schlicht 1, 2, 3 … Eindeutig org-weit.
 */
export function nextTableLabel(areas: TableArea[], area: TableArea | undefined, from?: string): string {
  const taken = takenKeys(areas);
  const source =
    from ?? [...(area?.tables ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).at(-1)?.label;
  const match = source ? NUMBERED.exec(source) : null;
  const prefix = match ? match[1] : '';
  const width = match && match[2].startsWith('0') ? match[2].length : 0;

  // Höchste Nummer mit demselben Präfix im Bereich, damit eine Lücke
  // nicht mitten in eine Reihe springt.
  let n = 0;
  for (const t of area?.tables ?? []) {
    const m = NUMBERED.exec(t.label);
    if (m && m[1] === prefix) n = Math.max(n, Number(m[2]));
  }
  if (match) n = Math.max(n, Number(match[2]));

  for (let i = n + 1; i < n + 10_000; i += 1) {
    const label = `${prefix}${String(i).padStart(width, '0')}`;
    if (label.length <= LABEL_MAX && !taken.has(toTableKey(label))) return label;
  }
  return `${Date.now() % 100000}`;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const overlaps = (a: Rect, b: Rect, pad: number) =>
  a.x < b.x + b.width + pad && b.x < a.x + a.width + pad && a.y < b.y + b.height + pad && b.y < a.y + a.height + pad;

/**
 * Erster freier Platz für ein neues Element, zeilenweise von oben links
 * im Raster gesucht; ist nichts frei, die Mitte der Karte.
 */
export function findFreeSpot(area: TableArea, width: number, height: number, avoid: Rect[] = []): { x: number; y: number } {
  const grid = area.gridSize > 0 ? area.gridSize : 20;
  const gap = grid * 2;
  const occupied: Rect[] = [...area.tables, ...area.decor, ...avoid];
  for (let y = gap; y + height <= area.height; y += grid) {
    for (let x = gap; x + width <= area.width; x += grid) {
      const candidate = { x, y, width, height };
      if (!occupied.some((r) => overlaps(candidate, r, grid))) return { x, y };
    }
  }
  return clampRect({ x: area.width / 2 - width / 2, y: area.height / 2 - height / 2, width, height }, area);
}

/** Auf Raster und Fläche bringen (ganze Einheiten, wie die API sie will). */
export function clampRect<T extends Rect>(rect: T, area: Pick<TableArea, 'width' | 'height'>, grid = 0): T {
  const snapped = {
    ...rect,
    x: grid ? snapToGrid(rect.x, grid) : rect.x,
    y: grid ? snapToGrid(rect.y, grid) : rect.y,
  };
  const clamped = clampToArea(snapped, area);
  return {
    ...rect,
    x: Math.round(clamped.x),
    y: Math.round(clamped.y),
    width: Math.round(clamped.width),
    height: Math.round(clamped.height),
  };
}

export const DECOR_SIZES: Record<TableDecorType, { width: number; height: number }> = {
  bar: { width: 320, height: 80 },
  wall: { width: 400, height: 20 },
  stage: { width: 360, height: 200 },
  label: { width: 200, height: 40 },
};

export function newDecorId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function makeDecor(area: TableArea, type: TableDecorType, label?: string): TableDecor {
  const size = DECOR_SIZES[type];
  const width = Math.min(size.width, area.width);
  const height = Math.min(size.height, area.height);
  const spot = findFreeSpot(area, width, height);
  return { id: newDecorId(), type, ...spot, width, height, rotation: 0, ...(label ? { label } : {}) };
}

export function tableDefaults(shape: DiningTableShape): { width: number; height: number } {
  return shape === 'round'
    ? { width: DEFAULT_TABLE_SIZE + 20, height: DEFAULT_TABLE_SIZE + 20 }
    : { width: DEFAULT_TABLE_SIZE, height: DEFAULT_TABLE_SIZE };
}

/** Sortiert wie die API: Bereich, dann Reihenfolge, dann natürlich nach Bezeichnung. */
export function sortTables(tables: DiningTable[]): DiningTable[] {
  return [...tables].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'de', { numeric: true }),
  );
}

/** Ganzzahl aus einem Eingabefeld, sonst `null`. */
export function parseIntOrNull(value: string): number | null {
  const n = Number.parseInt(value.trim(), 10);
  return Number.isFinite(n) ? n : null;
}
