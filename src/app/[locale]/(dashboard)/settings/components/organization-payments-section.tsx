'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banner, Icon } from '@openeos/ui';

import { CashTseNotice } from '@/components/shared/cash-tse-notice';
import { SettingToggle } from '@/components/shared/setting-toggle';
import { toast } from '@/components/shared/toast';
import { isIntegrationEnabled } from '@/config/integrations';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { usePermissions } from '@/hooks/use-permissions';
import { Link } from '@/i18n/routing';
import { organizationsApi } from '@/lib/api-client';
import { cashlessSwitchStep, isCashlessMode, type CashlessSwitchEvent } from '@/lib/cashless';
import { useAuthStore } from '@/stores/auth-store';

import { CashlessOffDialog } from './cashless-off-dialog';

/**
 * Zahlungen der Organisation: der bargeldlose Modus.
 *
 * Eingeschaltet sperrt die API jeden Bargeldweg (Zahlung, Erstattung,
 * Pfand-Auszahlung, Kassenlade); die Kassen stellen sich per Socket sofort
 * um. Ausgeschaltet (Standard) steht hier der Hinweis zu Bargeld und TSE.
 * Ausschalten (Bargeld wieder erlauben) braucht eine Bestätigung, weil
 * Bargeld eine TSE voraussetzt; Einschalten speichert sofort.
 * Nur Admins dürfen schalten — die API prüft das ebenfalls und protokolliert
 * jede Umschaltung mit Zeitpunkt und Person; der Verlauf steht darunter
 * (Nachweis, seit wann die Kassen kein Bargeld annehmen).
 */
export function OrganizationPaymentsSection() {
  const t = useTranslations('settings.organizationPayments');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const { isAdmin } = usePermissions();
  const { formatDate, formatDateTime } = useLocaleFormat();
  const queryClient = useQueryClient();
  const organizationId = currentOrganization?.organizationId ?? '';
  const [confirmOff, setConfirmOff] = useState(false);

  const history = useQuery({
    queryKey: ['cashless-history', organizationId],
    queryFn: async () => (await organizationsApi.getCashlessHistory(organizationId)).data,
    enabled: !!organizationId,
  });

  /* Speichert sofort, wie der Steuer-Schalter — über den eigenen Endpunkt,
     der die Umschaltung protokolliert (der allgemeine Einstellungs-Endpunkt
     ignoriert `payments`). */
  const updateCashless = useMutation({
    mutationFn: async (cashless: boolean) => {
      if (!currentOrganization) throw new Error('No organization');
      const response = await organizationsApi.setCashlessMode(currentOrganization.organizationId, cashless);
      return response.data;
    },
    onSuccess: (data) => {
      if (currentOrganization?.organization) {
        setCurrentOrganization({ ...currentOrganization, organization: data });
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['cashless-history', organizationId] });
      toast.success(data.settings?.payments?.cashless ? t('savedOn') : t('savedOff'));
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, tCommon('error')));
    },
  });

  const { mutate: saveCashless } = updateCashless;
  const onSwitch = useCallback(
    (event: CashlessSwitchEvent) => {
      const step = cashlessSwitchStep(confirmOff, event);
      setConfirmOff(step.confirmOff);
      if (step.save === null) return;
      // Die Rückfrage schließt erst nach dem Speichern; bei einem Fehler
      // bleibt sie offen (Toast), Abbrechen geht dann weiter.
      saveCashless(step.save, { onSuccess: () => setConfirmOff(false) });
    },
    [confirmOff, saveCashless]
  );
  const cancelConfirmOff = useCallback(() => onSwitch({ type: 'cancel' }), [onSwitch]);

  if (!currentOrganization) return null;

  const settings = currentOrganization.organization?.settings;
  const cashless = isCashlessMode(settings);
  const changedAt = settings?.payments?.changedAt;
  const sumupEnabled = isIntegrationEnabled(settings, 'sumup');

  return (
    <div className="app-card">
      <div className="app-card__head" style={{ display: 'block' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{t('title')}</h2>
        <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', margin: '4px 0 0' }}>
          {t('description')}
        </p>
      </div>

      <div className="app-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SettingToggle
          label={t('cashless.label')}
          hint={t('cashless.hint')}
          checked={cashless}
          disabled={!isAdmin || updateCashless.isPending}
          onChange={(checked) => onSwitch({ type: 'toggle', checked })}
        />

        {cashless && changedAt && (
          <p className="cashless-since">{t('since', { date: formatDate(changedAt) })}</p>
        )}

        {!isAdmin && (
          <p style={{ fontSize: 12, color: 'var(--mute)', margin: 0 }}>{t('adminOnly')}</p>
        )}

        {cashless && (
          <ul className="cashless-effects">
            <li>{t('cashless.effects.pay')}</li>
            <li>{t('cashless.effects.refund')}</li>
            <li>{t('cashless.effects.pfand')}</li>
            <li>{t('cashless.effects.drawer')}</li>
          </ul>
        )}

        {/* Ohne SumUp bleibt im bargeldlosen Modus an der Kasse keine
            Zahlart — speichern geht trotzdem (z. B. reiner Online-Shop). */}
        {cashless && !sumupEnabled && (
          <Banner tone="warn" icon={<Icon name="alert" />} title={t('noSumup.title')}>
            {t('noSumup.text')}{' '}
            <Link href="/integrations" className="cash-tse-notice__link">
              {t('noSumup.action')}
            </Link>
          </Banner>
        )}

        {!cashless && <CashTseNotice />}

        {(history.data?.length ?? 0) > 0 && (
          <div className="cashless-history">
            <span className="cashless-history__title">{t('history.title')}</span>
            <ul>
              {history.data!.map((entry) => (
                <li key={entry.id}>
                  <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                  <span>
                    {entry.cashless ? t('history.on') : t('history.off')}
                    {entry.changedByName ? ` · ${entry.changedByName}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {confirmOff && (
        <CashlessOffDialog
          pending={updateCashless.isPending}
          onConfirm={() => onSwitch({ type: 'confirm' })}
          onCancel={cancelConfirmOff}
        />
      )}
    </div>
  );
}
