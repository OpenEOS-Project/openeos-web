'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Tv01 } from '@untitledui/icons';

import { useAuthStore } from '@/stores/auth-store';
import { DeviceLinkFlow } from '@/app/[locale]/(dashboard)/devices/components/device-link-flow';

/**
 * Der Weg für den QR-Code vom Gerät.
 *
 * In der Verwaltung läuft dasselbe als Dialog über der Geräteliste. Hier
 * braucht es eine eigene Seite, weil man von außen kommt — mit dem
 * Telefon, nachdem man den Code am Bildschirm abgescannt hat, oft ohne
 * offene Sitzung.
 *
 * Der Ablauf selbst steckt in DeviceLinkFlow; zwei Fassungen davon
 * würden beim nächsten neuen Feld auseinanderlaufen.
 */
export default function DeviceVerifyPage() {
  const t = useTranslations('devices');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const code = searchParams.get('code') || '';

  if (!user) {
    return (
      <div className="landing verify-page">
        <div className="app-card verify-card verify-card--center">
          <div className="verify-card__icon">
            <Tv01 />
          </div>
          <h1 className="verify-card__title">{t('verify.title')}</h1>
          <p className="verify-card__lead">{t('verify.loginRequired')}</p>
          <button
            type="button"
            className="btn btn--primary btn--block verify-card__cta"
            onClick={() =>
              router.push(`/login?redirect=/devices/verify${code ? `?code=${code}` : ''}`)
            }
          >
            {t('verify.login')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="landing verify-page">
      <div className="verify-page__wrap">
        <div className="verify-page__brand">
          {/* Umschaltung über eigenes CSS statt Tailwinds dark:-Varianten:
              auf dieser Seite lädt kein Tailwind, weshalb zuvor beide
              Logos nebeneinander standen. */}
          <Image src="/logo_dark.png" alt="OpenEOS" width={180} height={48} className="verify-logo verify-logo--forLight" />
          <Image src="/logo_light.png" alt="OpenEOS" width={180} height={48} className="verify-logo verify-logo--forDark" />
        </div>

        <div className="app-card verify-card">
          <div className="verify-card__icon">
            <Tv01 />
          </div>
          <h1 className="verify-card__title">{t('verify.title')}</h1>

          <DeviceLinkFlow codeAusUrl={code} onFertig={() => router.push('/devices')} />
        </div>
      </div>
    </div>
  );
}
