'use client';

import { useTranslations } from 'next-intl';

import type { IntegrationAvailability } from '@/config/integrations';

interface IntegrationStatusBadgeProps {
  availability: IntegrationAvailability;
  enabled: boolean;
}

export function IntegrationStatusBadge({ availability, enabled }: IntegrationStatusBadgeProps) {
  const t = useTranslations('integrations.status');
  // Eingeschaltet bleibt eingeschaltet, auch wenn sich Land oder Server
  // später ändern — sonst fände man die aktive Integration nicht wieder.
  if (enabled && availability !== 'comingSoon') return <span className="badge badge--success">{t('active')}</span>;
  if (availability === 'comingSoon') return <span className="badge badge--neutral">{t('comingSoon')}</span>;
  if (availability === 'country') return <span className="badge badge--neutral">{t('notInCountry')}</span>;
  if (availability === 'server') return <span className="badge badge--neutral">{t('notOnServer')}</span>;
  return <span className="badge badge--neutral">{t('inactive')}</span>;
}
