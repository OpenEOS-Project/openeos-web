'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';

import type { ApiToken } from '@/types/api-token';

interface ApiTokenRevokeDialogProps {
  token: ApiToken;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Rückfrage vor dem Widerrufen: Programme, die den Zugang nutzen, verlieren
 * sofort den Zugriff, und ein Widerruf lässt sich nicht zurücknehmen.
 * Abbrechen (Knopf, Escape, Klick daneben) lässt den Zugang bestehen.
 */
export function ApiTokenRevokeDialog({ token, pending, onConfirm, onCancel }: ApiTokenRevokeDialogProps) {
  const t = useTranslations('settings.organizationAccess.revokeDialog');
  const tCommon = useTranslations('common');
  const close = pending ? () => {} : onCancel;

  useEffect(() => {
    if (pending) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pending, onCancel]);

  return (
    <div className="modal__overlay" onClick={close}>
      <ModalPanel titleId="api-token-revoke-title" className="modal__panel--sm">
        <div className="modal__head">
          <h2 id="api-token-revoke-title">{t('title', { name: token.name })}</h2>
          <DialogCloseButton onClick={close} />
        </div>

        <div className="modal__body">
          <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 70%, transparent)', margin: 0 }}>
            {t('text')}
          </p>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={pending}>
            {tCommon('cancel')}
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={pending}>
            {pending ? t('pending') : t('confirm')}
          </button>
        </div>
      </ModalPanel>
    </div>
  );
}
