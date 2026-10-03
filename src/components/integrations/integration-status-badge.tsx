'use client';

import { useTranslations } from 'next-intl';

interface IntegrationStatusBadgeProps {
  available: boolean;
  enabled: boolean;
}

export function IntegrationStatusBadge({ available, enabled }: IntegrationStatusBadgeProps) {
  const t = useTranslations('integrations.status');
  if (!available) return <span className="badge badge--neutral">{t('comingSoon')}</span>;
  if (enabled) return <span className="badge badge--success">{t('active')}</span>;
  return <span className="badge badge--neutral">{t('inactive')}</span>;
}
