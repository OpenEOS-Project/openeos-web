'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';

import { useRefreshCurrentOrganization } from '@/components/shared/operating-mode-notices';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { tseKeys, useTseSetup } from '@/hooks/use-tse';
import { tseSetupStep } from '@/lib/tse';
import { useAuthStore } from '@/stores/auth-store';

import { TseDangerZone } from './tse/tse-danger-zone';
import { TseExportsCard } from './tse/tse-exports-card';
import { TseOutagesCard } from './tse/tse-outages-card';
import { TseSetupCard } from './tse/tse-setup-card';
import { TseStatusCard } from './tse/tse-status-card';
import { TseTransactionsCard } from './tse/tse-transactions-card';

import '@/styles/tse.css';

/**
 * Seite /integrations/tse: Einrichtung (Grund + Checkliste der
 * Voraussetzungen, Anlage, Fortschritt) — auch bei ausgeschalteter Integration,
 * danach Zustand, Ausfallprotokoll, Vorgänge, Exporte und Gefahrenzone.
 * Vertrag: tse-swissbit-plan.md §8.
 */
export function TseIntegration() {
  const t = useTranslations('integrations.tse');
  const apiErrorMessage = useApiErrorMessage();
  const organizationId = useAuthStore((state) => state.currentOrganization?.organizationId);
  const queryClient = useQueryClient();
  const refreshOrganization = useRefreshCurrentOrganization();
  const setup = useTseSetup(organizationId);
  const status = setup.status;
  // Bis die Veranstaltungen da sind (nur bei ausgeschalteter Integration
  // nötig), reicht die Antwort von GET …/tse.
  const step = setup.step ?? tseSetupStep(status.data);

  // Wird die TSE aktiv (oder fällt sie weg), ändern sich Bargeld und
  // Betriebsart — Organisation und Listen neu laden.
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step && (step === 'active' || previousStep.current === 'active')) {
      void refreshOrganization();
      void queryClient.invalidateQueries({ queryKey: tseKeys.all(organizationId ?? '') });
    }
    previousStep.current = step;
  }, [step, refreshOrganization, queryClient, organizationId]);

  if (!organizationId) return null;

  if (status.isLoading) {
    return (
      <div className="app-card tse-loading" role="status">
        <span className="tse-spinner" aria-hidden="true" />
        {t('loading')}
      </div>
    );
  }

  if (status.isError || !status.data) {
    return (
      <div className="app-card" role="alert">
        <p className="tse-text">{apiErrorMessage(status.error, t('loadFailed'))}</p>
      </div>
    );
  }

  const data = status.data;
  const unit = data.unit;
  // Ausfälle, Vorgänge und Exporte gibt es erst, seit eine TSE aktiv war
  // (auch eine frühere, deaktivierte — deren Belege bleiben abrufbar).
  const hasData = data.history.some((u) => !!u.activatedAt);

  return (
    <div className="tse-page" data-testid="tse-integration" data-step={step}>
      {step === 'active' && unit ? <TseStatusCard status={data} /> : <TseSetupCard organizationId={organizationId} status={data} setup={{ ...setup, step }} />}

      {hasData && (
        <>
          <TseOutagesCard organizationId={organizationId} />
          <TseTransactionsCard organizationId={organizationId} />
          <TseExportsCard organizationId={organizationId} active={step === 'active'} />
        </>
      )}

      {step === 'active' && unit && <TseDangerZone organizationId={organizationId} unit={unit} />}
    </div>
  );
}
