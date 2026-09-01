'use client';

import { useState } from 'react';

interface IntegrationLogoProps {
  /** Zugleich Dateiname unter public/integrations/<id>.svg. */
  id: string;
  name: string;
  /** Hausfarbe des Anbieters für die Ersatzdarstellung. */
  color: string;
}

/**
 * Das Zeichen eines Anbieters.
 *
 * Liegt unter `public/integrations/<id>.svg` eine Datei, wird sie gezeigt.
 * Sonst erscheint der Anfangsbuchstabe auf der Hausfarbe des Anbieters.
 *
 * Warum nicht einfach die offiziellen Logos einzeichnen: nachgezeichnete
 * Markenzeichen werden fast immer falsch, und ein falsches Logo ist
 * schlimmer als keines. Nachladen von den Servern der Anbieter kommt auch
 * nicht infrage — das wäre bei jedem Seitenaufruf ein Aufruf zu einem
 * Fremden. Die offiziellen SVGs müssen also jemand einmal ablegen; bis
 * dahin steht hier etwas, das nichts Falsches behauptet.
 */
export function IntegrationLogo({ id, name, color }: IntegrationLogoProps) {
  const [hasFile, setHasFile] = useState(true);

  if (hasFile) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/integrations/${id}.svg`}
        alt={name}
        className="integration-card__logo"
        onError={() => setHasFile(false)}
      />
    );
  }

  return (
    <div
      className="integration-card__icon"
      style={{ background: color, color: '#fff' }}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </div>
  );
}
