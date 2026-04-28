'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api-client';
import { useRentalHardware, useCreateRentalAssignment } from '@/hooks/use-rentals';
import type { CreateRentalAssignmentData } from '@/types/rental';

interface AssignmentFormModalProps {
  onClose: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

export function AssignmentFormModal({ onClose }: AssignmentFormModalProps) {
  const t = useTranslations('admin.rental.assignments');
  const tCommon = useTranslations('common');

  const [hardwareId, setHardwareId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  const createMutation = useCreateRentalAssignment();

  const { data: hardware } = useRentalHardware({ status: 'available' });
  const availableHardware = hardware ?? [];

  const { data: orgsData } = useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: () => adminApi.listOrganizations({ limit: 100 }),
  });
  const organizations = orgsData?.data ?? [];

  const selectedHardware = availableHardware.find((hw) => hw.id === hardwareId);
  const preview = useMemo(() => {
    if (!startDate || !endDate || !selectedHardware) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const totalAmount = totalDays * selectedHardware.dailyRate;
    return { totalDays, totalAmount };
  }, [startDate, endDate, selectedHardware]);

  function handleSubmit() {
    const data: CreateRentalAssignmentData = {
      rentalHardwareId: hardwareId,
      organizationId,
      startDate,
      endDate,
      notes: notes || undefined,
    };
    createMutation.mutate(data, { onSuccess: onClose });
  }

  const isValid = hardwareId && organizationId && startDate && endDate;

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__box" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{t('add')}</div>
          <button className="modal__close" onClick={onClose} aria-label="Schließen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal__body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="auth-field">
              <label className="auth-field__label">{t('form.hardware')}</label>
              <select className="select" value={hardwareId} onChange={(e) => setHardwareId(e.target.value)}>
                <option value="">{t('form.hardwarePlaceholder')}</option>
                {availableHardware.map((hw) => (
                  <option key={hw.id} value={hw.id}>
                    {hw.name} ({hw.serialNumber}) — {formatCurrency(hw.dailyRate)}/Tag
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-field">
              <label className="auth-field__label">{t('form.organization')}</label>
              <select className="select" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
                <option value="">{t('form.organizationPlaceholder')}</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="auth-field">
                <label className="auth-field__label">{t('form.startDate')}</label>
                <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="auth-field">
                <label className="auth-field__label">{t('form.endDate')}</label>
                <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-field__label">{t('form.notes')}</label>
              <input className="input" placeholder={t('form.notesPlaceholder')} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {preview && (
              <div style={{ background: 'color-mix(in oklab, var(--ink) 4%, transparent)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('form.totalDays')}</span>
                  <span style={{ fontWeight: 600 }}>{preview.totalDays}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('form.totalAmount')}</span>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(preview.totalAmount)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>{tCommon('cancel')}</button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={!isValid || createMutation.isPending}>
            {createMutation.isPending ? '...' : tCommon('create')}
          </button>
        </div>
      </div>
    </div>
  );
}
