import '@/styles/landing.css';

/**
 * Rahmen für die Geräte-Verknüpfung.
 *
 * Diese Seite steht bewusst außerhalb der AppShell — man landet hier vom
 * Handy aus, nachdem man einen QR-Code gescannt hat, und soll nicht durch
 * das halbe Dashboard laden müssen. Damit fehlten ihr aber auch die
 * Stile: `landing.css` wird nur in den Layouts geladen, die es gibt, und
 * hier gab es keins.
 *
 * Die Schriften (Geist, Bricolage Grotesque, JetBrains Mono) setzt schon
 * das Locale-Layout über `openEosFonts` aus @openeos/ui — lokal
 * eingebunden, ohne Anfrage bei Google.
 */
export default function DevicesLinkLayout({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
