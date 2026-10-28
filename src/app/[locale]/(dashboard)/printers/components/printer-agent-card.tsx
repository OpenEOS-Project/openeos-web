'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon, SettingToggle } from '@openeos/ui';

import { toast } from '@/components/shared/toast';
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

  const agentInfo = formatAgentInfo(agent.agentInfo);
  const lastSeen = agent.lastSeenAt ? formatTimeAgo(agent.lastSeenAt, locale) : '';

  return (
    <section className="app-card app-card--flat" id={`agent-${agent.deviceId}`}>
      {/* Agent head */}
      <div className="app-card__head" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              flexShrink: 0,
              background: 'color-mix(in oklab, var(--ink) 6%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="monitor" size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 className="app-card__title" style={{ margin: 0 }}>
                {agent.name}
              </h2>
              <span className={agent.isOnline ? 'badge badge--success' : 'badge badge--neutral'}>
                <OnlineDot online={agent.isOnline} />
                <span style={{ marginLeft: 6 }}>{agent.isOnline ? t('online') : t('offline')}</span>
              </span>
            </div>
            <p className="app-card__sub" style={{ margin: '2px 0 0' }}>
              {agentInfo || t('agents.noInfo')}
              {lastSeen ? ` · ${t('agents.lastSeen', { when: lastSeen })}` : ''}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDialog({ kind: 'discover' })}>
            <Icon name="refresh" size={14} />
            {t('agents.actions.discover')}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDialog({ kind: 'manual' })}>
            <Icon name="plus" size={14} />
            {t('agents.actions.addManual')}
          </button>
          <button type="button" className="btn btn--danger-quiet btn--sm" onClick={() => setDialog({ kind: 'remove' })}>
            <Icon name="trash" size={14} />
            {t('agents.actions.remove')}
          </button>
        </div>
      </div>

      {/* Adopted printers */}
      <div style={{ padding: '14px 0 4px' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: MUTED, margin: '0 20px 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          {t('agents.printers.title')} ({printers.length})
        </h3>
        {printers.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTED, margin: '0 20px 16px' }}>{t('agents.printers.empty')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('table.name')}</th>
                  <th>{t('table.type')}</th>
                  <th>{t('table.connection')}</th>
                  <th>{t('table.status')}</th>
                  <th className="text-right">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {printers.map((printer) => {
                  const connection = formatPrinterConnection(printer.connectionType, printer.connectionConfig);
                  // The API keeps the last heartbeat's state; once the agent
                  // itself is gone, none of its printers can be reached.
                  const online = agent.isOnline && printer.isOnline;
                  return (
                    <tr key={printer.id} id={`printer-${printer.id}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              flexShrink: 0,
                              background: 'color-mix(in oklab, var(--ink) 6%, transparent)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Icon name="printer" size={16} />
                          </div>
                          <div>
                            <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', margin: 0 }}>{printer.name}</p>
                            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
                              {printer.paperWidth} mm
                              {printer.hasCashDrawer ? ` · ${t('cashDrawer')}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={typeBadgeClass[printer.type] ?? 'badge badge--neutral'}>
                          {t(`types.${printer.type}`)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 13, color: 'var(--ink)' }}>{t(`connectionTypes.${printer.connectionType}`)}</span>
                        {connection && (
                          <span style={{ display: 'block', fontSize: 12, color: MUTED, fontFamily: 'var(--f-mono)' }}>{connection}</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <OnlineDot online={online} />
                          <span style={{ fontSize: 13, color: MUTED }}>{online ? t('online') : t('offline')}</span>
                          {!printer.isActive && <span className="badge badge--warning">{t('inactive')}</span>}
                        </div>
                      </td>
                      <td className="text-right">
                        <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            disabled={!online || !printer.isActive || testPrintMutation.isPending}
                            onClick={() => runTestPrint(printer)}
                          >
                            <Icon name="print" size={14} />
                            {t('testPrint')}
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => setDialog({ kind: 'edit', printer })}
                            aria-label={`${tCommon('edit')}: ${printer.name}`}
                          >
                            <Icon name="edit" size={14} />
                            {tCommon('edit')}
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => setDialog({ kind: 'delete', printer })}
                            aria-label={`${tCommon('delete')}: ${printer.name}`}
                          >
                            <Icon name="trash" size={14} />
                            {tCommon('delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Discovered printers */}
      <div style={{ borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)', paddingTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, margin: '0 20px 8px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: MUTED, margin: 0, textTransform: 'uppercase', letterSpacing: '.04em' }}>
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
          <p style={{ fontSize: 13, color: MUTED, margin: '0 20px 16px' }}>{tCommon('loading')}</p>
        ) : discovered.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTED, margin: '0 20px 16px' }}>
            {otherDevices.length > 0
              ? t('discovered.emptyFiltered', { count: otherDevices.length })
              : agent.isOnline
                ? t('discovered.empty')
                : t('discovered.emptyOffline')}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('table.name')}</th>
                  <th>{t('table.connection')}</th>
                  <th>{t('discovered.via')}</th>
                  <th>{t('discovered.lastSeen')}</th>
                  <th className="text-right">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {discovered.map((item) => {
                  const adoptedPrinter = item.printerId ? printerById.get(item.printerId) : undefined;
                  const isAdopted = !!item.printerId;
                  const model = formatDiscoveredModel(item.details);
                  const connection = formatDiscoveredConnection(item);
                  const likelyPrinter = isLikelyReceiptPrinter(item);
                  return (
                    <tr key={item.id} style={isAdopted ? { opacity: 0.7 } : undefined}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', margin: 0 }}>{item.displayName}</p>
                          {!likelyPrinter && (
                            <span
                              className="badge badge--neutral"
                              title={item.details?.kindReason || t('discovered.notReceiptHint')}
                              style={{ opacity: 0.8 }}
                            >
                              {t('discovered.notReceipt')}
                            </span>
                          )}
                        </div>
                        {model && model !== item.displayName && (
                          <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>{model}</p>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 13, color: 'var(--ink)' }}>{t(`connectionTypes.${item.connectionType}`)}</span>
                        {connection && (
                          <span style={{ display: 'block', fontSize: 12, color: MUTED, fontFamily: 'var(--f-mono)' }}>{connection}</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge--neutral">{t(`discovered.viaKinds.${item.discoveredVia}`)}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 13, color: MUTED }} title={formatDateTime(item.lastSeenAt)}>
                          {formatTimeAgo(item.lastSeenAt, locale)}
                        </span>
                      </td>
                      <td className="text-right">
                        {isAdopted ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: MUTED }}>
                            <Icon name="check-circle" size={14} />
                            {t('discovered.adopted')}
                            {adoptedPrinter && (
                              <a href={`#printer-${adoptedPrinter.id}`} style={{ color: 'var(--green-ink)', fontWeight: 600 }}>
                                {adoptedPrinter.name}
                              </a>
                            )}
                          </span>
                        ) : (
                          <button type="button" className="btn btn--primary btn--sm" onClick={() => setDialog({ kind: 'adopt', discovered: item })}>
                            {t('discovered.adopt')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
