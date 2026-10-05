'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from '@untitledui/icons';

import { IntegrationLogo } from '@/components/integrations/integration-logo';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { IntegrationGuard } from '@/components/shared/integration-guard';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';
import { getIntegration } from '@/config/integrations';
import { useIntegrationErrorMessage, useSetIntegrationEnabled } from '@/hooks/use-integrations';
import { Link } from '@/i18n/routing';
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

  // Kein eigener Rücksprung: der Guard sieht die ausgeschaltete Integration
  // im Store und leitet in den Katalog um. Deshalb mutateAsync statt der
  // Rückrufe von mutate — die entfallen, sobald die Seite ausgehängt ist.
  const deactivate = async () => {
    try {
      await toggle.mutateAsync({ id, enabled: false });
      toast.success(t('deactivated', { name: integration.name }));
    } catch (error) {
      toast.error(errorMessage(error, t('errors.toggleFailed')));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Link href="/integrations" className="integration-page__back">
          <ArrowLeft aria-hidden="true" />
          {t('backToCatalog')}
        </Link>
      </div>

      <div className="app-page-head" style={{ marginBottom: 0 }}>
        <div className="integration-page__title">
          <IntegrationLogo name={integration.name} color={integration.color} logo={integration.logo} />
          <div className="app-page-head__copy">
            <h1 className="app-page-head__title">{integration.name}</h1>
            <p className="app-page-head__sub">{t(integration.shortDescriptionKey)}</p>
          </div>
        </div>
        <div className="app-page-head__actions">
          <button type="button" className="btn btn--ghost" onClick={() => setConfirmOpen(true)}>
            {t('actions.deactivate')}
          </button>
        </div>
      </div>

      <ConfigComponent />

      {confirmOpen && (
        <div className="modal__overlay" onClick={() => !toggle.isPending && setConfirmOpen(false)}>
          <ModalPanel titleId="integration-deactivate-title" className="modal__panel--sm">
            <div className="modal__head">
              <h2 id="integration-deactivate-title">
                {t('confirmDeactivate.title', { name: integration.name })}
              </h2>
              <DialogCloseButton onClick={() => setConfirmOpen(false)} />
            </div>
            <div className="modal__body">
              {integration.deactivateEffectKey && (
                <p className="integration-info__text" style={{ marginBottom: 8 }}>
                  {t(integration.deactivateEffectKey)}
                </p>
              )}
              <p className="integration-info__text">
                {t('info.settingsKept')}
              </p>
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
              <button
                type="button"
                className="btn btn--primary"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={deactivate}
                disabled={toggle.isPending}
              >
                {toggle.isPending ? t('actions.deactivating') : t('actions.deactivate')}
              </button>
            </div>
          </ModalPanel>
        </div>
      )}
    </div>
  );
}
