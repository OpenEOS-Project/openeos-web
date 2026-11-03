'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Icon } from '@openeos/ui';

import { SettingsSectionHead } from '@/app/[locale]/(dashboard)/settings/components/settings-section-head';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useDeactivateTse } from '@/hooks/use-tse';
import { shortSerial } from '@/lib/tse';
import type { TseUnit } from '@/types/tse';

/**
 * Gefahrenzone: TSE endgültig außer Betrieb nehmen. Swissbit kennt keine
 * Pause — deaktiviert ist deaktiviert. Die Rückfrage verlangt eine
 * ausdrückliche Bestätigung; der Abschlussexport wird automatisch geholt,
 * danach schaltet die API die Integration aus (Bargeld in Deutschland
 * gesperrt).
 */
export function TseDangerZone({ organizationId, unit }: { organizationId: string; unit: TseUnit }) {
  const t = useTranslations('integrations.tse.danger');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const deactivate = useDeactivateTse(organizationId);
  const [open, setOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) {
      setUnderstood(false);
      setReason('');
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deactivate.isPending) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, deactivate.isPending]);

  const confirm = async () => {
    try {
      await deactivate.mutateAsync(reason.trim() || undefined);
      toast.success(t('done'));
      setOpen(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, t('failed')));
    }
  };

  return (
    <div className="app-card tse-danger" id="integration-danger-zone" data-testid="tse-danger-zone">
      <SettingsSectionHead icon="triangle-alert" tone="danger" title={t('title')} description={t('description')} />
      <div className="tse-danger__row">
        <p className="tse-text">{t('text')}</p>
        <button type="button" className="btn btn--danger-quiet" onClick={() => setOpen(true)} data-testid="tse-deactivate">
          <Icon name="ban" />
          {t('button')}
        </button>
      </div>

      {open && (
        <div className="modal__overlay" onClick={() => !deactivate.isPending && setOpen(false)}>
          <ModalPanel titleId="tse-deactivate-title" className="modal__panel--sm">
            <div className="modal__head">
              <h2 id="tse-deactivate-title">{t('dialog.title')}</h2>
              <DialogCloseButton onClick={() => !deactivate.isPending && setOpen(false)} />
            </div>
            <div className="modal__body mode-dialog" data-testid="tse-deactivate-dialog">
              <p>{t('dialog.intro', { serial: shortSerial(unit.serialNumber) })}</p>
              <ul className="mode-dialog__effects">
                <li>{t('dialog.effects.permanent')}</li>
                <li>{t('dialog.effects.export')}</li>
                <li>{t('dialog.effects.cash')}</li>
                <li>{t('dialog.effects.integration')}</li>
                <li>{t('dialog.effects.new')}</li>
              </ul>
              <Banner tone="warn" icon={<Icon name="alert" />}>
                {t('dialog.warning')}
              </Banner>
              <label className="auth-field">
                <span className="auth-field__label">{t('dialog.reason')}</span>
                <input
                  className="input"
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('dialog.reasonPlaceholder')}
                />
              </label>
              <label className="mode-dialog__check">
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(e) => setUnderstood(e.target.checked)}
                  data-testid="tse-deactivate-confirm"
                />
                <span>{t('dialog.check')}</span>
              </label>
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)} disabled={deactivate.isPending}>
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => void confirm()}
                disabled={!understood || deactivate.isPending}
                data-testid="tse-deactivate-submit"
              >
                {deactivate.isPending ? t('dialog.pending') : t('dialog.submit')}
              </button>
            </div>
          </ModalPanel>
        </div>
      )}
    </div>
  );
}
