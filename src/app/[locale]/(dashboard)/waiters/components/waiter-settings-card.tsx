'use client';

import { useTranslations } from 'next-intl';

import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useUpdateCurrentOrganizationSettings } from '@/hooks/use-organizations';
import { useAuthStore } from '@/stores/auth-store';
import type { OrganizationWaiterSettings } from '@/types/waiter';

/**
 * Einstellungen der Bedienungen (nur Admins): PIN-Länge neuer PINs, Name
 * auf Bons, fremde Tische. Die Kellnerbrieftasche folgt nach der Antwort
 * des Steuerberaters.
 */
export function WaiterSettingsCard() {
  const t = useTranslations('waiters.settings');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { currentOrganization } = useAuthStore();
  const update = useUpdateCurrentOrganizationSettings();
  const current: OrganizationWaiterSettings = currentOrganization?.organization?.settings?.waiters ?? {};

  const save = (patch: OrganizationWaiterSettings) =>
    update.mutate(
      { waiters: { ...current, ...patch } },
      {
        onSuccess: () => toast.success(t('saved')),
        onError: (error) => toast.error(apiErrorMessage(error, tCommon('saveFailed'))),
      },
    );

  return (
    <section className="app-card app-card--flat waiters-settings" aria-labelledby="waiter-settings-title">
      <div className="app-card__head">
        <div>
          <h2 id="waiter-settings-title" className="waiters-settings__title">
            {t('title')}
          </h2>
          <p className="waiters-form__hint">{t('description')}</p>
        </div>
      </div>
      <div className="waiters-settings__grid">
        <label className="auth-field">
          <span>{t('pinLength')}</span>
          <select
            className="select"
            value={current.pinLength ?? 4}
            disabled={update.isPending}
            onChange={(e) => save({ pinLength: Number(e.target.value) === 6 ? 6 : 4 })}
          >
            <option value={4}>{t('pinLength4')}</option>
            <option value={6}>{t('pinLength6')}</option>
          </select>
        </label>
        <label className="auth-field">
          <span>{t('receiptName')}</span>
          <select
            className="select"
            value={current.receiptName ?? 'short'}
            disabled={update.isPending}
            onChange={(e) => save({ receiptName: e.target.value === 'full' ? 'full' : 'short' })}
          >
            <option value="short">{t('receiptNameShort')}</option>
            <option value="full">{t('receiptNameFull')}</option>
          </select>
        </label>
        <label className="auth-field">
          <span>{t('foreignTables')}</span>
          <select
            className="select"
            value={current.foreignTables ?? 'warn'}
            disabled={update.isPending}
            onChange={(e) => save({ foreignTables: e.target.value === 'allow' ? 'allow' : 'warn' })}
          >
            <option value="warn">{t('foreignTablesWarn')}</option>
            <option value="allow">{t('foreignTablesAllow')}</option>
          </select>
        </label>
        <label className="auth-field">
          <span>{t('selfSettlement')}</span>
          <select
            className="select"
            value={current.selfSettlement ? 'self' : 'lead'}
            disabled={update.isPending}
            onChange={(e) => save({ selfSettlement: e.target.value === 'self' })}
          >
            <option value="lead">{t('selfSettlementLead')}</option>
            <option value="self">{t('selfSettlementSelf')}</option>
          </select>
        </label>
      </div>
    </section>
  );
}
