'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banner, Icon } from '@openeos/ui';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { adminOrganizationKeys } from '@/hooks/use-organizations';
import { adminApi } from '@/lib/api-client';
import {
  OPERATING_MODE_REASON_MAX,
  getOperatingMode,
  operatingModeSwitchError,
  type OperatingMode,
} from '@/lib/operating-mode';
import type { Organization } from '@/types/organization';

interface OperatingModeModalProps {
  organization: Organization | null;
  onClose: () => void;
}

const MODES: OperatingMode[] = ['pos', 'order_only'];

/**
 * Betriebsart einer Organisation umschalten (nur Support / Super-Admin).
 * Der Grund ist Pflicht: er steht im Verlauf, im Admin-Protokoll und auf
 * der Herstellerbescheinigung der Organisation.
 */
export function OperatingModeModal({ organization, onClose }: OperatingModeModalProps) {
  const t = useTranslations('organizations.operatingMode');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { formatDateTime } = useLocaleFormat();
  const queryClient = useQueryClient();
  const organizationId = organization?.id ?? '';

  const state = useQuery({
    queryKey: ['admin-operating-mode', organizationId],
    queryFn: async () => (await adminApi.getOperatingModeHistory(organizationId)).data,
    enabled: !!organizationId,
  });
  const current: OperatingMode = state.data?.operatingMode ?? getOperatingMode(organization?.settings);

  const [mode, setMode] = useState<OperatingMode>(current);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setMode(current === 'pos' ? 'order_only' : 'pos');
    setReason('');
    setTouched(false);
  }, [organizationId, current]);

  useEffect(() => {
    if (!organization) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [organization, onClose]);

  const save = useMutation({
    mutationFn: async () => (await adminApi.setOperatingMode(organizationId, { mode, reason: reason.trim() })).data,
    onSuccess: (data) => {
      toast.success(t('saved', { mode: t(`modes.${data.operatingMode}`) }));
      queryClient.invalidateQueries({ queryKey: ['admin-operating-mode', organizationId] });
      queryClient.invalidateQueries({ queryKey: adminOrganizationKeys.lists() });
      setReason('');
      setTouched(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error, tCommon('error'))),
  });

  if (!organization) return null;

  const error = operatingModeSwitchError(current, mode, reason);
  const history = state.data?.history ?? [];

  return (
    <div className="modal__overlay" style={{ display: 'flex' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__panel" role="dialog" aria-modal="true" aria-labelledby="operating-mode-title">
        <div className="modal__head">
          <h2 className="modal__title" id="operating-mode-title">
            {t('title', { name: organization.name })}
          </h2>
          <DialogCloseButton onClick={onClose} />
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
          <p style={{ margin: 0, fontSize: 13 }}>
            {t('current')}: <b>{t(`modes.${current}`)}</b>
            {state.data?.operatingModeSince ? ` · ${t('since', { date: formatDateTime(state.data.operatingModeSince) })}` : ''}
          </p>
          <Banner tone="info" icon={<Icon name="info" />}>
            {t('explain')}
          </Banner>

          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <legend style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t('newMode')}</legend>
            {MODES.map((value) => (
              <label key={value} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input
                  type="radio"
                  name="operating-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                />
                {t(`modes.${value}`)}
                {value === current && <span style={{ color: 'var(--ink-faint)' }}>({t('currentShort')})</span>}
              </label>
            ))}
          </fieldset>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600 }}>
            {t('reason')}
            <textarea
              className="input"
              rows={3}
              maxLength={OPERATING_MODE_REASON_MAX}
              value={reason}
              placeholder={t('reasonPlaceholder')}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              style={{ fontWeight: 400, resize: 'vertical' }}
            />
            <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>{t('reasonHint')}</span>
            {touched && error === 'reasonTooShort' && (
              <span role="alert" style={{ fontWeight: 500, color: 'var(--red, var(--danger))' }}>{t('reasonRequired')}</span>
            )}
          </label>

          {history.length > 0 && (
            <div className="cashless-history">
              <span className="cashless-history__title">{t('history')}</span>
              <ul>
                {history.map((entry) => (
                  <li key={entry.id}>
                    <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                    <span>
                      {t('historyEntry', { from: t(`modes.${entry.fromMode}`), to: t(`modes.${entry.toMode}`) })}
                      {` · ${entry.reason}`}
                      {entry.changedByName ? ` · ${entry.changedByName}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {tCommon('cancel')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!!error || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? tCommon('saving') : t('submit', { mode: t(`modes.${mode}`) })}
          </button>
        </div>
      </div>
    </div>
  );
}
