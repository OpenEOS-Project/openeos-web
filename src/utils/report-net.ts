import type { NetSalesSummary } from '@/types/report';

/**
 * Abgleichzeilen unter Produkt- und Kategoriebericht:
 *
 *   Summe der Zeilen + Erstattungen ohne Position + Trinkgeld (+ Rundung)
 *   = Umsatz netto (wie im Verkaufsbericht)
 *
 * Kulanz-Erstattungen ohne Positionsbezug werden nicht anteilig auf die
 * Produkte verteilt — der Gegenbeleg nennt kein Produkt; die API weist sie
 * deshalb gesondert aus. Rundung: Die Zeilen sind einzeln auf Cent gerundet
 * (Rabatt anteilig), die Differenz erscheint nur, wenn es eine gibt.
 */
export type NetLineKey = 'items' | 'unassignedRefunds' | 'tips' | 'rounding' | 'netRevenue';

export interface NetLine {
  key: NetLineKey;
  amount: number;
}

const cents = (value: number) => Math.round(value * 100);

export function netReconciliation(rowRevenues: number[], summary: NetSalesSummary): NetLine[] {
  const items = rowRevenues.reduce((sum, value) => sum + cents(value), 0);
  const unassigned = cents(summary.unassignedRefunds);
  const tips = cents(summary.tips);
  const net = cents(summary.netRevenue);
  const rounding = net - items - unassigned - tips;
  const lines: NetLine[] = [{ key: 'items', amount: items / 100 }];
  if (unassigned !== 0) lines.push({ key: 'unassignedRefunds', amount: unassigned / 100 });
  if (tips !== 0) lines.push({ key: 'tips', amount: tips / 100 });
  if (rounding !== 0) lines.push({ key: 'rounding', amount: rounding / 100 });
  lines.push({ key: 'netRevenue', amount: net / 100 });
  return lines;
}
