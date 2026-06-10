'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { devicesApi } from '@/lib/api-client';

interface Props {
  organizationId: string;
}

export function ActiveUsersWidget({ organizationId }: Props) {
  const t = useTranslations('dashboard');

  const { data: onlineDevicesResponse } = useQuery({
    queryKey: ['devices', organizationId, 'online'],
    queryFn: async () => {
      const response = await devicesApi.getOnlineIds(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
    refetchInterval: 30000,
  });

  const count = (onlineDevicesResponse || []).length;

  return (
    <div className="stat-card">
      <div className="stat-card__label">{t('stats.activeUsers')}</div>
      <div className="stat-card__value">{count}</div>
      <div className="stat-card__sub">{t('stats.usersOnline')}</div>
    </div>
  );
}
