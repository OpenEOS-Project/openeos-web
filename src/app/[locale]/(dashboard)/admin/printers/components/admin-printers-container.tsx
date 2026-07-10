'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '@/lib/api-client';
import type {
  AdminAssignedPrinter,
  AdminUnassignedPrinterDevice,
} from '@/types/printer';
import type { Organization } from '@/types/organization';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

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
  const queryClient = useQueryClient();
  const [assignTarget, setAssignTarget] = useState<AdminUnassignedPrinterDevice | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        setActionMessage({ type: 'success', text: result.message ?? 'Test-Druck wurde an den Drucker gesendet.' });
      } else {
        setActionMessage({ type: 'error', text: result.message ?? 'Test-Druck nicht möglich.' });
      }
    },
    onError: (err: Error) => setActionMessage({ type: 'error', text: `Test-Druck fehlgeschlagen: ${err.message}` }),
  });

  const unassignMutation = useMutation({
    mutationFn: (printerId: string) => adminApi.unassignPrinter(printerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'printers'] });
      setActionMessage({ type: 'success', text: 'Zuordnung wurde aufgehoben.' });
    },
    onError: (err: Error) => setActionMessage({ type: 'error', text: `Zuordnung aufheben fehlgeschlagen: ${err.message}` }),
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: (deviceId: string) => adminApi.deleteDevice(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'printers'] });
      setActionMessage({ type: 'success', text: 'Gerät wurde gelöscht.' });
    },
    onError: (err: Error) => setActionMessage({ type: 'error', text: `Löschen fehlgeschlagen: ${err.message}` }),
  });

  const assigned = printersQuery.data?.assigned ?? [];
  const unassigned = printersQuery.data?.unassigned ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {actionMessage && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background:
              actionMessage.type === 'success'
                ? 'color-mix(in oklab, var(--green-ink) 8%, transparent)'
                : 'color-mix(in oklab, var(--danger) 8%, transparent)',
            color: actionMessage.type === 'success' ? 'var(--green-ink)' : 'var(--danger)',
            fontSize: 13,
          }}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Unassigned printer-agent devices */}
      <section className="app-card">
        <div className="app-card__head">
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Nicht zugewiesene Drucker-Agents ({unassigned.length})</div>
            <div style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
              Drucker, die sich beim Backend registriert haben, aber noch keiner Organisation zugeordnet sind.
            </div>
          </div>
        </div>
        <div className="app-card__body" style={{ padding: 0 }}>
          {unassigned.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
              Keine wartenden Drucker-Agents. Sobald ein RPi-Agent sich registriert, erscheint er hier.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
                  <th style={{ padding: '10px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)' }}>Name</th>
                  <th style={{ padding: '10px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)' }}>Status</th>
                  <th style={{ padding: '10px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)' }}>Zuletzt gesehen</th>
                  <th style={{ padding: '10px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)', textAlign: 'right' }}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {unassigned.map((d) => {
                  const online = isRecentlySeen(d.lastSeenAt);
                  return (
                    <tr key={d.id}>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 5%, transparent)', fontSize: 14, fontWeight: 600 }}>
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
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 5%, transparent)' }}>
                        <span className={online ? 'badge badge--success' : 'badge badge--warning'}>
                          {online ? 'Online · wartet auf Zuordnung' : d.status === 'pending' ? 'Wartet auf Zuordnung' : d.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 5%, transparent)', fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
                        {formatDateTime(d.lastSeenAt)}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 5%, transparent)', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button className="btn btn--primary" style={{ fontSize: 13 }} onClick={() => setAssignTarget(d)}>
                            Zuordnen
                          </button>
                          <button
                            className="btn btn--ghost"
                            style={{ fontSize: 13, color: 'var(--danger)' }}
                            disabled={deleteDeviceMutation.isPending}
                            onClick={() => {
                              if (confirm(`Gerät „${d.suggestedName || d.name}" endgültig löschen?`)) {
                                deleteDeviceMutation.mutate(d.id);
                              }
                            }}
                          >
                            Löschen
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
            <div style={{ fontSize: 15, fontWeight: 700 }}>Zugewiesene Drucker ({assigned.length})</div>
            <div style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
              Alle Drucker über alle Organisationen.
            </div>
          </div>
        </div>
        <div className="app-card__body" style={{ padding: 0 }}>
          {assigned.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
              Noch keine Drucker einer Organisation zugewiesen.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
                  <th style={{ padding: '10px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)' }}>Organisation</th>
                  <th style={{ padding: '10px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)' }}>Drucker</th>
                  <th style={{ padding: '10px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)' }}>Typ</th>
                  <th style={{ padding: '10px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)' }}>Online</th>
                  <th style={{ padding: '10px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)' }}>Zuletzt gesehen</th>
                  <th style={{ padding: '10px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)', textAlign: 'right' }}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {assigned.map((p) => (
                  <PrinterRow
                    key={p.id}
                    printer={p}
                    onTestPrint={() => testPrintMutation.mutate(p.id)}
                    onUnassign={() => {
                      if (confirm(`Drucker „${p.name}" wirklich aus „${p.organization?.name}" entfernen?`)) {
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
          orgsError={orgsQuery.error instanceof Error ? orgsQuery.error.message : null}
          onClose={() => setAssignTarget(null)}
          onAssigned={() => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'printers'] });
            setAssignTarget(null);
            setActionMessage({ type: 'success', text: 'Drucker wurde der Organisation zugewiesen.' });
          }}
          onError={(msg) => setActionMessage({ type: 'error', text: msg })}
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
  const typeLabel = printer.type === 'kitchen' ? 'Küche' : printer.type === 'label' ? 'Etiketten' : 'Beleg';
  return (
    <tr>
      <td style={{ padding: '12px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 5%, transparent)', fontSize: 14 }}>
        {printer.organization?.name ?? '—'}
      </td>
      <td style={{ padding: '12px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 5%, transparent)', fontSize: 14, fontWeight: 600 }}>
        {printer.name}
      </td>
      <td style={{ padding: '12px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 5%, transparent)', fontSize: 13 }}>
        {typeLabel}
      </td>
      <td style={{ padding: '12px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 5%, transparent)' }}>
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
                {online ? 'Online' : 'Offline'}
              </span>
            </div>
          );
        })()}
      </td>
      <td style={{ padding: '12px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 5%, transparent)', fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
        {formatDateTime(printer.lastSeenAt)}
      </td>
      <td style={{ padding: '12px 16px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 5%, transparent)', textAlign: 'right' }}>
        <div style={{ display: 'inline-flex', gap: 6 }}>
          <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={onTestPrint} disabled={isBusy}>
            Test-Druck
          </button>
          <button className="btn btn--ghost" style={{ fontSize: 12, color: 'var(--danger)' }} onClick={onUnassign} disabled={isBusy}>
            Zuordnung aufheben
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
      onError('Bitte eine Organisation auswählen.');
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
        name: prev?.name || device.suggestedName || device.name || 'Drucker',
        type: prev?.type || 'receipt',
        connectionType: prev?.connectionType || 'usb',
        connectionConfig: (prev?.connectionConfig as Record<string, unknown>) ?? {},
        paperWidth: prev?.paperWidth ?? 80,
        hasCashDrawer,
      });
      onAssigned();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Zuordnung fehlgeschlagen';
      onError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__box" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Drucker zuordnen</div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Schließen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', margin: 0 }}>
              Verknüpft das Drucker-Agent-Gerät mit einer Organisation. Hardware-Werte
              (Name, Typ, Anschluss, USB-Kennung, Papierbreite) werden aus der lokalen
              Agent-Konfiguration auf dem RPi übernommen.
            </p>

            {prev && (
              <div style={{ padding: 12, borderRadius: 8, background: 'var(--paper-2)', border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)', display: 'grid', gridTemplateColumns: '110px 1fr', gap: '6px 12px', fontSize: 13 }}>
                <span style={{ color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>Name</span>
                <span><strong>{prev.name}</strong></span>
                <span style={{ color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>Typ</span>
                <span>{prev.type === 'kitchen' ? 'Küchendrucker' : prev.type === 'label' ? 'Etiketten' : 'Beleg'}</span>
                <span style={{ color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>Anschluss</span>
                <span style={{ textTransform: 'uppercase', fontFamily: 'var(--f-mono)', fontSize: 12 }}>{prev.connectionType}</span>
                <span style={{ color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>Papierbreite</span>
                <span>{prev.paperWidth} mm</span>
              </div>
            )}

            <label className="auth-field">
              <span className="auth-field__label">Organisation *</span>
              <select
                className="select"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                required
                disabled={orgsLoading || sortedOrgs.length === 0}
              >
                <option value="">
                  {orgsLoading
                    ? 'Lädt Organisationen …'
                    : orgsError
                      ? 'Fehler beim Laden'
                      : sortedOrgs.length === 0
                        ? 'Keine Organisationen verfügbar'
                        : 'Bitte auswählen…'}
                </option>
                {sortedOrgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              {orgsError && (
                <span style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                  {orgsError}
                </span>
              )}
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={hasCashDrawer} onChange={(e) => setHasCashDrawer(e.target.checked)} />
              <span style={{ fontSize: 13 }}>Kassenlade ist an diesem Drucker angeschlossen</span>
            </label>
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting || !organizationId}>
              {submitting ? '...' : 'Zuordnen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
