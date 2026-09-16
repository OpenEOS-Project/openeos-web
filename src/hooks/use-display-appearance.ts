'use client';

import { useEffect, useMemo } from 'react';

import { useDeviceStore } from '@/stores/device-store';
import type { DisplayAppearance } from '@/types/device';

/** Zwischen diesen Stunden gilt 'auto' als hell. */
const HELL_VON = 7;
const HELL_BIS = 19;

function themaAufloesen(theme: DisplayAppearance['theme']): 'dark' | 'light' {
  if (theme === 'light') return 'light';
  if (theme === 'dark' || !theme) return 'dark';

  const stunde = new Date().getHours();
  return stunde >= HELL_VON && stunde < HELL_BIS ? 'light' : 'dark';
}

/**
 * Aussehen einer Anzeige aus den Geräteeinstellungen.
 *
 * Setzt die Farbgebung direkt am Dokument statt an einem Wrapper: die
 * dunklen Varianten hängen projektweit an `.dark-mode`, und ein Bildschirm
 * hat ohnehin nur eine Ansicht. Die Einstellungen kommen über den Store,
 * den beide Anzeigen bei `deviceSettingsUpdated` auffrischen — eine
 * Änderung im Dashboard greift damit ohne Neuladen.
 */
export function useDisplayAppearance() {
  const { settings } = useDeviceStore();
  const design = (settings?.display ?? {}) as DisplayAppearance;

  const thema = themaAufloesen(design.theme);

  useEffect(() => {
    const wurzel = document.documentElement;
    const vorher = wurzel.classList.contains('dark-mode');

    wurzel.classList.toggle('dark-mode', thema === 'dark');

    /* Beim Verlassen zurückdrehen: die Anzeige bestimmt das Aussehen nur,
       solange sie sichtbar ist, nicht für die ganze Anwendung. */
    return () => {
      wurzel.classList.toggle('dark-mode', vorher);
    };
  }, [thema]);

  return useMemo(
    () => ({
      thema,
      /** Klasse für den Wurzelcontainer der Anzeige. */
      klasse: `display-skin${design.scale === 'large' ? ' display-skin--large' : ''}`,
      headline: design.headline?.trim() || null,
      idleText: design.idleText?.trim() || null,
      showLogo: design.showLogo !== false,
      autoClearSeconds: design.autoClearSeconds ?? 0,
    }),
    [thema, design.scale, design.headline, design.idleText, design.showLogo, design.autoClearSeconds],
  );
}
