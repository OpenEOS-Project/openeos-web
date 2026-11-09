'use client';

import { useTranslations } from 'next-intl';
import { Button, ButtonLink } from '@openeos/ui';

import type { EmergencySupportInfo } from '@/types/support';

import { PosSheet } from './pos-sheet';

/**
 * Notfall-Support am Veranstaltungstag (AGB 18.2) im Kassenmenü: Rufnummer
 * zum Antippen (Tablet/Handy ruft direkt an) und wofür sie da ist.
 */
export function EmergencySupportSheet({
  open,
  onClose,
  info,
}: {
  open: boolean;
  onClose: () => void;
  info: Pick<EmergencySupportInfo, 'phone' | 'telUri'>;
}) {
  const t = useTranslations('pos.menu');
  const tSupport = useTranslations('support.emergency');
  if (!info.phone || !info.telUri) return null;
  return (
    <PosSheet
      open={open}
      onClose={onClose}
      icon="alert"
      iconTone="accent"
      title={t('emergencyTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('emergencyClose')}
          </Button>
          <ButtonLink variant="primary" className="oe-grow" href={info.telUri}>
            {t('emergencyCall')}
          </ButtonLink>
        </>
      }
    >
      <p className="pos-emergency__phone" data-testid="pos-emergency-phone">
        <a href={info.telUri}>{info.phone}</a>
      </p>
      <p className="pos-hint">{tSupport('text')}</p>
    </PosSheet>
  );
}
