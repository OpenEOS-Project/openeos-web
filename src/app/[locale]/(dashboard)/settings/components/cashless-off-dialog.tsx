'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { tseFaqUrl } from '@/lib/cashless';

interface CashlessOffDialogProps {
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Rückfrage vor dem Ausschalten des bargeldlosen Modus: Mit Bargeld braucht
 * die Kasse eine TSE, die OpenEOS noch nicht anbindet. Abbrechen (Knopf,
 * Escape, Klick daneben) lässt den Modus an; während des Speicherns ist der
 * Dialog gesperrt.
 */
export function CashlessOffDialog({ pending, onConfirm, onCancel }: CashlessOffDialogProps) {
  const t = useTranslations('settings.organizationPayments.confirmOff');
  const tCommon = useTranslations('common');
  const locale = useLocale();
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
      <ModalPanel titleId="cashless-off-dialog-title" className="modal__panel--sm">
        <div className="modal__head">
          <h2 id="cashless-off-dialog-title">{t('title')}</h2>
          <DialogCloseButton onClick={close} />
        </div>

        <div className="modal__body">
          <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 70%, transparent)', margin: '0 0 12px' }}>
            {t('text')}
          </p>
          <a
            href={tseFaqUrl(locale)}
            target="_blank"
            rel="noopener noreferrer"
            className="cash-tse-notice__link"
            style={{ fontSize: 14 }}
          >
            {t('faqLink')}
          </a>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={pending}>
            {tCommon('cancel')}
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={pending}>
            {pending ? tCommon('saving') : t('confirm')}
          </button>
        </div>
      </ModalPanel>
    </div>
  );
}
