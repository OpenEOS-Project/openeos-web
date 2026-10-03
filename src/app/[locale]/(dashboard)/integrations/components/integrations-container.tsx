'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { IntegrationInfoDialog } from '@/components/integrations/integration-info-dialog';
import { IntegrationLogo } from '@/components/integrations/integration-logo';
import { IntegrationStatusBadge } from '@/components/integrations/integration-status-badge';
import { INTEGRATIONS, isIntegrationEnabled, type IntegrationDefinition } from '@/config/integrations';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Katalog der Integrationen.
 *
 * Hier wird nur ein- und ausgeschaltet. Die Einrichtung saß früher
 * aufgeklappt in der Karte; jetzt bekommt jede aktive Integration eine eigene
 * Seite mit Eintrag in der Seitenleiste — die Karte öffnet nur noch das
 * Infofenster mit Beschreibung, Bildern und Schalter.
 */
export function IntegrationsContainer() {
  const t = useTranslations('integrations');
  const settings = useAuthStore((state) => state.currentOrganization?.organization?.settings);
  const [selected, setSelected] = useState<IntegrationDefinition | null>(null);

  return (
    <>
      <div className="integration-grid">
        {INTEGRATIONS.map((integration) => (
          <button
            key={integration.id}
            type="button"
            className="integration-card integration-card--button"
            onClick={() => setSelected(integration)}
            aria-haspopup="dialog"
          >
            <span className="integration-card__head">
              <IntegrationLogo id={integration.id} name={integration.name} color={integration.color} />
              <span className="integration-card__copy">
                <span className="integration-card__name">{integration.name}</span>
                <span className="integration-card__vendor">{t(integration.vendorKey)}</span>
              </span>
              <IntegrationStatusBadge
                available={integration.available}
                enabled={isIntegrationEnabled(settings, integration.id)}
              />
            </span>
            <span className="integration-card__desc">{t(integration.shortDescriptionKey)}</span>
          </button>
        ))}
      </div>

      {selected && (
        <IntegrationInfoDialog integration={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
