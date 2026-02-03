'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Tv01 } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';

export function LinkDeviceButton() {
  const t = useTranslations('devices');
  const router = useRouter();

  return (
    <Button
      onClick={() => router.push('/devices/verify')}
      iconLeading={Tv01}
    >
      {t('linkDevice')}
    </Button>
  );
}
