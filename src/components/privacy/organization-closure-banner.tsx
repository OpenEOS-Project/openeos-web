'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@openeos/ui';

import { ConfirmDialog } from '@/components/shared/operating-mode-notices';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { authApi, organizationsApi, privacyApi } from '@/lib/api-client';
import {
  accountDeletionScheduled,
  finalDeletionDue,
  isReadOnlyOrganization,
  quotedNames,
} from '@/lib/privacy';
import { useAuthStore } from '@/stores/auth-store';

/** Benutzer und Mitgliedschaften neu laden (nach Löschen bzw. Abbrechen). */
export async function refreshCurrentUser(): Promise<void> {
  const me = await authApi.me();
  const store = useAuthStore.getState();
  store.setUser(me.data.user);
  store.setOrganizations(me.data.user.userOrganizations || []);
}

/**
 * Hinweis über jeder Seite einer gelöschten Organisation (AGB 10.4): bis zur
 * endgültigen Löschung ist sie nur noch lesend nutzbar, Exporte gehen
 * weiter. Die API lehnt jede Änderung ab (ORGANIZATION_READ_ONLY) – der
 * Hinweis erklärt, warum. Admins können die Löschung bis dahin abbrechen.
 *
 * Ist die Löschung des eigenen Kontos geplant (einziges Mitglied), steht
 * stattdessen der Hinweis zur Kontolöschung da – auf allen Seiten.
 */
export function OrganizationClosureBanner() {
  const t = useTranslations('privacy.closure');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const { formatDate } = useLocaleFormat();
  const user = useAuthStore((s) => s.user);
  const current = useAuthStore((s) => s.currentOrganization);
  const [confirming, setConfirming] = useState(false);

  const restore = useMutation({
    mutationFn: async () => {
      await organizationsApi.restore(current!.organizationId);
      await refreshCurrentUser();
    },
    onSuccess: () => {
      setConfirming(false);
      toast.success(t('restored'));
      void queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(apiErrorMessage(err, tCommon('error'))),
  });

  if (accountDeletionScheduled(user)) return <AccountDeletionBanner />;

  const organization = current?.organization;
  if (!organization || !isReadOnlyOrganization(organization)) return null;
  const closure = organization.closure!;
  const due = finalDeletionDue(closure);
  const canRestore = current?.role === 'admin' || user?.isSuperAdmin === true;

  return (
    <div className="oe-banner oe-banner--warn privacy-closure-banner" role="status" data-testid="organization-closure-banner">
      <span className="oe-banner__ico">
        <Icon name="alert" />
      </span>
      <div style={{ flex: 1 }}>
        <b>
          {due
            ? t('titleDue')
            : t('title', { date: formatDate(closure.finalDeletionAt) })}
        </b>
        <p style={{ margin: '4px 0 0' }}>{t('text', { closedAt: formatDate(closure.closedAt) })}</p>
        {canRestore && (
          <div className="privacy-closure-banner__actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setConfirming(true)}
              data-testid="organization-restore-open"
            >
              {t('restore')}
            </button>
          </div>
        )}
      </div>
      {confirming && (
        <ConfirmDialog
          id="organization-restore-dialog"
          title={t('restoreTitle', { name: organization.name })}
          confirmLabel={t('restore')}
          pending={restore.isPending}
          onConfirm={() => restore.mutate()}
          onCancel={() => setConfirming(false)}
        >
          <p style={{ margin: 0, fontSize: 14 }}>{t('restoreText')}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

/**
 * Konto wird mit der Organisation des einzigen Mitglieds gelöscht: Termin,
 * Export bis dahin, „Löschung abbrechen“.
 */
function AccountDeletionBanner() {
  const t = useTranslations('privacy.accountClosure');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const { formatDate } = useLocaleFormat();
  const user = useAuthStore((s) => s.user);
  const [confirming, setConfirming] = useState(false);

  const { data: status } = useQuery({
    queryKey: ['users', 'me', 'deletion'],
    queryFn: async () => (await privacyApi.accountDeletionStatus()).data,
  });

  const cancel = useMutation({
    mutationFn: async () => {
      await privacyApi.cancelAccountDeletion();
      await refreshCurrentUser();
    },
    onSuccess: () => {
      setConfirming(false);
      toast.success(t('cancelled'));
      void queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(apiErrorMessage(err, tCommon('error'))),
  });

  const scheduled = status?.scheduled ?? null;
  const dueAt = scheduled?.dueAt ?? user?.deletionDueAt ?? null;
  const organizations = scheduled?.organizations ?? [];
  const due = dueAt ? new Date(dueAt).getTime() <= Date.now() : false;
  const names = quotedNames(organizations);
  const count = Math.max(organizations.length, 1);

  return (
    <div className="oe-banner oe-banner--warn privacy-closure-banner" role="status" data-testid="account-deletion-banner">
      <span className="oe-banner__ico">
        <Icon name="alert" />
      </span>
      <div style={{ flex: 1 }}>
        <b>
          {due
            ? t('titleDue', { names, count })
            : t('title', { names, count, date: formatDate(dueAt) })}
        </b>
        <p style={{ margin: '4px 0 0' }}>{t('text', { count })}</p>
        <div className="privacy-closure-banner__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setConfirming(true)}
            data-testid="account-deletion-cancel-open"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog
          id="account-deletion-cancel-dialog"
          title={t('cancelTitle')}
          confirmLabel={t('cancel')}
          pending={cancel.isPending}
          onConfirm={() => cancel.mutate()}
          onCancel={() => setConfirming(false)}
        >
          <p style={{ margin: 0, fontSize: 14 }}>{t('cancelText', { names, count })}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
