'use client';

import { useTranslations } from 'next-intl';

import type { IntegrationAvailability, IntegrationSetupState } from '@/config/integrations';

interface IntegrationStatusBadgeProps {
  availability: IntegrationAvailability;
  enabled: boolean;
  /** Bei Integrationen, die nach dem Einschalten erst eingerichtet werden (Cloud-TSE). */
  setupState?: IntegrationSetupState;
}

export function IntegrationStatusBadge({ availability, enabled, setupState = 'done' }: IntegrationStatusBadgeProps) {
  const t = useTranslations('integrations.status');
  // Eingeschaltet bleibt eingeschaltet, auch wenn sich Land oder Server
  // später ändern — sonst fände man die aktive Integration nicht wieder.
  if (enabled && availability !== 'comingSoon') {
    // „Aktiv“ erst, wenn sie wirklich läuft — eine eingeschaltete Cloud-TSE
    // ohne angelegte TSE signiert noch nichts.
    if (setupState === 'creating') return <span className="badge badge--info">{t('settingUp')}</span>;
    if (setupState === 'pending') return <span className="badge badge--warning">{t('notSetUp')}</span>;
    return <span className="badge badge--success">{t('active')}</span>;
  }
  if (availability === 'comingSoon') return <span className="badge badge--neutral">{t('comingSoon')}</span>;
  if (availability === 'countryMissing') return <span className="badge badge--warning">{t('countryMissing')}</span>;
  if (availability === 'country') return <span className="badge badge--neutral">{t('notInCountry')}</span>;
  if (availability === 'server') return <span className="badge badge--neutral">{t('notOnServer')}</span>;
  return <span className="badge badge--neutral">{t('inactive')}</span>;
}
