'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import { toast } from '@/components/shared/toast';
import { ToggleSwitch } from '@/components/shared/toggle-switch';
import type { IntegrationCatalogHintProps } from '@/config/integrations';
import { useIntegrationErrorMessage, useSetIntegrationEnabled } from '@/hooks/use-integrations';
import { useTseSetup } from '@/hooks/use-tse';
import { Link } from '@/i18n/routing';
import type { TseSetupStep } from '@/lib/tse';
import { useAuthStore } from '@/stores/auth-store';

import { TseStepHint } from './tse-step-hint';

/** Server, Land und Schalter erklärt das Infofenster schon unten an seinem Knopf. */
const FOOTER_STEPS = new Set<TseSetupStep>(['unavailable', 'coming_soon', 'country_missing', 'country', 'integration_disabled']);

/**
 * Cloud-TSE im Katalog: woran sie gerade hängt und was als Nächstes zu tun
 * ist, dazu der Weg zur ganzen Checkliste auf /integrations/tse (die Seite
 * gibt es auch ausgeschaltet).
 */
export function TseCatalogHint({ placement, onNavigate }: IntegrationCatalogHintProps) {
  const t = useTranslations('integrations');
  const organizationId = useAuthStore((state) => state.currentOrganization?.organizationId);
  const setup = useTseSetup(organizationId);
  const toggle = useSetIntegrationEnabled();
  const errorMessage = useIntegrationErrorMessage();

  const { step } = setup;
  // Läuft sie, sagt das Badge genug.
  if (!step || step === 'active') return null;
  if (placement === 'dialog' && FOOTER_STEPS.has(step)) return null;

  const setupLink = (
    <Link href="/integrations/tse" className="btn btn--primary btn--xs" onClick={onNavigate} data-testid="tse-hint-setup">
      <Icon name="arrow-right" size={14} />
      {step === 'failed' ? t('tse.hint.failed.action') : t('tse.hint.ready.action')}
    </Link>
  );

  const enableSwitch = (
    <label className="tse-hint__switch">
      <ToggleSwitch
        checked={setup.input.integrationEnabled}
        disabled={toggle.isPending}
        onChange={(checked) =>
          toggle.mutate(
            { id: 'tse', enabled: checked },
            { onError: (error) => toast.error(errorMessage(error, t('errors.toggleFailed'))) },
          )
        }
      />
      <span>{t('tse.hint.integrationDisabled.action')}</span>
    </label>
  );

  // Die ganze Checkliste — nur sinnvoll, wenn die TSE hier überhaupt geht.
  const details =
    placement === 'card' &&
    step !== 'unavailable' &&
    step !== 'coming_soon' &&
    step !== 'country' &&
    step !== 'ready' &&
    step !== 'failed' ? (
      <Link href="/integrations/tse" className="notice-link tse-hint__details" onClick={onNavigate} data-testid="tse-hint-details">
        {t('tse.hint.details')}
      </Link>
    ) : null;

  return (
    <TseStepHint
      step={step}
      eventCheck={setup.eventCheck}
      unlockEvent={setup.unlockEvent}
      variant={placement === 'card' ? 'card' : 'banner'}
      onNavigate={onNavigate}
      actions={{ setup: setupLink, retry: setupLink, enable: enableSwitch }}
      extra={details}
    />
  );
}
