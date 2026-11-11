'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import { settlementTseState } from '@/lib/waiters';
import type { SettlementTse } from '@/types/waiter';

import '@/styles/settlements.css';

/**
 * TSE-Zustand einer Kellnerabrechnung (Cloud-TSE, `SonstigerVorgang` mit
 * Soll, Ist und Differenz): „TSE-gesichert (TA-Nr. …)“ oder „TSE nicht
 * erreichbar“. Ohne TSE nichts.
 */
export function SettlementTseLine({ tse }: { tse: SettlementTse | null | undefined }) {
  const t = useTranslations('waiterSettlement.tse');
  const state = settlementTseState(tse);
  if (!state) return null;
  if (state.kind === 'failed') {
    return (
      <p className="settle-tse settle-tse--failed" data-testid="settlement-tse">
        <Icon name="alert" size={14} />
        {t('failed')}
      </p>
    );
  }
  return (
    <p className="settle-tse" data-testid="settlement-tse">
      <Icon name="shield" size={14} />
      {state.transactionNumber !== null
        ? t('signed', { number: state.transactionNumber })
        : t('signedNoNumber')}
      {state.bonNumber !== null && <span className="settle-tse__bon">{t('bon', { bon: state.bonNumber })}</span>}
    </p>
  );
}
