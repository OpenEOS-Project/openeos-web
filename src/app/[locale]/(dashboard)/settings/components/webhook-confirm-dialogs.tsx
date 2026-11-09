'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Banner, Icon } from '@openeos/ui';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useRotateWebhookSecret } from '@/hooks/use-webhooks';

import type { WebhookEndpoint, WebhookEndpointWithSecret } from '@/types/webhook';

import { WebhookSecretReveal } from './webhook-secret-reveal';

/** Escape schließt, solange nichts läuft. */
function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscape();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, onEscape]);
}

const TEXT_STYLE = { fontSize: 14, color: 'color-mix(in oklab, var(--ink) 70%, transparent)', margin: 0 } as const;

interface DeleteDialogProps {
  endpoint: WebhookEndpoint;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Rückfrage vor dem Löschen; Abbrechen (Knopf, Escape, Klick daneben) lässt alles, wie es ist. */
export function WebhookDeleteDialog({ endpoint, pending, onConfirm, onCancel }: DeleteDialogProps) {
  const t = useTranslations('settings.organizationWebhooks.deleteDialog');
  const tCommon = useTranslations('common');
  const close = pending ? () => {} : onCancel;
  useEscape(!pending, onCancel);

  return (
    <div className="modal__overlay" onClick={close}>
      <ModalPanel titleId="webhook-delete-title" className="modal__panel--sm">
        <div className="modal__head">
          <h2 id="webhook-delete-title">{t('title')}</h2>
          <DialogCloseButton onClick={close} />
        </div>
        <div className="modal__body">
          <p style={TEXT_STYLE} className="webhook-break">
            {t('text', { url: endpoint.url })}
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

interface RotateDialogProps {
  organizationId: string;
  endpoint: WebhookEndpoint;
  onClose: () => void;
}

/**
 * Secret erneuern in zwei Schritten: Rückfrage (das alte gilt noch 24 h),
 * danach die einmalige Anzeige. Im zweiten Schritt schließt nur „Fertig“.
 */
export function WebhookRotateDialog({ organizationId, endpoint, onClose }: RotateDialogProps) {
  const t = useTranslations('settings.organizationWebhooks.rotateDialog');
  const tSecret = useTranslations('settings.organizationWebhooks.secret');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const rotate = useRotateWebhookSecret(organizationId);
  const [rotated, setRotated] = useState<WebhookEndpointWithSecret | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locked = rotate.isPending || !!rotated;
  const close = locked ? () => {} : onClose;
  useEscape(!locked, onClose);

  const onConfirm = () => {
    setError(null);
    rotate.mutate(endpoint.id, {
      onSuccess: (result) => setRotated(result),
      onError: (err) => setError(apiErrorMessage(err, tCommon('error'))),
    });
  };

  return (
    <div className="modal__overlay" onClick={close}>
      <ModalPanel titleId="webhook-rotate-title" className={rotated ? 'modal__panel--md' : 'modal__panel--sm'}>
        <div className="modal__head">
          <h2 id="webhook-rotate-title">{rotated ? tSecret('rotatedTitle') : t('title')}</h2>
          {!rotated && <DialogCloseButton onClick={close} />}
        </div>
        {rotated ? (
          <>
            <div className="modal__body">
              <WebhookSecretReveal endpoint={rotated} />
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                {tSecret('done')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {error && (
                <Banner tone="danger" icon={<Icon name="alert" />}>
                  {error}
                </Banner>
              )}
              <p style={TEXT_STYLE}>{t('text')}</p>
              <p className="webhook-break webhook-mono-muted">{endpoint.url}</p>
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={rotate.isPending}>
                {tCommon('cancel')}
              </button>
              <button type="button" className="btn btn--primary" onClick={onConfirm} disabled={rotate.isPending}>
                {rotate.isPending ? t('pending') : t('confirm')}
              </button>
            </div>
          </>
        )}
      </ModalPanel>
    </div>
  );
}
