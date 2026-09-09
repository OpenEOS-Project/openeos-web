'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import { usePreferences, useUpdatePreferences } from '@/hooks/use-user-settings';
import { WelcomeTour } from './welcome-tour';
import { TOUR_VERSION } from './tour-steps';

/**
 * Entscheidet, ob die Tour läuft.
 *
 * Getrennt von der Tour selbst, damit deren Darstellung nichts über
 * Einstellungen wissen muss — und damit ein "Tour erneut ansehen" später
 * nur diesen Zustand setzen muss.
 *
 * Gezeigt wird sie, wenn der Nutzer sie noch nie oder nur in einer
 * älteren Fassung abgeschlossen hat. Bis die Einstellungen geladen sind,
 * passiert nichts — sonst blitzte die Tour bei jedem Seitenaufruf kurz
 * auf, bevor sie sich selbst zurücknimmt.
 */
export function TourHost() {
  const pathname = usePathname();
  const { data: preferences, isLoading } = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const [laeuft, setLaeuft] = useState(false);

  /* Die Version, die diese Komponente selbst gerade geschrieben hat.
     Nach dem Beenden haelt die Abfrage kurz noch den alten Wert — ohne
     diese Notiz startete die Tour sofort wieder. Ein einfaches
     "schon erledigt"-Flag waere zu grob: wer die Tour spaeter ueber die
     Einstellungen zuruecksetzt, kaeme damit bis zum Neuladen nicht mehr
     an sie heran. */
  const selbstGesetzt = useRef<number | null>(null);

  /* Nur auf dem Dashboard. Dort landet man nach dem Login, und nur dort
     gibt es alle Ziele — Quick-Start und Zeitraum stehen auf keiner
     anderen Seite. Startete sie anderswo, liefe eine halbe Tour durch
     und gaelte danach als gesehen. */
  const aufDashboard = pathname?.endsWith('/dashboard') ?? false;

  useEffect(() => {
    if (!aufDashboard || isLoading || !preferences) return;
    const gesehen = preferences.onboarding?.tourVersion ?? 0;
    if (selbstGesetzt.current !== null && gesehen === selbstGesetzt.current) return;
    if (gesehen < TOUR_VERSION) setLaeuft(true);
  }, [aufDashboard, isLoading, preferences]);

  if (!laeuft) return null;

  return (
    <WelcomeTour
      onFinish={() => {
        setLaeuft(false);
        selbstGesetzt.current = TOUR_VERSION;
        updatePreferences.mutate({
          onboarding: {
            tourVersion: TOUR_VERSION,
            tourCompletedAt: new Date().toISOString(),
          },
        });
      }}
    />
  );
}
