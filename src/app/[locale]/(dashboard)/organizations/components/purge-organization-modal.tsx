'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ConfirmDialog } from '@/components/shared/operating-mode-notices';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { adminOrganizationKeys } from '@/hooks/use-organizations';
import { adminApi } from '@/lib/api-client';
import { confirmationMatches, PURGE_REASON_MIN_LENGTH } from '@/lib/privacy';
import type { Organization } from '@/types';

/**
 * Sofortige endgültige Löschung auf Verlangen des Kunden (AVV 10.2 Satz 3,
 * AGB 20.5) – nur Super-Admin. Name eintippen und Anlass angeben; der
 * Vorgang steht im Protokoll der Löschläufe, das Steuerarchiv bleibt.
 */
export function PurgeOrganizationModal({
  organization,
  onClose,
}: {
  organization: Organization | null;
  onClose: () => void;
}) {
  const t = useTranslations('privacy.purge');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');

  const close = () => {
    setTyped('');
    setReason('');
    onClose();
  };

  const purge = useMutation({
    mutationFn: async () => {
      const result = await adminApi.purgeOrganization(organization!.id, {
        confirmName: typed,
        reason: reason.trim(),
      });
      if (result.data.status !== 'succeeded') throw new Error(t('failed'));
      return result.data;
    },
    onSuccess: () => {
      toast.success(t('done', { name: organization!.name }));
      queryClient.invalidateQueries({ queryKey: adminOrganizationKeys.all });
      close();
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('failed'))),
  });

  if (!organization) return null;

  return (
    <ConfirmDialog
      id="purge-organization-dialog"
      title={t('title', { name: organization.name })}
      confirmLabel={t('confirm')}
      pending={purge.isPending}
      danger
      confirmDisabled={
        !confirmationMatches(organization.name, typed) || reason.trim().length < PURGE_REASON_MIN_LENGTH
      }
      onConfirm={() => purge.mutate()}
      onCancel={close}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 14 }}>{t('text')}</p>
        <ul className="privacy-list" style={{ marginTop: 0 }}>
          <li>{t('keeps')}</li>
          <li>{t('rules')}</li>
          <li>{t('log')}</li>
        </ul>
        <div className="auth-field">
          <label className="auth-field__label" htmlFor="purge-name">
                {t('typeName')}
              </label>
              <p className="privacy-muted" style={{ margin: '0 0 6px' }}>
                <b style={{ color: 'var(--ink)', userSelect: 'all' }}>{organization.name}</b>
              </p>
          <input id="purge-name" className="input" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
        <div className="auth-field">
          <label className="auth-field__label" htmlFor="purge-reason">
            {t('reason')}
          </label>
          <textarea
            id="purge-reason"
            className="input"
            rows={3}
            maxLength={500}
            placeholder={t('reasonPlaceholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="privacy-muted" style={{ marginTop: 4 }}>{t('reasonHint', { min: PURGE_REASON_MIN_LENGTH })}</p>
        </div>
      </div>
    </ConfirmDialog>
  );
}
