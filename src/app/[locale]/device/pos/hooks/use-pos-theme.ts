'use client';

import { useEffect, useState } from 'react';
import type { PosTheme } from '@/stores/device-store';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** `system` → Einstellung des Betriebssystems, sonst die Wahl. */
function resolve(theme: PosTheme, systemDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return systemDark ? 'dark' : 'light';
  return theme;
}

/**
 * Hell/Dunkel der Kasse (je Gerät im Geräte-Store). Setzt die Klasse am
 * Dokument, an der die Tokens hängen (`.dark-mode`), solange die Kasse
 * offen ist, und stellt danach den vorherigen Stand wieder her. Ändert
 * next-themes die Klasse zwischendurch (Systemwechsel, anderer Tab),
 * setzt die Kasse ihre Wahl erneut.
 */
export function usePosTheme(theme: PosTheme) {
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    setSystemDark(query.matches);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const resolved = resolve(theme, systemDark);

  useEffect(() => {
    const root = document.documentElement;
    const before = { className: root.className, colorScheme: root.style.colorScheme };
    const apply = () => {
      const dark = resolved === 'dark';
      if (root.classList.contains('dark-mode') !== dark) root.classList.toggle('dark-mode', dark);
      if (root.classList.contains('light-mode') === dark) root.classList.toggle('light-mode', !dark);
      if (root.style.colorScheme !== resolved) root.style.colorScheme = resolved;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => {
      observer.disconnect();
      root.classList.toggle('dark-mode', before.className.split(/\s+/).includes('dark-mode'));
      root.classList.toggle('light-mode', before.className.split(/\s+/).includes('light-mode'));
      root.style.colorScheme = before.colorScheme;
    };
  }, [resolved]);

  return resolved;
}
