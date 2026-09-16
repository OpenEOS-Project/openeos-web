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

  /* Einmal beim Start nachfragen. Der Speicher hält den Stand vom
     Zeitpunkt der Kopplung fest; wer etwas ändert, während der Bildschirm
     aus ist, sähe seine Änderung sonst nie — das laufende Ereignis
     erreicht nur Anzeigen, die gerade an sind. */
  useEffect(() => {
    void useDeviceStore.getState().checkStatus();
  }, []);

  const thema = themaAufloesen(design.theme);

  const gross = design.scale === 'large';

  useEffect(() => {
    const wurzel = document.documentElement;
    const vorherDunkel = wurzel.classList.contains('dark-mode');
    const vorherGroesse = wurzel.style.fontSize;

    wurzel.classList.toggle('dark-mode', thema === 'dark');

    /* Die Schriftgröße muss an der Wurzel hängen, nicht am Container der
       Anzeige: die Größenklassen der Oberfläche rechnen in rem, und rem
       bezieht sich immer auf das Wurzelelement. Am Container gesetzt
       bliebe sie wirkungslos. */
    wurzel.style.fontSize = gross ? '135%' : '';

    return () => {
      wurzel.classList.toggle('dark-mode', vorherDunkel);
      wurzel.style.fontSize = vorherGroesse;
    };
  }, [thema, gross]);

  return useMemo(
    () => ({
      thema,
      /** Klasse für den Wurzelcontainer der Anzeige. */
      klasse: `display-skin${gross ? ' display-skin--large' : ''}`,
      /* Auf hellem Grund braucht es das dunkle Logo — sonst steht es
         unsichtbar in der Kopfzeile. */
      logoUrl: thema === 'light' ? '/logo_dark_trans.png' : '/logo_light_trans.png',
      headline: design.headline?.trim() || null,
      idleText: design.idleText?.trim() || null,
      showLogo: design.showLogo !== false,
      autoClearSeconds: design.autoClearSeconds ?? 0,
    }),
    [thema, gross, design.headline, design.idleText, design.showLogo, design.autoClearSeconds],
  );
}
