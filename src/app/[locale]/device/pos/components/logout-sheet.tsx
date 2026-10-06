'use client';

import { useTranslations } from 'next-intl';
import { Button, Icon } from '@openeos/ui';
import { PosSheet } from './pos-sheet';

/** Bestätigung „Gerät abmelden“ — trennt die Kasse von der Organisation. */
export function LogoutSheet({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  const t = useTranslations('pos.menu');
  return (
    <PosSheet
      open={open}
      onClose={onClose}
      icon="logout"
      iconTone="default"
      title={t('logoutTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('logoutCancel')}
          </Button>
          <Button variant="danger" className="oe-grow" onClick={onConfirm}>
            <Icon name="logout" />
            {t('logoutConfirm')}
          </Button>
        </>
      }
    >
      <p className="pos-hint">{t('logoutText')}</p>
    </PosSheet>
  );
}
