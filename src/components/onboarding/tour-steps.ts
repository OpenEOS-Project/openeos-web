/**
 * Die Schritte der Willkommens-Tour.
 *
 * `target` ist ein `data-tour`-Wert im Markup, kein CSS-Selektor. Das ist
 * der Kern: Klassennamen und Layout ändern sich hier oft, ein eigenes
 * Attribut bleibt beim Umbauen stehen, weil es sichtbar dafür da ist.
 * Fehlt ein Ziel trotzdem, überspringt die Tour den Schritt — sie zeigt
 * nie ins Leere.
 *
 * `TOUR_VERSION` erhöhen, wenn die Tour inhaltlich neu ist; dann sehen
 * auch Nutzer sie wieder, die die alte schon abgeschlossen hatten.
 */
export const TOUR_VERSION = 1;

export interface TourStep {
  id: string;
  /** Wert des data-tour-Attributs am Zielelement. */
  target: string;
  /** Wo die Sprechblase steht, wenn Platz ist. */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Schritte ohne Ziel erscheinen mittig — für Auftakt und Schluss. */
  centered?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  { id: 'welcome', target: '', centered: true },
  { id: 'nav', target: 'nav', placement: 'right' },
  { id: 'events', target: 'nav-events', placement: 'right' },
  { id: 'products', target: 'nav-products', placement: 'right' },
  { id: 'devices', target: 'nav-devices', placement: 'right' },
  { id: 'quickStart', target: 'quick-start', placement: 'bottom' },
  { id: 'range', target: 'dashboard-range', placement: 'bottom' },
  { id: 'help', target: 'nav-support', placement: 'right' },
];
