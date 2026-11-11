'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { Icon, type DataColumn } from '@openeos/ui';

import { AdminTable, CellMain, ListAction, ListHead } from '@/components/shared/admin-table';
import { ListEmpty, ListError, ListLoading } from '@/components/shared/list-states';

import { usePrinterAgents, usePrinterLiveUpdates, usePrinters } from '@/hooks/use-printers';

import { useAuthStore } from '@/stores/auth-store';
import type { Printer } from '@/types/printer';
import '@/styles/admin-table-wave3.css';

import { AgentSetupSteps, ConnectAgentDialog } from './connect-agent-dialog';
import { PrinterAgentCard } from './printer-agent-card';

/**
 * Tab "Drucker": the organisation's printer agents, each with the printers
 * it serves and what it has discovered. Pairing a new agent happens here
 * too — agents are hidden from the general device list.
 */
export function PrintersList() {
  const t = useTranslations('printers');
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId ?? '';
  const [connectOpen, setConnectOpen] = useState(false);

  const agentsQuery = usePrinterAgents(organizationId, { live: true });
  const printersQuery = usePrinters(organizationId, { live: true });
  usePrinterLiveUpdates(organizationId);

  if (agentsQuery.isLoading || printersQuery.isLoading) return <ListLoading />;
  if (agentsQuery.isError) {
    return <ListError onRetry={() => agentsQuery.refetch()} />;
  }

  const agents = agentsQuery.data ?? [];
  const printers = printersQuery.data ?? [];
  const agentIds = new Set(agents.map((a) => a.deviceId));
  // Printers whose agent is gone (shouldn't happen — the API deletes them
  // with the agent) still deserve a place rather than vanishing silently.
  const orphans = printers.filter((p) => !p.deviceId || !agentIds.has(p.deviceId));

  // Rendered at the same position in both branches below: when the first
  // agent is linked the list switches from the empty state to the cards, and
  // the dialog must survive that switch to show its "done" step.
  const connectDialog = connectOpen ? (
    <ConnectAgentDialog onClose={() => setConnectOpen(false)} />
  ) : null;

  const orphanColumns: DataColumn<Printer>[] = [
    {
      id: 'name',
      header: t('table.name'),
      mobile: 'title',
      cell: (printer) => <CellMain title={printer.name} titleText={printer.name} />,
    },
    {
      id: 'type',
      header: t('table.type'),
      mobile: 'subtitle',
      cell: (printer) => <span className="admin-cell-text--muted">{t(`types.${printer.type}`)}</span>,
    },
  ];

  const body =
    agents.length === 0 ? (
      <ListEmpty
        title={t('agents.empty.title')}
        description={t('agents.empty.description')}
        icon={<Icon name="printer" size={28} />}
        action={
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              alignItems: 'center',
              marginTop: 8,
              maxWidth: 520,
            }}
          >
            <AgentSetupSteps />
            <button type="button" className="btn btn--primary" onClick={() => setConnectOpen(true)}>
              {t('agents.connect.cta')}
            </button>
          </div>
        }
      />
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Nur der Kopf: Überblick und „Agent verbinden“. */}
        <div className="app-card app-card--flat printers-overview">
          <ListHead
            actions={
              <ListAction
                variant="primary"
                icon="plus"
                label={t('agents.connect.cta')}
                onClick={() => setConnectOpen(true)}
              />
            }
          >
            <h2 className="app-card__title">{t('agents.title')}</h2>
            <p className="app-card__sub">
              {t('agents.count', { count: agents.length })} · {t('printerCount', { count: printers.length })}
            </p>
          </ListHead>
        </div>

        {agents.map((agent) => (
          <PrinterAgentCard
            key={agent.deviceId}
            organizationId={organizationId}
            agent={agent}
            printers={printers.filter((p) => p.deviceId === agent.deviceId)}
          />
        ))}

        {orphans.length > 0 && (
          <div className="app-card app-card--flat">
            <div className="app-card__head">
              <div>
                <h2 className="app-card__title">{t('orphans.title')}</h2>
                <p className="app-card__sub">{t('orphans.description')}</p>
              </div>
            </div>
            <AdminTable
              caption={t('orphans.title')}
              rows={orphans}
              rowKey="id"
              columns={orphanColumns}
            />
          </div>
        )}
      </div>
    );

  return (
    <>
      {body}
      {connectDialog}
    </>
  );
}
