import type { DashboardWidgetSize } from '@/types/settings';
import type { WidgetDefinition } from './widget-registry';

/**
 * Größen der Dashboard-Kacheln im 12-Spalten-Raster.
 *
 * Das Raster hat bewusst 12 Spalten: so gehen Halbe, Drittel, Viertel
 * und Sechstel glatt auf, ohne Restspalte.
 */

export const GRID_COLUMNS = 12;
export const MIN_WIDTH = 3;
export const MAX_HEIGHT = 6;

/** Vorgabe je Widget-Typ, wenn der Nutzer noch nichts eingestellt hat. */
const DEFAULTS: Record<WidgetDefinition['type'], { w: number; h: number }> = {
  // Vier Kennzahlen nebeneinander.
  stat: { w: 3, h: 1 },
  // Die Statusleiste ist ein durchgehender Streifen und bleibt es.
  strip: { w: 12, h: 1 },
  // Karten stehen paarweise nebeneinander. Hoehe 3, weil die
  // hoechste Karte gemessen 405px braucht (3 Zeilen = 424px).
  card: { w: 6, h: 3 },
};

export function defaultSize(type: WidgetDefinition['type']): { w: number; h: number } {
  return DEFAULTS[type];
}

/** Eingestellte Größe, sonst die Vorgabe des Typs. */
export function sizeFor(
  widget: WidgetDefinition,
  sizes: DashboardWidgetSize[] | undefined,
): { w: number; h: number } {
  const stored = sizes?.find((s) => s.id === widget.id);
  if (!stored) return defaultSize(widget.type);
  return {
    w: clamp(stored.w, MIN_WIDTH, GRID_COLUMNS),
    h: clamp(stored.h, 1, MAX_HEIGHT),
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Größe einer Kachel setzen und die übrigen unverändert lassen.
 * Gibt eine neue Liste zurück — die alte wird nicht verändert.
 */
export function withSize(
  sizes: DashboardWidgetSize[] | undefined,
  id: string,
  next: { w: number; h: number },
): DashboardWidgetSize[] {
  const rest = (sizes ?? []).filter((s) => s.id !== id);
  return [...rest, { id, w: next.w, h: next.h }];
}
