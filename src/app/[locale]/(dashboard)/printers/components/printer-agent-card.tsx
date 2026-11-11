'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon, SettingToggle, type DataColumn, type RowAction } from '@openeos/ui';

import { toast } from '@/components/shared/toast';
import { AdminTable, CellMain, ListAction, ListHead } from '@/components/shared/admin-table';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useDiscoveredPrinters, useTestPrint } from '@/hooks/use-printers';
import type { DiscoveredPrinter, Printer, PrinterAgent } from '@/types/printer';
import {
  formatAgentInfo,
  formatDiscoveredConnection,
  formatDiscoveredModel,
  formatPrinterConnection,
  isLikelyReceiptPrinter,
  partitionDiscoveredPrinters,
} from '@/utils/printer-connection';
import { formatTimeAgo } from '@/utils/time-ago';
import '@/styles/admin-table-wave3.css';

import { AdoptPrinterDialog } from './adopt-printer-dialog';
import { DeletePrinterDialog } from './delete-printer-dialog';
import { DiscoverPrintersDialog } from './discover-printers-dialog';
import { PrinterFormModal } from './printer-form-modal';
import { RemoveAgentDialog } from './remove-agent-dialog';

const typeBadgeClass: Record<string, string> = {
  receipt: 'badge badge--info',
  kitchen: 'badge badge--warning',
  label: 'badge badge--neutral',
};

const MUTED = 'color-mix(in oklab, var(--ink) 55%, transparent)';

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        background: online ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 30%, transparent)',
        boxShadow: online ? '0 0 0 3px color-mix(in oklab, var(--green-ink) 18%, transparent)' : undefined,
      }}
    />
  );
}

/** Verbindungsart, darunter (Telefon: daneben) die Adresse in Mono. */
function ConnectionCell({ label, address }: { label: string; address?: string | null }) {
  return (
    <span className="printers-list__conn">
      <span>{label}</span>
      {address ? (
        <span className="printers-list__addr" title={address}>
          {address}
        </span>
      ) : null}
    </span>
  );
}

type Dialog =
  | { kind: 'discover' }
  | { kind: 'manual' }
  | { kind: 'remove' }
  | { kind: 'edit'; printer: Printer }
  | { kind: 'delete'; printer: Printer }
  | { kind: 'adopt'; discovered: DiscoveredPrinter }
  | null;

interface PrinterAgentCardProps {
  organizationId: string;
  agent: PrinterAgent;
  /** Printers hanging on this agent (already filtered by deviceId). */
  printers: Printer[];
}

/**
 * One agent: who it is and whether it's connected, the printers it serves,
 * and what it has found but nobody adopted yet.
 */
export function PrinterAgentCard({ organizationId, agent, printers }: PrinterAgentCardProps) {
  const t = useTranslations('printers');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { locale, formatDateTime } = useLocaleFormat();
  const [dialog, setDialog] = useState<Dialog>(null);
  // Office printers and silent devices stay hidden until asked for.
  const [showAllDiscovered, setShowAllDiscovered] = useState(false);

  const discoveredQuery = useDiscoveredPrinters(organizationId, agent.deviceId, { live: true });
  const { shown: likelyPrinters, hidden: otherDevices } = partitionDiscoveredPrinters(discoveredQuery.data);
  const discovered = showAllDiscovered ? [...likelyPrinters, ...otherDevices] : likelyPrinters;
  const printerById = new Map(printers.map((p) => [p.id, p]));

  const testPrintMutation = useTestPrint(organizationId);
  const runTestPrint = (printer: Printer) =>
    testPrintMutation.mutate(printer.id, {
      onSuccess: () => toast.success(t('testPrintSuccess', { name: printer.name })),
      onError: (err) => toast.error(apiErrorMessage(err, t('testPrintFailed'))),
    });

  const isPrinterOnline = (printer: Printer) => agent.isOnline && printer.isOnline;

  const notReceiptBadge = (item: DiscoveredPrinter) => (
    <span className="badge badge--neutral" title={item.details?.kindReason || t('discovered.notReceiptHint')} style={{ opacity: 0.8 }}>
      {t('discovered.notReceipt')}
    </span>
  );

  const agentInfo = formatAgentInfo(agent.agentInfo);
  const lastSeen = agent.lastSeenAt ? formatTimeAgo(agent.lastSeenAt, locale) : '';

  const printerColumns: DataColumn<Printer>[] = [
    {
      id: 'name',
      header: t('table.name'),
      mobile: 'title',
      cell: (printer) => {
        const sub = `${printer.paperWidth} mm${printer.hasCashDrawer ? ` · ${t('cashDrawer')}` : ''}`;
        return (
          <CellMain
            /* Sprungziel für „Übernommen: <Name>“ in den gefundenen Druckern
               (DataTable setzt keine id auf die Zeile). */
            media={
              <span className="printers-list__icon" id={`printer-${printer.id}`} aria-hidden>
                <Icon name="printer" size={16} />
              </span>
            }
            title={printer.name}
            titleText={printer.name}
            sub={sub}
            subText={sub}
          />
        );
      },
    },
    {
      id: 'type',
      header: t('table.type'),
      mobile: 'meta',
      cell: (printer) => (
        <span className={typeBadgeClass[printer.type] ?? 'badge badge--neutral'}>{t(`types.${printer.type}`)}</span>
      ),
    },
    {
      id: 'connection',
      header: t('table.connection'),
      mobile: 'meta',
      priority: 2,
      cell: (printer) => (
        <ConnectionCell
          label={t(`connectionTypes.${printer.connectionType}`)}
          address={formatPrinterConnection(printer.connectionType, printer.connectionConfig)}
        />
      ),
    },
    {
      id: 'status',
      header: t('table.status'),
      mobile: 'subtitle',
      cell: (printer) => {
        // The API keeps the last heartbeat's state; once the agent
        // itself is gone, none of its printers can be reached.
        const online = isPrinterOnline(printer);
        return (
          <span className="printers-list__status">
            <OnlineDot online={online} />
            <span>{online ? t('online') : t('offline')}</span>
            {!printer.isActive && <span className="badge badge--warning">{t('inactive')}</span>}
          </span>
        );
      },
    },
  ];

  const printerActions = (printer: Printer): RowAction[] => [
    {
      id: 'edit',
      label: `${tCommon('edit')}: ${printer.name}`,
      icon: 'edit',
      onClick: () => setDialog({ kind: 'edit', printer }),
    },
    {
      id: 'testPrint',
      label: t('testPrint'),
      icon: 'print',
      disabled: !isPrinterOnline(printer) || !printer.isActive || testPrintMutation.isPending,
      onClick: () => runTestPrint(printer),
    },
    {
      id: 'delete',
      label: `${tCommon('delete')}: ${printer.name}`,
      icon: 'trash',
      danger: true,
      onClick: () => setDialog({ kind: 'delete', printer }),
    },
  ];

  const discoveredColumns: DataColumn<DiscoveredPrinter>[] = [
    {
      id: 'name',
      header: t('table.name'),
      mobile: 'title',
      cell: (item) => {
        const model = formatDiscoveredModel(item.details);
        const sub = model && model !== item.displayName ? model : undefined;
        return (
          <CellMain
            title={item.displayName}
            titleText={item.displayName}
            sub={sub}
            subText={sub}
            extra={isLikelyReceiptPrinter(item) ? undefined : notReceiptBadge(item)}
          />
        );
      },
    },
    {
      // Telefon: der Hinweis „Kein Bondrucker“ in Zeile 2 (extra ist dort aus).
      id: 'kind',
      header: t('table.type'),
      mobile: 'meta',
      className: 'admin-dt__phone-only',
      cell: (item) => (isLikelyReceiptPrinter(item) ? null : notReceiptBadge(item)),
    },
    {
      id: 'connection',
      header: t('table.connection'),
      mobile: 'meta',
      cell: (item) => (
        <ConnectionCell label={t(`connectionTypes.${item.connectionType}`)} address={formatDiscoveredConnection(item)} />
      ),
    },
    {
      id: 'via',
      header: t('discovered.via'),
      priority: 2,
      cell: (item) => <span className="badge badge--neutral">{t(`discovered.viaKinds.${item.discoveredVia}`)}</span>,
    },
    {
      id: 'lastSeen',
      header: t('discovered.lastSeen'),
      mobile: 'meta',
      priority: 3,
      className: 'printers-list__seen',
      cell: (item) => <span title={formatDateTime(item.lastSeenAt)}>{formatTimeAgo(item.lastSeenAt, locale)}</span>,
    },
    {
      id: 'adopted',
      header: t('table.status'),
      mobile: 'subtitle',
      cell: (item) => {
        if (!item.printerId) return null;
        const adoptedPrinter = printerById.get(item.printerId);
        return (
          <span className="printers-list__adopted">
            <Icon name="check-circle" size={14} />
            {t('discovered.adopted')}
            {adoptedPrinter && <a href={`#printer-${adoptedPrinter.id}`}>{adoptedPrinter.name}</a>}
          </span>
        );
      },
    },
  ];

  const discoveredActions = (item: DiscoveredPrinter): RowAction[] => [
    {
      id: 'adopt',
      label: t('discovered.adopt'),
      icon: 'plus',
      primary: true,
      hidden: !!item.printerId,
      onClick: () => setDialog({ kind: 'adopt', discovered: item }),
    },
  ];

  return (
    <section className="app-card app-card--flat printer-agent" id={`agent-${agent.deviceId}`}>
      {/* Agent head: wer er ist und ob er verbunden ist; die Aktionen als
          Symbolknöpfe mit Tooltip wie in den anderen Listen. */}
      <ListHead
        actions={
          <>
            <ListAction icon="refresh" label={t('agents.actions.discover')} onClick={() => setDialog({ kind: 'discover' })} />
            <ListAction icon="plus" label={t('agents.actions.addManual')} onClick={() => setDialog({ kind: 'manual' })} />
            <ListAction
              variant="danger-quiet"
              icon="trash"
              label={t('agents.actions.remove')}
              onClick={() => setDialog({ kind: 'remove' })}
            />
          </>
        }
      >
        <div className="printer-agent__head">
          <span className="printer-agent__icon" aria-hidden>
            <Icon name="monitor" size={20} />
          </span>
          <div className="printer-agent__text">
            <div className="printer-agent__title">
              <h2 className="app-card__title">{agent.name}</h2>
              <span className={agent.isOnline ? 'badge badge--success' : 'badge badge--neutral'}>
                <OnlineDot online={agent.isOnline} />
                <span style={{ marginLeft: 6 }}>{agent.isOnline ? t('online') : t('offline')}</span>
              </span>
            </div>
            <p className="app-card__sub printer-agent__sub">
              {agentInfo || t('agents.noInfo')}
              {lastSeen ? ` · ${t('agents.lastSeen', { when: lastSeen })}` : ''}
            </p>
          </div>
        </div>
      </ListHead>

      {/* Adopted printers */}
      <div className="printer-agent__section">
        <h3 className="printer-agent__heading">
          {t('agents.printers.title')} ({printers.length})
        </h3>
        {printers.length === 0 ? (
          <p className="printer-agent__empty">{t('agents.printers.empty')}</p>
        ) : (
          <AdminTable
            caption={`${t('agents.printers.title')}: ${agent.name}`}
            rows={printers}
            rowKey="id"
            columns={printerColumns}
            actions={printerActions}
          />
        )}
      </div>

      {/* Discovered printers */}
      <div className="printer-agent__section printer-agent__section--discovered">
        <div className="printer-agent__section-head">
          <h3 className="printer-agent__heading">
            {t('discovered.title')} ({discovered.length})
          </h3>
          {otherDevices.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {!showAllDiscovered && (
                <span style={{ fontSize: 12, color: MUTED }}>{t('discovered.hiddenCount', { count: otherDevices.length })}</span>
              )}
              <SettingToggle
                flush
                label={<span style={{ fontSize: 13 }}>{t('discovered.showAll')}</span>}
                checked={showAllDiscovered}
                onChange={setShowAllDiscovered}
              />
            </div>
          )}
        </div>
        {discoveredQuery.isLoading ? (
          <p className="printer-agent__empty">{tCommon('loading')}</p>
        ) : discovered.length === 0 ? (
          <p className="printer-agent__empty">
            {otherDevices.length > 0
              ? t('discovered.emptyFiltered', { count: otherDevices.length })
              : agent.isOnline
                ? t('discovered.empty')
                : t('discovered.emptyOffline')}
          </p>
        ) : (
          <AdminTable
            caption={`${t('discovered.title')}: ${agent.name}`}
            rows={discovered}
            rowKey="id"
            columns={discoveredColumns}
            actions={discoveredActions}
            rowClassName={(item) => (item.printerId ? 'admin-dt__row--muted' : undefined)}
          />
        )}
      </div>

      {dialog?.kind === 'discover' && (
        <DiscoverPrintersDialog organizationId={organizationId} agent={agent} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'manual' && (
        <PrinterFormModal organizationId={organizationId} deviceId={agent.deviceId} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'edit' && (
        <PrinterFormModal
          organizationId={organizationId}
          deviceId={agent.deviceId}
          printer={dialog.printer}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeletePrinterDialog organizationId={organizationId} printer={dialog.printer} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'adopt' && (
        <AdoptPrinterDialog
          organizationId={organizationId}
          deviceId={agent.deviceId}
          discovered={dialog.discovered}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'remove' && (
        <RemoveAgentDialog organizationId={organizationId} agent={agent} onClose={() => setDialog(null)} />
      )}
    </section>
  );
}
