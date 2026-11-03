'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { IntegrationInfoDialog } from '@/components/integrations/integration-info-dialog';
import { IntegrationLogo } from '@/components/integrations/integration-logo';
import { IntegrationStatusBadge } from '@/components/integrations/integration-status-badge';
import {
  INTEGRATIONS,
  integrationAvailability,
  integrationName,
  isIntegrationEnabled,
  type IntegrationDefinition,
} from '@/config/integrations';
import { useIntegrationOrganization } from '@/hooks/use-integrations';

/**
 * Katalog der Integrationen.
 *
 * Hier wird nur ein- und ausgeschaltet (die Cloud-TSE zeigt zusätzlich,
 * woran es gerade hängt, mit der passenden Aktion). Die Einrichtung saß früher
 * aufgeklappt in der Karte; jetzt bekommt jede aktive Integration eine eigene
 * Seite mit Eintrag in der Seitenleiste — die Karte öffnet nur noch das
 * Infofenster mit Beschreibung, Bildern und Schalter.
 */
export function IntegrationsContainer() {
  const t = useTranslations('integrations');
  const organization = useIntegrationOrganization();
  const settings = organization?.settings;
  const [selected, setSelected] = useState<IntegrationDefinition | null>(null);

  return (
    <>
      <div className="integration-grid">
        {INTEGRATIONS.map((integration) => {
          const enabled = isIntegrationEnabled(settings, integration.id);
          const { CatalogHint } = integration;
          return (
            // Die Karte ist ein Rahmen mit zwei Teilen: oben der Knopf fürs
            // Infofenster, unten (falls vorhanden) der konkrete Grund mit
            // eigener Aktion — Links und Schalter dürfen nicht im <button> stecken.
            <div key={integration.id} className="integration-card integration-card--framed">
              <button
                type="button"
                className="integration-card__open"
                onClick={() => setSelected(integration)}
                aria-haspopup="dialog"
              >
                <span className="integration-card__head">
                  <IntegrationLogo
                    name={integrationName(integration, t)}
                    color={integration.color}
                    logo={integration.logo}
                  />
                  <span className="integration-card__copy">
                    <span className="integration-card__name">{integrationName(integration, t)}</span>
                    <span className="integration-card__vendor">{t(integration.vendorKey)}</span>
                  </span>
                  <IntegrationStatusBadge
                    availability={integrationAvailability(integration, organization)}
                    enabled={enabled}
                    setupState={integration.setupState?.(organization)}
                  />
                </span>
                <span className="integration-card__desc">{t(integration.shortDescriptionKey)}</span>
              </button>
              {CatalogHint && integration.available && <CatalogHint placement="card" />}
            </div>
          );
        })}
      </div>

      {selected && (
        <IntegrationInfoDialog integration={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
