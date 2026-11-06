'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ConfirmDialog } from '@/components/shared/operating-mode-notices';
import { toast } from '@/components/shared/toast';
import { refreshCurrentUser } from '@/components/privacy/organization-closure-banner';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { Link } from '@/i18n/routing';
import { apiClient, privacyApi } from '@/lib/api-client';
import { quotedNames } from '@/lib/privacy';
import { useAuthStore } from '@/stores/auth-store';
import { SettingsSectionHead } from '@/app/[locale]/(dashboard)/settings/components/settings-section-head';

/**
 * „Konto löschen“ (Löschkonzept 5.1). Zeigt vorab, was das Löschen sperrt
 * (letzter Admin einer Organisation mit Mitgliedern oder laufenden
 * Veranstaltungen) und welche Organisationen mitgelöscht werden. Bestätigt
 * wird mit dem Passwort bzw. einem Code per E-Mail; danach ist man
 * abgemeldet.
 *
 * Geht eine Organisation mit (einziges Mitglied), ist die Löschung geplant:
 * Konto und Organisation werden erst zum Ende der Exportfrist endgültig
 * gelöscht, bis dahin bleibt man angemeldet und kann exportieren oder die
 * Löschung abbrechen.
 */
export function AccountDeletionCard() {
  const t = useTranslations('privacy.accountDeletion');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const { formatDate } = useLocaleFormat();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [done, setDone] = useState(false);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['users', 'me', 'deletion'],
    queryFn: async () => (await privacyApi.accountDeletionStatus()).data,
  });

  const sendCode = useMutation({
    mutationFn: () => privacyApi.sendAccountDeletionCode(),
    onSuccess: () => {
      setCodeSent(true);
      toast.success(t('codeSent'));
    },
    onError: (err) => toast.error(apiErrorMessage(err, tCommon('error'))),
  });

  const remove = useMutation({
    mutationFn: () =>
      privacyApi.deleteAccount(
        status?.confirmation === 'password' ? { password: secret } : { code: secret.trim() },
      ),
    onSuccess: async (response) => {
      const result = response.data;
      if (result.scheduled) {
        // Konto bleibt bis zum Termin: Hinweis oben, Export, Abbrechen.
        close();
        toast.success(t('scheduledToast', { date: formatDate(result.dueAt) }));
        await refreshCurrentUser();
        void queryClient.invalidateQueries();
        return;
      }
      setDone(true);
      apiClient.clearAccessToken();
      useAuthStore.getState().reset();
      window.setTimeout(() => {
        window.location.href = '/login';
      }, 2500);
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, tCommon('error')));
      void refetch();
    },
  });

  const cancel = useMutation({
    mutationFn: async () => {
      await privacyApi.cancelAccountDeletion();
      await refreshCurrentUser();
    },
    onSuccess: () => {
      toast.success(t('cancelled'));
      void queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(apiErrorMessage(err, tCommon('error'))),
  });

  const schedules = (status?.closesOrganizations.length ?? 0) > 0;
  const closesNames = quotedNames(status?.closesOrganizations ?? []);
  const closesCount = Math.max(status?.closesOrganizations.length ?? 0, 1);
  const scheduledDate = formatDate(status?.scheduledDeletionAt ?? null);

  const close = () => {
    setOpen(false);
    setSecret('');
  };

  return (
    <div className="app-card privacy-danger" data-testid="account-deletion-card">
      <SettingsSectionHead icon="trash-2" title={t('title')} description={t('description')} />

      {status?.superAdmin && <p className="privacy-muted">{t('superAdmin')}</p>}

      {status?.scheduled && (
        <div className="oe-banner oe-banner--warn" role="status" data-testid="account-deletion-scheduled">
          <div>
            <b>
              {t('scheduledTitle', {
                date: formatDate(status.scheduled.dueAt),
                names: quotedNames(status.scheduled.organizations),
                count: Math.max(status.scheduled.organizations.length, 1),
              })}
            </b>
            <p style={{ margin: '4px 0 0', fontSize: 13 }}>{t('scheduledText')}</p>
          </div>
        </div>
      )}

      {status && status.blockers.length > 0 && (
        <div data-testid="account-deletion-blockers">
          <p style={{ fontSize: 13, margin: 0, fontWeight: 600 }}>{t('blockedTitle')}</p>
          <ul className="privacy-list">
            {status.blockers.map((b) => (
              <li key={b.organizationId}>
                <b>{b.name}</b>: {t(`blockers.${b.reason}`)}
              </li>
            ))}
          </ul>
          <p className="privacy-muted" style={{ marginTop: 8 }}>
            {t('blockedHint')}{' '}
            <Link href="/members">{t('toMembers')}</Link>
          </p>
        </div>
      )}

      {status?.unclosedTransactions && <p className="privacy-muted">{t('unclosed')}</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        {status?.scheduled ? (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
            data-testid="account-deletion-cancel"
          >
            {t('cancel')}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--danger"
            disabled={isLoading || !status?.allowed}
            onClick={() => setOpen(true)}
            data-testid="account-deletion-open"
          >
            {t('open')}
          </button>
        )}
      </div>

      {open && status && (
        <ConfirmDialog
          id="account-deletion-dialog"
          title={done ? t('doneTitle') : t(schedules ? 'dialogTitleScheduled' : 'dialogTitle')}
          confirmLabel={t('confirm')}
          pending={remove.isPending || done}
          danger
          confirmDisabled={secret.trim().length === 0}
          onConfirm={() => remove.mutate()}
          onCancel={close}
        >
          {done ? (
            <p style={{ margin: 0 }} data-testid="account-deletion-done">{t('done')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {schedules && (
                <div className="oe-banner oe-banner--warn" role="status" data-testid="account-deletion-closes">
                  <div>
                    <b>{t('closesTitle', { count: closesCount })}</b>
                    <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                      {t('closesText', { names: closesNames, count: closesCount, date: scheduledDate })}
                    </p>
                  </div>
                </div>
              )}
              <p style={{ margin: 0, fontSize: 14 }}>{t('dialogText')}</p>
              {schedules ? (
                <ul className="privacy-list" style={{ marginTop: 0 }} data-testid="account-deletion-scheduled-steps">
                  <li>{t('scheduledSteps.until', { date: scheduledDate, count: closesCount })}</li>
                  <li>{t('scheduledSteps.now')}</li>
                  <li>{t('scheduledSteps.final', { date: scheduledDate, count: closesCount })}</li>
                  <li>{t('scheduledSteps.cancel')}</li>
                  <li>{t('what.fiscal')}</li>
                </ul>
              ) : (
                <ul className="privacy-list" style={{ marginTop: 0 }}>
                  <li>{t('what.account')}</li>
                  <li>{t('what.memberships')}</li>
                  <li>{t('what.fiscal')}</li>
                </ul>
              )}
              {status.confirmation === 'password' ? (
                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="account-deletion-password">
                    {t('password')}
                  </label>
                  <input
                    id="account-deletion-password"
                    type="password"
                    className="input"
                    autoComplete="current-password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                  />
                </div>
              ) : (
                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="account-deletion-code">
                    {t('code')}
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="account-deletion-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="input"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => sendCode.mutate()}
                      disabled={sendCode.isPending}
                    >
                      {codeSent ? t('resendCode') : t('sendCode')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
