'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Tv01 } from '@untitledui/icons';

import { useDeviceStore, useDeviceHydration } from '@/stores/device-store';
import { zielRouteFuerGeraet } from '@/lib/device-route';

/**
 * Startbild einer Anzeige.
 *
 * Wer einen Fernseher aufstellt, hat keine Tastatur und oft keine Maus.
 * Diese Seite verlangt deshalb keine Eingabe: sie meldet das Gerät selbst
 * an und zeigt nur noch den Kopplungscode — einmal groß zum Abtippen und
 * einmal als QR-Code für alle, die das Handy dabei haben.
 *
 * Die Gegenseite ist /devices/verify im angemeldeten Konto. Beide Wege
 * enden dort; der QR-Code bringt den Code nur gleich mit.
 */
export default function DeviceDisplayPage() {
  const router = useRouter();
  const hasHydrated = useDeviceHydration();
  const [fehler, setFehler] = useState<string | null>(null);

  const {
    deviceId,
    verificationCode,
    status,
    deviceClass,
    settings,
    init,
    checkStatus,
    startPolling,
    stopPolling,
    clearDevice,
  } = useDeviceStore();

  /* Einmal anmelden, sobald der gespeicherte Zustand geladen ist. Ohne
     das Warten liefe der Aufruf gegen einen leeren Speicher und legte
     bei jedem Neuladen ein weiteres Gerät an. */
  useEffect(() => {
    if (!hasHydrated || deviceId) return;
    init('Anzeige', 'display').catch(() =>
      setFehler('Die Anzeige konnte sich nicht anmelden. Prüfen Sie die Internetverbindung.'),
    );
  }, [hasHydrated, deviceId, init]);

  // Auf die Freigabe warten und danach an den richtigen Platz gehen.
  useEffect(() => {
    if (!hasHydrated) return;

    if (status === 'verified') {
      stopPolling();
      router.replace(zielRouteFuerGeraet(deviceClass, settings as { displayMode?: string }));
      return;
    }

    if (status === 'pending') {
      void checkStatus();
      startPolling();
    }

    return () => stopPolling();
  }, [hasHydrated, status, deviceClass, settings, router, checkStatus, startPolling, stopPolling]);

  const verknuepfUrl =
    typeof window !== 'undefined' && verificationCode
      ? `${window.location.origin}/devices/verify?code=${verificationCode}`
      : '';

  return (
    <div className="pos-root display-pair">
      <div className="display-pair__inner">
        <span className="display-pair__icon">
          <Tv01 />
        </span>

        <h1 className="display-pair__title">Anzeige verbinden</h1>
        <p className="display-pair__lead">
          Öffne OpenEOS auf einem anderen Gerät und gib diesen Code ein — oder scanne
          den QR-Code mit dem Handy.
        </p>

        {fehler ? (
          <p className="display-pair__error">{fehler}</p>
        ) : status === 'blocked' ? (
          <div className="display-pair__error">
            <p>Diese Anzeige wurde gesperrt.</p>
            <button type="button" className="display-pair__reset" onClick={clearDevice}>
              Neu beginnen
            </button>
          </div>
        ) : verificationCode ? (
          <div className="display-pair__body">
            <div className="display-pair__code" aria-label="Kopplungscode">
              {/* In Zweiergruppen, weil sechs Ziffern am Stück über den
                  Raum hinweg schwer abzulesen sind. */}
              {verificationCode.replace(/(\d{2})(?=\d)/g, '$1 ')}
            </div>

            {verknuepfUrl && (
              <div className="display-pair__qr">
                <QRCodeSVG value={verknuepfUrl} size={188} level="M" includeMargin />
              </div>
            )}
          </div>
        ) : (
          <p className="display-pair__waiting">Anzeige wird angemeldet …</p>
        )}

        <p className="display-pair__foot">
          Die Seite wechselt von selbst, sobald die Anzeige freigegeben ist.
        </p>
      </div>
    </div>
  );
}
