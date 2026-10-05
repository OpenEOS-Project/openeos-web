'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '@/lib/api-client';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { toast } from '@/components/shared/toast';
import type {
  AdminAssignedPrinter,
  AdminUnassignedPrinterDevice,
} from '@/types/printer';
import type { Organization } from '@/types/organization';

/**
 * Drucker gilt als „online", wenn ihn der Backend in den letzten 30 s gesehen hat.
 * Der Agent pollt /devices/status alle 5 s, also ist 30 s ein großzügiger Schwellenwert.
 */
function isRecentlySeen(value: string | null | undefined): boolean {
  if (!value) return false;
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < 30_000;
}

export function AdminPrintersContainer() {
  const t = useTranslations('admin.printers');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { formatDateTime } = useLocaleFormat();
  const queryClient = useQueryClient();
  const [assignTarget, setAssignTarget] = useState<AdminUnassignedPrinterDevice | null>(null);

  const printersQuery = useQuery({
    queryKey: ['admin', 'printers'],
    queryFn: async () => {
      const response = await adminApi.listPrinters();
      return response.data;
    },
    refetchInterval: 10_000, // Drucker pollen alle 5 Sek. /devices/status — UI bleibt damit nahe live
  });

  const orgsQuery = useQuery({
    queryKey: ['admin', 'organizations', 'simple'],
    queryFn: async () => {
      // The admin/organizations endpoint caps `limit` at 100.
      const response = await adminApi.listOrganizations({ limit: 100 });
      return response.data;
    },
  });

  const testPrintMutation = useMutation({
    mutationFn: (printerId: string) => adminApi.testPrintPrinter(printerId),
    onSuccess: (response) => {
      const result = response.data;
      if (result.success) {
        toast.success(result.message ?? t('toast.testPrintSent'));
      } else {
        toast.error(result.message ?? t('toast.testPrintNotPossible'));
      }
    },
    onError: (err: Error) => toast.error(t('toast.testPrintFailed', { message: apiErrorMessage(err) })),
  });

  const unassignMutation = useMutation({
    mutationFn: (printerId: string) => adminApi.unassignPrinter(printerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'printers'] });
      toast.success(t('toast.unassigned'));
    },
    onError: (err: Error) => toast.error(t('toast.unassignFailed', { message: apiErrorMessage(err) })),
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: (deviceId: string) => adminApi.deleteDevice(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'printers'] });
      toast.success(t('toast.deviceDeleted'));
    },
    onError: (err: Error) => toast.error(t('toast.deleteFailed', { message: apiErrorMessage(err) })),
  });

  const assigned = printersQuery.data?.assigned ?? [];
  const unassigned = printersQuery.data?.unassigned ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Unassigned printer-agent devices */}
      <section className="app-card">
        <div className="app-card__head">
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{t('unassigned.title', { count: unassigned.length })}</div>
            <div style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
              {t('unassigned.description')}
            </div>
          </div>
        </div>
        <div className="app-card__body" style={{ padding: 0 }}>
          {unassigned.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
              {t('unassigned.empty')}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('table.name')}</th>
                  <th>{t('table.status')}</th>
                  <th>{t('table.lastSeen')}</th>
                  <th className="text-right">{t('table.action')}</th>
                </tr>
              </thead>
              <tbody>
                {unassigned.map((d) => {
                  const online = isRecentlySeen(d.lastSeenAt);
                  return (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            aria-hidden
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: online ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 25%, transparent)',
                              boxShadow: online ? '0 0 0 3px color-mix(in oklab, var(--green-ink) 18%, transparent)' : undefined,
                              flexShrink: 0,
                            }}
                          />
                          {d.suggestedName || d.name}
                        </div>
                      </td>
                      <td>
                        <span className={online ? 'badge badge--success' : 'badge badge--warning'}>
                          {online ? t('unassigned.onlineWaiting') : d.status === 'pending' ? t('unassigned.waiting') : d.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--mute)' }}>
                        {formatDateTime(d.lastSeenAt)}
                      </td>
                      <td className="text-right">
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button className="btn btn--primary" style={{ fontSize: 13 }} onClick={() => setAssignTarget(d)}>
                            {t('actions.assign')}
                          </button>
                          <button
                            className="btn btn--ghost"
                            style={{ fontSize: 13, color: 'var(--danger)' }}
                            disabled={deleteDeviceMutation.isPending}
                            onClick={() => {
                              if (confirm(t('confirm.deleteDevice', { name: d.suggestedName || d.name }))) {
                                deleteDeviceMutation.mutate(d.id);
                              }
                            }}
                          >
                            {tCommon('delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Assigned printers across orgs */}
      <section className="app-card">
        <div className="app-card__head">
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{t('assigned.title', { count: assigned.length })}</div>
            <div style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
              {t('assigned.description')}
            </div>
          </div>
        </div>
        <div className="app-card__body" style={{ padding: 0 }}>
          {assigned.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
              {t('assigned.empty')}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('table.organization')}</th>
                  <th>{t('table.printer')}</th>
                  <th>{t('table.type')}</th>
                  <th>{t('table.online')}</th>
                  <th>{t('table.lastSeen')}</th>
                  <th className="text-right">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {assigned.map((p) => (
                  <PrinterRow
                    key={p.id}
                    printer={p}
                    onTestPrint={() => testPrintMutation.mutate(p.id)}
                    onUnassign={() => {
                      if (confirm(t('confirm.unassign', { name: p.name, organization: p.organization?.name ?? '—' }))) {
                        unassignMutation.mutate(p.id);
                      }
                    }}
                    isBusy={testPrintMutation.isPending || unassignMutation.isPending}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {assignTarget && (
        <AssignDeviceModal
          device={assignTarget}
          organizations={orgsQuery.data ?? []}
          orgsLoading={orgsQuery.isLoading}
          orgsError={orgsQuery.error ? apiErrorMessage(orgsQuery.error) : null}
          onClose={() => setAssignTarget(null)}
          onAssigned={() => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'printers'] });
            setAssignTarget(null);
            toast.success(t('toast.assigned'));
          }}
          onError={(msg) => toast.error(msg)}
        />
      )}
    </div>
  );
}

interface PrinterRowProps {
  printer: AdminAssignedPrinter;
  onTestPrint: () => void;
  onUnassign: () => void;
  isBusy: boolean;
}

function PrinterRow({ printer, onTestPrint, onUnassign, isBusy }: PrinterRowProps) {
  const t = useTranslations('admin.printers');
  const { formatDateTime } = useLocaleFormat();
  const typeLabel =
    printer.type === 'kitchen' ? t('types.kitchen') : printer.type === 'label' ? t('types.label') : t('types.receipt');
  return (
    <tr>
      <td>
        {printer.organization?.name ?? '—'}
      </td>
      <td style={{ fontWeight: 600 }}>
        {printer.name}
      </td>
      <td>
        {typeLabel}
      </td>
      <td>
        {(() => {
          const online = printer.isOnline || isRecentlySeen(printer.lastSeenAt);
          return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: online ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 25%, transparent)',
                  boxShadow: online ? '0 0 0 3px color-mix(in oklab, var(--green-ink) 18%, transparent)' : undefined,
                }}
              />
              <span className={online ? 'badge badge--success' : 'badge badge--neutral'}>
                {online ? t('online') : t('offline')}
              </span>
            </div>
          );
        })()}
      </td>
      <td style={{ color: 'var(--mute)' }}>
        {formatDateTime(printer.lastSeenAt)}
      </td>
      <td className="text-right">
        <div style={{ display: 'inline-flex', gap: 6 }}>
          <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={onTestPrint} disabled={isBusy}>
            {t('actions.testPrint')}
          </button>
          <button className="btn btn--ghost" style={{ fontSize: 12, color: 'var(--danger)' }} onClick={onUnassign} disabled={isBusy}>
            {t('actions.unassign')}
          </button>
        </div>
      </td>
    </tr>
  );
}

interface AssignDeviceModalProps {
  device: AdminUnassignedPrinterDevice;
  organizations: Organization[];
  orgsLoading: boolean;
  orgsError: string | null;
  onClose: () => void;
  onAssigned: () => void;
  onError: (msg: string) => void;
}

function AssignDeviceModal({ device, organizations, orgsLoading, orgsError, onClose, onAssigned, onError }: AssignDeviceModalProps) {
  const t = useTranslations();
  const tp = useTranslations('admin.printers.assignModal');
  const apiErrorMessage = useApiErrorMessage();
  const prev = device.previousConfig ?? null;
  const [organizationId, setOrganizationId] = useState('');
  const [hasCashDrawer, setHasCashDrawer] = useState(prev?.hasCashDrawer ?? false);
  const [submitting, setSubmitting] = useState(false);

  const sortedOrgs = useMemo(
    () => [...organizations].sort((a, b) => a.name.localeCompare(b.name)),
    [organizations],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) {
      onError(tp('organizationRequired'));
      return;
    }
    setSubmitting(true);
    try {
      // Hardware fields (name, type, connection, USB IDs, paperWidth) come from
      // the agent's local config.yaml — we only carry the existing values
      // forward and let the admin choose org + cashDrawer.
      await adminApi.assignPrinterDevice({
        deviceId: device.id,
        organizationId,
        name: prev?.name || device.suggestedName || device.name || tp('defaultName'),
        type: prev?.type || 'receipt',
        connectionType: prev?.connectionType || 'usb',
        connectionConfig: (prev?.connectionConfig as Record<string, unknown>) ?? {},
        paperWidth: prev?.paperWidth ?? 80,
        hasCashDrawer,
      });
      onAssigned();
    } catch (err) {
      const message = apiErrorMessage(err, tp('assignFailed'));
      onError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__box modal__panel--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{tp('title')}</div>
          <DialogCloseButton onClick={onClose} />
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', margin: 0 }}>
              {tp('description')}
            </p>

            {prev && (
              <div style={{ padding: 12, borderRadius: 8, background: 'var(--paper-2)', border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)', display: 'grid', gridTemplateColumns: '110px 1fr', gap: '6px 12px', fontSize: 13 }}>
                <span style={{ color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>{tp('name')}</span>
                <span><strong>{prev.name}</strong></span>
                <span style={{ color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>{tp('type')}</span>
                <span>{prev.type === 'kitchen' ? tp('types.kitchen') : prev.type === 'label' ? tp('types.label') : tp('types.receipt')}</span>
                <span style={{ color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>{tp('connection')}</span>
                <span style={{ textTransform: 'uppercase', fontFamily: 'var(--f-mono)', fontSize: 12 }}>{prev.connectionType}</span>
                <span style={{ color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>{tp('paperWidth')}</span>
                <span>{prev.paperWidth} mm</span>
              </div>
            )}

            <label className="auth-field">
              <span className="auth-field__label">{tp('organization')}</span>
              <select
                className="select"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                required
                disabled={orgsLoading || sortedOrgs.length === 0}
              >
                <option value="">
                  {orgsLoading
                    ? tp('orgsLoading')
                    : orgsError
                      ? tp('orgsError')
                      : sortedOrgs.length === 0
                        ? tp('orgsEmpty')
                        : tp('orgsPlaceholder')}
                </option>
                {sortedOrgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              {orgsError && (
                <span role="alert" style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                  {orgsError}
                </span>
              )}
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={hasCashDrawer} onChange={(e) => setHasCashDrawer(e.target.checked)} />
              <span style={{ fontSize: 13 }}>{tp('hasCashDrawer')}</span>
            </label>
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting || !organizationId}>
              {submitting ? t('common.saving') : tp('submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
