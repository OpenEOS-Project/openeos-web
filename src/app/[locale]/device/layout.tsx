import type { Viewport } from 'next';

import '@/styles/pos.css';

/* Kasse, Station und Anzeigen sind Bedienoberflaechen auf festen Geraeten:
   ein versehentliches Pinch- oder Doppeltipp-Zoomen verschiebt dort das
   ganze Layout mitten im Betrieb. Deshalb bleibt die Zoom-Sperre hier —
   und nur hier, nicht mehr im Root-Layout. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function DeviceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
