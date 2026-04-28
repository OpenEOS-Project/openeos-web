'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRentalHardware, useDeleteRentalHardware } from '@/hooks/use-rentals';
import { HardwareFormModal } from './hardware-form-modal';
import type { RentalHardware, RentalHardwareStatus } from '@/types/rental';

const statusBadge: Record<RentalHardwareStatus, string> = {
  available: 'badge badge--success',
  rented: 'badge badge--info',
  maintenance: 'badge badge--warning',
  retired: 'badge badge--neutral',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

export function HardwareList() {
  const t = useTranslations('admin.rental.hardware');
  const tCommon = useTranslations('common');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editHardware, setEditHardware] = useState<RentalHardware | null>(null);
  const [deleteHardware, setDeleteHardware] = useState<RentalHardware | null>(null);

  const { data: hardware, isLoading } = useRentalHardware();
  const deleteMutation = useDeleteRentalHardware();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--green-ink)', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!hardware || hardware.length === 0) {
    return (
      <>
        <div className="app-card">
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
              </svg>
            </div>
            <h3 className="empty-state__title">{t('title')}</h3>
            <p className="empty-state__sub">{t('description')}</p>
            <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => setShowCreateModal(true)}>
              {t('add')}
            </button>
          </div>
        </div>
        {showCreateModal && <HardwareFormModal onClose={() => setShowCreateModal(false)} />}
      </>
    );
  }

  return (
    <>
      <div className="app-card app-card--flat">
        <div className="app-card__head">
          <div>
            <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>
              {hardware.length} {t('title')}
            </span>
          </div>
          <button className="btn btn--primary" onClick={() => setShowCreateModal(true)}>
            {t('add')}
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('table.name')}</th>
                <th>{t('table.type')}</th>
                <th>{t('table.serial')}</th>
                <th className="text-right">{t('table.rate')}</th>
                <th>{t('table.status')}</th>
                <th>{t('table.device')}</th>
                <th className="text-right">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {hardware.map((hw) => (
                <tr key={hw.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{hw.name}</div>
                    {hw.model && <div style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 40%, transparent)' }}>{hw.model}</div>}
                  </td>
                  <td>{t(`types.${hw.type}`)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{hw.serialNumber}</td>
                  <td className="mono text-right">{formatCurrency(hw.dailyRate)}</td>
                  <td>
                    <span className={statusBadge[hw.status]}>
                      {t(`status.${hw.status}`)}
                    </span>
                  </td>
                  <td>{hw.device ? hw.device.name : <span style={{ color: 'color-mix(in oklab, var(--ink) 35%, transparent)' }}>-</span>}</td>
                  <td className="text-right">
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => setEditHardware(hw)}>
                        {t('edit')}
                      </button>
                      <button
                        className="btn btn--ghost"
                        style={{ fontSize: 12, color: 'var(--red, #dc2626)' }}
                        onClick={() => setDeleteHardware(hw)}
                      >
                        {t('delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && <HardwareFormModal onClose={() => setShowCreateModal(false)} />}
      {editHardware && <HardwareFormModal hardware={editHardware} onClose={() => setEditHardware(null)} />}

      {deleteHardware && (
        <div className="modal__backdrop" onClick={() => setDeleteHardware(null)}>
          <div className="modal__box" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div className="modal__title">{t('delete')}</div>
              <button className="modal__close" onClick={() => setDeleteHardware(null)} aria-label="Schließen">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal__body">
              <div style={{ textAlign: 'center', padding: '12px 0', background: 'color-mix(in oklab, var(--ink) 4%, transparent)', borderRadius: 8 }}>
                <div style={{ fontWeight: 600 }}>{deleteHardware.name}</div>
                <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', fontFamily: 'var(--f-mono)' }}>{deleteHardware.serialNumber}</div>
              </div>
            </div>
            <div className="modal__foot">
              <button className="btn btn--ghost" onClick={() => setDeleteHardware(null)}>{tCommon('cancel')}</button>
              <button
                className="btn btn--primary"
                style={{ background: 'var(--red, #dc2626)' }}
                onClick={() => {
                  deleteMutation.mutate(deleteHardware.id, { onSuccess: () => setDeleteHardware(null) });
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? '...' : tCommon('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
