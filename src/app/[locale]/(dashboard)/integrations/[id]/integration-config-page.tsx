'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { IntegrationLogo } from '@/components/integrations/integration-logo';
import { DetailPageHead } from '@/components/shared/detail-page-head';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { IntegrationGuard } from '@/components/shared/integration-guard';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';
import { getIntegration, integrationAvailability, isIntegrationEnabled } from '@/config/integrations';
import {
  useIntegrationErrorMessage,
  useIntegrationOrganization,
  useSetIntegrationEnabled,
} from '@/hooks/use-integrations';
import type { IntegrationId } from '@/types/organization';

interface IntegrationConfigPageProps {
  id: IntegrationId;
}

export function IntegrationConfigPage({ id }: IntegrationConfigPageProps) {
  return (
    <IntegrationGuard id={id}>
      <IntegrationConfigContent id={id} />
    </IntegrationGuard>
  );
}

function IntegrationConfigContent({ id }: IntegrationConfigPageProps) {
  const t = useTranslations('integrations');
  const tCommon = useTranslations('common');
  const integration = getIntegration(id);
  const toggle = useSetIntegrationEnabled();
  const errorMessage = useIntegrationErrorMessage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const organization = useIntegrationOrganization();
  // Cloud-TSE: Ausschalten erst nach dem endgültigen Deaktivieren der TSE
  // (sonst 409 TSE_ACTIVE_DEACTIVATE_FIRST). Die Rückfrage sagt das vorher.
  const blocked = !!integration?.deactivateBlocked?.(organization);
  // Ausgeschaltet erreichbar (pageWhenDisabled): oben „Aktivieren“ statt
  // „Deaktivieren“ — sofern die Integration hier überhaupt geht.
  const enabled = isIntegrationEnabled(organization?.settings, id);
  const canEnable = !!integration && integrationAvailability(integration, organization) === 'available';

  useEffect(() => {
    if (!confirmOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !toggle.isPending) setConfirmOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirmOpen, toggle.isPending]);

  if (!integration?.ConfigComponent) return null;
  const { ConfigComponent } = integration;
  const name = integration.nameKey ? t(integration.nameKey) : integration.name;

  // Kein eigener Rücksprung: der Guard sieht die ausgeschaltete Integration
  // im Store und leitet in den Katalog um (bei `pageWhenDisabled` bleibt
  // die Seite und zeigt den ausgeschalteten Zustand). Deshalb mutateAsync statt der
  // Rückrufe von mutate — die entfallen, sobald die Seite ausgehängt ist.
  const deactivate = async () => {
    try {
      await toggle.mutateAsync({ id, enabled: false });
      toast.success(t('deactivated', { name }));
    } catch (error) {
      toast.error(errorMessage(error, t('errors.toggleFailed')));
    }
  };

  return (
    <div>
      <DetailPageHead
        backHref="/integrations"
        backLabel={t('backToCatalog')}
        logo={<IntegrationLogo name={integration.name} color={integration.color} logo={integration.logo} />}
        title={name}
        meta={t(integration.shortDescriptionKey)}
        actions={
          enabled ? (
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmOpen(true)}>
              {t('actions.deactivate')}
            </button>
          ) : canEnable ? (
            <button
              type="button"
              className="btn btn--primary"
              disabled={toggle.isPending}
              onClick={() =>
                toggle.mutate(
                  { id, enabled: true },
                  { onError: (error) => toast.error(errorMessage(error, t('errors.toggleFailed'))) },
                )
              }
              data-testid="integration-activate"
            >
              {toggle.isPending ? t('actions.activating') : t('actions.activate')}
            </button>
          ) : null
        }
      />

      <ConfigComponent />

      {confirmOpen && (
        <div className="modal__overlay" onClick={() => !toggle.isPending && setConfirmOpen(false)}>
          <ModalPanel titleId="integration-deactivate-title" className="modal__panel--sm">
            <div className="modal__head">
              <h2 id="integration-deactivate-title">
                {t('confirmDeactivate.title', { name })}
              </h2>
              <DialogCloseButton onClick={() => setConfirmOpen(false)} />
            </div>
            <div className="modal__body">
              {blocked && integration.deactivateBlockedKey ? (
                <p className="integration-info__text" data-testid="integration-deactivate-blocked">
                  {t(integration.deactivateBlockedKey)}
                </p>
              ) : (
                <>
                  {integration.deactivateEffectKey && (
                    <p className="integration-info__text" style={{ marginBottom: 8 }}>
                      {t(integration.deactivateEffectKey)}
                    </p>
                  )}
                  <p className="integration-info__text">
                    {t('info.settingsKept')}
                  </p>
                </>
              )}
            </div>
            <div className="modal__foot">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={toggle.isPending}
              >
                {tCommon('cancel')}
              </button>
              {blocked ? (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setConfirmOpen(false);
                    document.getElementById('integration-danger-zone')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {t('actions.toDangerZone')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--primary"
                  style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                  onClick={deactivate}
                  disabled={toggle.isPending}
                >
                  {toggle.isPending ? t('actions.deactivating') : t('actions.deactivate')}
                </button>
              )}
            </div>
          </ModalPanel>
        </div>
      )}
    </div>
  );
}
