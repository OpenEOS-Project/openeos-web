'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ConfirmDialog } from '@/components/shared/operating-mode-notices';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { authApi, organizationsApi } from '@/lib/api-client';
import { confirmationMatches, isReadOnlyOrganization } from '@/lib/privacy';
import { useAuthStore } from '@/stores/auth-store';
import { SettingsSectionHead } from '@/app/[locale]/(dashboard)/settings/components/settings-section-head';

/**
 * „Organisation löschen“ für Admins (AGB 10.4, 15.10): danach 30 Tage nur
 * lesend mit Export, dann endgültige Löschung; das Steuerarchiv bleibt.
 * Bestätigung durch Eintippen des Namens.
 */
export function OrganizationDeleteCard() {
  const t = useTranslations('privacy.organizationDeletion');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const current = useAuthStore((s) => s.currentOrganization);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const remove = useMutation({
    mutationFn: async () => {
      await organizationsApi.delete(current!.organizationId);
      // Mitgliedschaften neu laden: die Organisation kommt mit `closure` zurück.
      const me = await authApi.me();
      useAuthStore.getState().setOrganizations(me.data.user.userOrganizations || []);
    },
    onSuccess: () => {
      setOpen(false);
      setTyped('');
      toast.success(t('deleted'));
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, tCommon('error'))),
  });

  const organization = current?.organization;
  if (!current || current.role !== 'admin' || !organization || isReadOnlyOrganization(organization)) {
    return null;
  }

  return (
    <div className="app-card privacy-danger" style={{ marginTop: 20 }} data-testid="organization-delete-card">
      <SettingsSectionHead icon="trash-2" title={t('title')} description={t('description')} />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--danger" onClick={() => setOpen(true)} data-testid="organization-delete-open">
          {t('open')}
        </button>
      </div>
      {open && (
        <ConfirmDialog
          id="organization-delete-dialog"
          title={t('dialogTitle', { name: organization.name })}
          confirmLabel={t('confirm')}
          pending={remove.isPending}
          danger
          confirmDisabled={!confirmationMatches(organization.name, typed)}
          onConfirm={() => remove.mutate()}
          onCancel={() => {
            setOpen(false);
            setTyped('');
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ul className="privacy-list" style={{ marginTop: 0 }}>
              <li>{t('steps.readOnly')}</li>
              <li>{t('steps.final')}</li>
              <li>{t('steps.fiscal')}</li>
            </ul>
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="organization-delete-name">
                {t('typeName')}
              </label>
              <p className="privacy-muted" style={{ margin: '0 0 6px' }}>
                <b style={{ color: 'var(--ink)', userSelect: 'all' }}>{organization.name}</b>
              </p>
              <input
                id="organization-delete-name"
                className="input"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            </div>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
