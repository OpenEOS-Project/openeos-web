'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';
import { usePrinters, useTestPrint } from '@/hooks/use-printers';
import { PrinterFormModal } from './printer-form-modal';
import { DeletePrinterDialog } from './delete-printer-dialog';
import type { Printer as PrinterType } from '@/types/printer';

const typeBadgeClass: Record<string, string> = {
  receipt: 'badge badge--info',
  kitchen: 'badge badge--warning',
  label: 'badge badge--neutral',
};

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid var(--green-ink)', borderTopColor: 'transparent',
        animation: 'spin 0.75s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function PrintersList() {
  const t = useTranslations('printers');
  const tCommon = useTranslations('common');
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId ?? '';

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editPrinter, setEditPrinter] = useState<PrinterType | null>(null);
  const [deletePrinter, setDeletePrinter] = useState<PrinterType | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data: printers, isLoading } = usePrinters(organizationId);
  const testPrintMutation = useTestPrint(organizationId);

  if (isLoading) return <Spinner />;

  if (!printers || printers.length === 0) {
    return (
      <>
        <div className="app-card">
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M6 9V2h12v7" />
                <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
            </div>
            <h3 className="empty-state__title">{t('noPrinters')}</h3>
            <p className="empty-state__sub">{t('noPrintersDescription')}</p>
            <button className="btn btn--primary" onClick={() => setShowCreateModal(true)}>
              {t('addPrinter')}
            </button>
          </div>
        </div>
        {showCreateModal && (
          <PrinterFormModal organizationId={organizationId} onClose={() => setShowCreateModal(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="app-card app-card--flat">
        <div className="app-card__head">
          <div>
            <h2 className="app-card__title">{t('tabs.printers')}</h2>
            <p className="app-card__sub">{printers.length} {t('tabs.printers')}</p>
          </div>
          <button className="btn btn--primary" onClick={() => setShowCreateModal(true)}>
            {t('addPrinter')}
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('table.name')}</th>
                <th>{t('table.type')}</th>
                <th>{t('table.connection')}</th>
                <th>{t('table.device')}</th>
                <th>{t('table.status')}</th>
                <th className="text-right">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {printers.map((printer) => (
                <tr key={printer.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                        background: 'color-mix(in oklab, var(--ink) 6%, transparent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                          <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                          <rect x="6" y="14" width="12" height="8" />
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', margin: 0 }}>{printer.name}</p>
                        <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', margin: 0 }}>
                          {printer.paperWidth}mm
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
                    <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)' }}>
                      {t(`connectionTypes.${printer.connectionType}`)}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)' }}>
                      {printer.device ? printer.device.name : '-'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: printer.isOnline ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 30%, transparent)',
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)' }}>
                        {printer.isOnline ? t('online') : t('offline')}
                      </span>
                    </div>
                  </td>
                  <td className="text-right">
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        className="btn btn--ghost"
                        style={{ padding: '4px 10px', fontSize: 13 }}
                        onClick={() => setOpenMenuId(openMenuId === printer.id ? null : printer.id)}
                      >
                        ···
                      </button>
                      {openMenuId === printer.id && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpenMenuId(null)} />
                          <div style={{
                            position: 'absolute', right: 0, top: '100%', zIndex: 20,
                            background: 'var(--paper)', border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                            borderRadius: 10, boxShadow: '0 8px 24px color-mix(in oklab, var(--ink) 12%, transparent)',
                            minWidth: 160, padding: '4px 0',
                          }}>
                            <button
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
                              onClick={() => { setOpenMenuId(null); setEditPrinter(printer); }}
                            >
                              {t('editPrinter')}
                            </button>
                            <button
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', opacity: (!printer.isOnline || testPrintMutation.isPending) ? 0.4 : 1 }}
                              onClick={() => { setOpenMenuId(null); testPrintMutation.mutate(printer.id); }}
                              disabled={!printer.isOnline || testPrintMutation.isPending}
                            >
                              {t('testPrint')}
                            </button>
                            <div style={{ height: 1, background: 'color-mix(in oklab, var(--ink) 8%, transparent)', margin: '4px 0' }} />
                            <button
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: '#d24545' }}
                              onClick={() => { setOpenMenuId(null); setDeletePrinter(printer); }}
                            >
                              {t('deletePrinter')}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <PrinterFormModal organizationId={organizationId} onClose={() => setShowCreateModal(false)} />
      )}
      {editPrinter && (
        <PrinterFormModal organizationId={organizationId} printer={editPrinter} onClose={() => setEditPrinter(null)} />
      )}
      {deletePrinter && (
        <DeletePrinterDialog printer={deletePrinter} onClose={() => setDeletePrinter(null)} />
      )}
    </>
  );
}
