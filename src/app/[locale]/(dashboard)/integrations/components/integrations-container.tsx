'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

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
  available: boolean;
  /** Einstellungen der Anbindung; fehlen sie, gibt es nichts zu öffnen. */
  panel?: React.ReactNode;
}

function IntegrationIcon({ children }: { children: React.ReactNode }) {
  return <div className="integration-card__icon">{children}</div>;
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
      available: true,
      panel: <SumUpIntegration />,
    },
    {
      id: 'stripe',
      name: 'Stripe',
      vendor: t('stripe.vendor'),
      description: t('stripe.description'),
      available: false,
    },
    {
      id: 'lexoffice',
      name: 'lexoffice',
      vendor: t('lexoffice.vendor'),
      description: t('lexoffice.description'),
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
              <IntegrationIcon>{entry.name.slice(0, 1)}</IntegrationIcon>
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
