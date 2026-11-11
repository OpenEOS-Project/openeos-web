'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useDeleteTokenType, useUpdateTokenType } from '@/hooks/use-token-types';
import { ApiException } from '@/types/api';
import type { TokenType } from '@/types/token';

interface TokenTypeDeleteDialogProps {
  organizationId: string;
  tokenType: TokenType;
  onClose: () => void;
}

/**
 * Markentyp löschen — oder deaktivieren, sobald Marken davon verkauft bzw.
 * angenommen wurden (die API antwortet dann 409 TOKEN_TYPE_IN_USE): Verkauf
 * und Einlösung sollen nachvollziehbar bleiben.
 */
export function TokenTypeDeleteDialog({ organizationId, tokenType, onClose }: TokenTypeDeleteDialogProps) {
  const t = useTranslations('tokens');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const deleteType = useDeleteTokenType(organizationId);
  const updateType = useUpdateTokenType(organizationId);
  // Erst beim Löschen bemerkt (jemand hat gerade verkauft): auf Deaktivieren umschalten.
  const [inUse, setInUse] = useState(!!tokenType.inUse);
  const [error, setError] = useState<string | null>(null);
  const pending = deleteType.isPending || updateType.isPending;

  const remove = async () => {
    setError(null);
    try {
      await deleteType.mutateAsync(tokenType.id);
      toast.success(t('toast.deleted', { name: tokenType.name }));
      onClose();
    } catch (err) {
      // Der Hinweis zum Deaktivieren erklärt es schon — kein zweiter Fehlertext.
      if (err instanceof ApiException && err.reason === 'TOKEN_TYPE_IN_USE') setInUse(true);
      else setError(apiErrorMessage(err, tCommon('error')));
    }
  };

  const deactivate = async () => {
    setError(null);
    try {
      await updateType.mutateAsync({ id: tokenType.id, data: { isActive: false } });
      toast.success(t('toast.deactivated', { name: tokenType.name }));
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, tCommon('error')));
    }
  };

  const title = inUse ? t('deactivate.title') : t('deleteConfirm.title');
  const message = inUse
    ? tokenType.isActive
      ? t('deactivate.message', { name: tokenType.name })
      : t('deactivate.alreadyInactive', { name: tokenType.name })
    : t('deleteConfirm.message', { name: tokenType.name });

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div
        className="modal__panel modal__panel--sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="token-type-delete-title"
        data-testid="token-type-delete-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2 id="token-type-delete-title">{title}</h2>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 14, color: 'var(--ink)', opacity: 0.7, margin: 0 }}>{message}</p>
          {error && (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>
              {error}
            </p>
          )}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {inUse && !tokenType.isActive ? tCommon('close') : tCommon('cancel')}
          </button>
          {!inUse && (
            <button
              type="button"
              className="btn btn--primary"
              style={{ background: 'var(--error, var(--danger))' }}
              onClick={() => void remove()}
              disabled={pending}
            >
              {deleteType.isPending ? tCommon('deleting') : t('deleteConfirm.confirm')}
            </button>
          )}
          {inUse && tokenType.isActive && (
            <button type="button" className="btn btn--primary" onClick={() => void deactivate()} disabled={pending}>
              {updateType.isPending ? tCommon('saving') : t('deactivate.confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
