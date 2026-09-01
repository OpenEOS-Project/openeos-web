'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

interface Props {
  /** Eingeklappt bleibt nur Platz für die Bildmarke. */
  collapsed?: boolean;
}

/**
 * Logo der Seitenleiste.
 *
 * Zwei Achsen: Breite (voll oder Bildmarke) und Tinte (dunkel oder
 * hell). Die Dateinamen benennen die **Tinte**, nicht den Untergrund —
 * `logo_dark` ist das dunkle Logo für helle Flächen, `logo_light` das
 * weiße für dunkle. Vorher war überall `logo_dark` fest verdrahtet,
 * weshalb es im Dark-Mode auf dunklem Grund fast verschwand.
 */
export function SidebarLogo({ collapsed = false }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* Vor dem Mounten kennt der Client das Theme nicht. Dann die dunkle
     Tinte zeigen — sie entspricht dem hellen Standard und vermeidet
     einen Wechsel beim ersten Rendern. */
  const ink = mounted && resolvedTheme === 'dark' ? 'light' : 'dark';
  const size = collapsed ? '_small' : '';
  const src = `/logo${size}_${ink}.png`;

  return (
    <div className={`app-sidebar__logo${collapsed ? ' app-sidebar__logo--small' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="OpenEOS" />
    </div>
  );
}
