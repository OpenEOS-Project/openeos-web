import { Geist, JetBrains_Mono } from 'next/font/google';

import '@/styles/landing.css';

/**
 * Rahmen für die Geräte-Verknüpfung.
 *
 * Diese Seite steht bewusst außerhalb der AppShell — man landet hier vom
 * Handy aus, nachdem man einen QR-Code gescannt hat, und soll nicht durch
 * das halbe Dashboard laden müssen. Damit fehlten ihr aber auch die
 * Stile: `landing.css` wird nur in den Layouts geladen, die es gibt, und
 * hier gab es keins.
 */
const geist = Geist({
  variable: '--f-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--f-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export default function DevicesLinkLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${geist.variable} ${jetbrainsMono.variable}`}>{children}</div>;
}
