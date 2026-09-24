'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Tablet02, Tv01 } from '@untitledui/icons';
import { useTranslations } from 'next-intl';

import { useDeviceStore, useDeviceHydration } from '@/stores/device-store';
import { zielRouteFuerGeraet } from '@/lib/device-route';
import type { DeviceClass } from '@/types/device';

/** Was sich hier koppeln lässt. Alles andere fällt auf 'display' zurück. */
const ERLAUBTE_TYPEN: DeviceClass[] = ['display', 'pos'];

/**
 * Kopplung per Code — für jede Art von Gerät.
 *
 * Der Bildschirm meldet sich selbst an und zeigt nur eine Zahl; verknüpft
 * wird sie in einem angemeldeten Konto. Das Gerät braucht damit weder
 * Tastatur noch Zugangsdaten noch das Kürzel der Organisation, was es
 * ebenso für eine App taugen lässt wie für einen Fernseher.
 *
 * Der Typ steht in der Adresse (`?type=pos`), damit ein künftiger Client
 * nur eine URL öffnen muss statt eine eigene Oberfläche mitzubringen.
 */
export default function DevicePairPage() {
  const t = useTranslations('device.pair');
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasHydrated = useDeviceHydration();
  const [fehler, setFehler] = useState<string | null>(null);

  /* Kommt das Geraet aus einer abgelehnten Anmeldung, muss dastehen
     warum — sonst steht das Personal vor einer Kopplungsseite, die
     gestern noch eine Kasse war, und haelt es fuer einen neuen Fehler. */
  const entfernt = searchParams.get('grund') === 'entfernt';

  const typ = useMemo<DeviceClass>(() => {
    const gewuenscht = searchParams.get('type') as DeviceClass | null;
    return gewuenscht && ERLAUBTE_TYPEN.includes(gewuenscht) ? gewuenscht : 'display';
  }, [searchParams]);

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

  /* Einmal anmelden, sobald der gespeicherte Zustand geladen ist. Ohne das
     Warten liefe der Aufruf gegen einen leeren Speicher und legte bei
     jedem Neuladen ein weiteres Gerät an. */
  useEffect(() => {
    if (!hasHydrated || deviceId) return;
    init(t(`kinds.${typ}.suggestedName`), typ).catch(() => setFehler(t('registerFailed')));
  }, [hasHydrated, deviceId, init, typ, t]);

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
        <span className="display-pair__icon">{typ === 'pos' ? <Tablet02 /> : <Tv01 />}</span>

        <h1 className="display-pair__title">{t(`kinds.${typ}.title`)}</h1>

        {entfernt ? (
          <p className="display-pair__notice">{t('revoked')}</p>
        ) : (
          <p className="display-pair__lead">{t('lead')}</p>
        )}

        {fehler ? (
          <p className="display-pair__error">{fehler}</p>
        ) : status === 'blocked' ? (
          <div className="display-pair__error">
            <p>{t('blocked')}</p>
            <button type="button" className="display-pair__reset" onClick={clearDevice}>
              {t('restart')}
            </button>
          </div>
        ) : verificationCode ? (
          <div className="display-pair__body">
            {/* Der Code trägt die Fläche, der QR-Code ist der zweite Weg
                dorthin. Nebeneinander konkurrierten beide um dieselbe
                Aufmerksamkeit, obwohl nur einer aus zehn Metern lesbar
                ist. */}
            <div className="display-pair__code" aria-label={t('codeLabel')}>
              {/* In Zweiergruppen, weil sechs Ziffern am Stück über den
                  Raum hinweg schwer abzulesen sind. */}
              {verificationCode.replace(/(\d{2})(?=\d)/g, '$1 ')}
            </div>

            {verknuepfUrl && (
              <div className="display-pair__alt">
                <span className="display-pair__alt-label">{t('orScan')}</span>
                <div className="display-pair__qr">
                  <QRCodeSVG value={verknuepfUrl} size={132} level="M" includeMargin />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="display-pair__waiting">{t('registering')}</p>
        )}

        <p className="display-pair__foot">{t('autoContinue')}</p>
      </div>
    </div>
  );
}
