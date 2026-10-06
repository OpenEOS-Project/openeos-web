'use client';

import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import {
  integrationDocsUrl,
  integrationHref,
  isIntegrationEnabled,
  type IntegrationDefinition,
} from '@/config/integrations';
import { useIntegrationErrorMessage, useSetIntegrationEnabled } from '@/hooks/use-integrations';
import { Link } from '@/i18n/routing';
import { useAuthStore } from '@/stores/auth-store';

import { IntegrationGallery } from './integration-gallery';
import { IntegrationLogo } from './integration-logo';
import { IntegrationStatusBadge } from './integration-status-badge';

interface IntegrationInfoDialogProps {
  integration: IntegrationDefinition;
  onClose: () => void;
}

/**
 * Infofenster einer Integration: was sie tut, was man dafür braucht, wo es
 * dokumentiert ist — und der Schalter. Eingerichtet wird hier bewusst nichts;
 * das passiert auf der eigenen Seite, die nach dem Einschalten in der
 * Seitenleiste auftaucht.
 */
export function IntegrationInfoDialog({ integration, onClose }: IntegrationInfoDialogProps) {
  const t = useTranslations('integrations');
  const locale = useLocale();
  const settings = useAuthStore((state) => state.currentOrganization?.organization?.settings);
  const enabled = isIntegrationEnabled(settings, integration.id);
  const toggle = useSetIntegrationEnabled();
  const errorMessage = useIntegrationErrorMessage();
  const panelRef = useRef<HTMLDivElement>(null);
  // Über eine Ref, damit der Effekt unten nur beim Öffnen läuft — sonst
  // spränge der Fokus bei jedem neuen onClose der Elternkomponente zurück.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const titleId = `integration-${integration.id}-title`;
  const docsUrl = integrationDocsUrl(integration, locale);

  // Escape schließt; der Fokus wandert ins Fenster und beim Schließen zurück
  // auf die Karte, von der aus es geöffnet wurde.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('.modal__close')?.focus();

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="modal__overlay" onClick={onClose}>
      <ModalPanel titleId={titleId} className="modal__panel--lg integration-info">
        <div ref={panelRef} className="integration-info__inner">
          <div className="modal__head">
            <div className="integration-info__title">
              <IntegrationLogo name={integration.name} color={integration.color} logo={integration.logo} />
              <div style={{ minWidth: 0 }}>
                <h2 id={titleId}>{integration.name}</h2>
                <div className="integration-card__vendor">{t(integration.vendorKey)}</div>
              </div>
              <IntegrationStatusBadge available={integration.available} enabled={enabled} />
            </div>
            <DialogCloseButton onClick={onClose} />
          </div>

          <div className="modal__body integration-info__body">
            <IntegrationGallery screenshots={integration.screenshots} />

            <section>
              <h3 className="integration-info__heading">{t('info.whatItDoes')}</h3>
              <p className="integration-info__text">{t(integration.longDescriptionKey)}</p>
            </section>

            {integration.requirementKeys.length > 0 && (
              <section>
                <h3 className="integration-info__heading">{t('info.requirements')}</h3>
                <ul className="integration-info__list">
                  {integration.requirementKeys.map((key) => (
                    <li key={key}>{t(key)}</li>
                  ))}
                </ul>
              </section>
            )}

            {docsUrl && (
              <a
                href={docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="integration-info__docs"
              >
                {t('info.docs')}
                <ExternalLink aria-hidden="true" />
              </a>
            )}

            {toggle.isError && (
              <div role="alert" className="integration-info__error">
                {errorMessage(toggle.error, t('errors.toggleFailed'))}
              </div>
            )}
          </div>

          <div className="modal__foot integration-info__foot">
            {!integration.available ? (
              <>
                <p className="integration-info__hint">{t('info.comingSoonHint')}</p>
                <button type="button" className="btn btn--ghost" onClick={onClose}>
                  {t('actions.close')}
                </button>
              </>
            ) : enabled ? (
              <>
                <p className="integration-info__hint">{t('info.settingsKept')}</p>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => toggle.mutate({ id: integration.id, enabled: false })}
                  disabled={toggle.isPending}
                >
                  {toggle.isPending ? t('actions.deactivating') : t('actions.deactivate')}
                </button>
                <Link
                  href={integrationHref(integration.id) as never}
                  className="btn btn--primary"
                  onClick={onClose}
                >
                  {t('actions.configure')}
                </Link>
              </>
            ) : (
              <>
                <p className="integration-info__hint">{t('info.activateHint')}</p>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => toggle.mutate({ id: integration.id, enabled: true })}
                  disabled={toggle.isPending}
                >
                  {toggle.isPending ? t('actions.activating') : t('actions.activate')}
                </button>
              </>
            )}
          </div>
        </div>
      </ModalPanel>
    </div>
  );
}
