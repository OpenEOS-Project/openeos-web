interface IntegrationLogoProps {
  name: string;
  /** Hausfarbe des Anbieters für die Ersatzdarstellung. */
  color: string;
  /** Pfad unter /public, falls ein offizielles Logo abgelegt ist (Katalogfeld `logo`). */
  logo?: string;
}

/**
 * Das Zeichen eines Anbieters.
 *
 * Ist im Katalog (`src/config/integrations.ts`) ein `logo` eingetragen,
 * wird es gezeigt. Sonst erscheint der Anfangsbuchstabe auf der Hausfarbe
 * des Anbieters.
 *
 * Früher wurde `/integrations/<id>.svg` auf Verdacht geladen und bei 404
 * auf die Ersatzkachel umgeschaltet — das waren drei fehlgeschlagene
 * Anfragen bei jedem Aufruf des Katalogs. Jetzt entscheidet der Katalog.
 *
 * Warum nicht einfach die offiziellen Logos einzeichnen: nachgezeichnete
 * Markenzeichen werden fast immer falsch, und ein falsches Logo ist
 * schlimmer als keines. Nachladen von den Servern der Anbieter kommt auch
 * nicht infrage — das wäre bei jedem Seitenaufruf ein Aufruf zu einem
 * Fremden.
 *
 * Beide Varianten sind dekorativ: der Markenname steht immer daneben, ein
 * `alt` mit demselben Namen würde ihn für Screenreader nur verdoppeln.
 */
export function IntegrationLogo({ name, color, logo }: IntegrationLogoProps) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="" className="integration-card__logo" />
    );
  }

  return (
    // <span> statt <div>: das Logo steht auch in der Katalogkarte, und die
    // ist ein <button>, in dem nur Inline-Inhalt erlaubt ist.
    <span
      className="integration-card__icon"
      // Der Rand hält die Kachel im Dark Mode sichtbar — Hausfarben wie
      // das fast schwarze SumUp verschwinden sonst auf dem dunklen Grund.
      style={{ background: color, color: '#fff', border: '1px solid var(--oe-line)' }}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  );
}
