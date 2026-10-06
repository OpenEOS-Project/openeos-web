'use client';

import { useTranslations } from 'next-intl';
import { Banner, Button, Icon } from '@openeos/ui';

/**
 * Hinweis „Testmodus“ für die Kasse: einmal pro Sitzung auf der
 * Startansicht bzw. über dem Raster, schließbar.
 */
export function PosTestModeBanner({ onDismiss }: { onDismiss: () => void }) {
  const t = useTranslations('pos');
  return (
    <div className="pos-testbanner">
      <Banner tone="warn" icon={<Icon name="alert" />}>
        {t('testMode')}
      </Banner>
      <Button variant="quiet" iconOnly aria-label={t('header.dismissTest')} onClick={onDismiss}>
        <Icon name="x" />
      </Button>
    </div>
  );
}
