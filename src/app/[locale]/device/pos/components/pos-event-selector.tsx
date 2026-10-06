'use client';

import { useTranslations } from 'next-intl';
import { Banner, Icon } from '@openeos/ui';

/**
 * Testmodus der Kasse: ein schmaler Streifen unter dem Kopf, eine Zeile,
 * nicht schließbar — er gilt, solange die Veranstaltung im Test läuft,
 * und nimmt kaum Platz weg. Sonst kein weiteres Testmodus-Element.
 */
export function PosTestModeBanner() {
  const t = useTranslations('pos');
  return (
    <Banner tone="warn" icon={<Icon name="alert" />} className="pos-testband">
      {t('testMode')}
    </Banner>
  );
}
