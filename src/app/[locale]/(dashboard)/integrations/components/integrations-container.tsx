'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { IntegrationLogo } from './integration-logo';
import { SumUpIntegration } from './sumup-integration';

/**
 * Verfügbare Integrationen.
 *
 * Die Liste steht bewusst als Datenstruktur da und nicht als Folge von
 * Abschnitten: eine weitere Anbindung soll ein Eintrag sein, kein Umbau
 * der Seite. `available: false` zeigt sie als angekündigt an, damit
 * erkennbar bleibt, wohin es geht, ohne etwas vorzutäuschen, das noch
 * nicht geht.
 */
interface IntegrationEntry {
  id: string;
  name: string;
  vendor: string;
  description: string;
  /** Hausfarbe des Anbieters, solange kein Logo hinterlegt ist. */
  color: string;
  available: boolean;
  /** Einstellungen der Anbindung; fehlen sie, gibt es nichts zu öffnen. */
  panel?: React.ReactNode;
}

export function IntegrationsContainer() {
  const t = useTranslations('integrations');
  const [openId, setOpenId] = useState<string | null>(null);

  const entries: IntegrationEntry[] = [
    {
      id: 'sumup',
      name: 'SumUp',
      vendor: t('sumup.vendor'),
      description: t('sumup.description'),
      color: '#1B1B1B',
      available: true,
      panel: <SumUpIntegration />,
    },
    {
      id: 'stripe',
      name: 'Stripe',
      vendor: t('stripe.vendor'),
      description: t('stripe.description'),
      color: '#635BFF',
      available: false,
    },
    {
      id: 'fiskaly',
      name: 'fiskaly',
      vendor: t('fiskaly.vendor'),
      description: t('fiskaly.description'),
      color: '#0F766E',
      available: false,
    },
  ];

  return (
    <div className="integration-grid">
      {entries.map((entry) => {
        const isOpen = openId === entry.id;
        return (
          <div key={entry.id} className={`integration-card${isOpen ? ' is-open' : ''}`}>
            <div className="integration-card__head">
              <IntegrationLogo id={entry.id} name={entry.name} color={entry.color} />
              <div className="integration-card__copy">
                <div className="integration-card__name">{entry.name}</div>
                <div className="integration-card__vendor">{entry.vendor}</div>
              </div>
              {entry.available ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setOpenId(isOpen ? null : entry.id)}
                  aria-expanded={isOpen}
                >
                  {isOpen ? t('actions.close') : t('actions.configure')}
                </button>
              ) : (
                <span className="badge badge--neutral">{t('soon')}</span>
              )}
            </div>

            <p className="integration-card__desc">{entry.description}</p>

            {isOpen && entry.panel && <div className="integration-card__panel">{entry.panel}</div>}
          </div>
        );
      })}
    </div>
  );
}
