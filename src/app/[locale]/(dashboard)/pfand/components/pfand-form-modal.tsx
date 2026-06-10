'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useCreatePfandType, useUpdatePfandType } from '@/hooks/use-pfand-types';
import type { PfandType } from '@/types/pfand';

const pfandSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  amount: z.coerce.number().min(0, 'Amount must be positive'),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().min(0).optional(),
});

type PfandFormData = z.infer<typeof pfandSchema>;

interface PfandFormModalProps {
  isOpen: boolean;
  organizationId: string;
  pfandType?: PfandType | null;
  onClose: () => void;
}

export function PfandFormModal({ isOpen, organizationId, pfandType, onClose }: PfandFormModalProps) {
  const t = useTranslations('pfand');
  const tCommon = useTranslations('common');
  const isEditing = !!pfandType;

  const createType = useCreatePfandType(organizationId);
  const updateType = useUpdatePfandType(organizationId);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PfandFormData>({
    resolver: zodResolver(pfandSchema),
    defaultValues: { name: '', amount: 0, isActive: true, sortOrder: 0 },
  });

  useEffect(() => {
    if (pfandType) {
      reset({
        name: pfandType.name,
        amount: Number(pfandType.amount),
        isActive: pfandType.isActive,
        sortOrder: pfandType.sortOrder,
      });
    } else {
      reset({ name: '', amount: 0, isActive: true, sortOrder: 0 });
    }
  }, [pfandType, reset]);

  const onSubmit = async (data: PfandFormData) => {
    try {
      if (isEditing && pfandType) {
        await updateType.mutateAsync({ id: pfandType.id, data });
      } else {
        await createType.mutateAsync(data);
      }
      onClose();
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
    background: active ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 20%, transparent)',
    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
  });

  const toggleKnob = (active: boolean): React.CSSProperties => ({
    position: 'absolute', top: 2, left: active ? 22 : 2,
    width: 20, height: 20, borderRadius: 10, background: 'var(--paper)',
    transition: 'left 0.2s', display: 'block',
  });

  if (!isOpen) return null;

  return (
    <div className="modal__overlay" onClick={handleClose}>
      <div className="modal__panel" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{isEditing ? t('edit') : t('create')}</h2>
          <button type="button" className="modal__close" onClick={handleClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <label className="auth-field">
                  <span>{t('form.name')} <span style={{ color: '#d24545' }}>*</span></span>
                  <input type="text" placeholder={t('form.namePlaceholder')} {...field} />
                  {errors.name && <span style={{ fontSize: 12, color: '#d24545', marginTop: 4 }}>{errors.name.message}</span>}
                </label>
              )}
            />

            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <label className="auth-field">
                  <span>{t('form.amount')} <span style={{ color: '#d24545' }}>*</span></span>
                  <input type="number" step="0.01" min="0" placeholder="2.00" value={String(field.value ?? 0)} onChange={field.onChange} onBlur={field.onBlur} />
                  {errors.amount && <span style={{ fontSize: 12, color: '#d24545', marginTop: 4 }}>{errors.amount.message}</span>}
                </label>
              )}
            />

            <div style={{ border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)', borderRadius: 10, padding: 12 }}>
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t('form.isActive')}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5 }}>{t('form.isActiveHint')}</div>
                    </div>
                    <button type="button" role="switch" aria-checked={field.value} onClick={() => field.onChange(!field.value)} style={toggleStyle(field.value)}>
                      <span style={toggleKnob(field.value)} />
                    </button>
                  </div>
                )}
              />
            </div>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={isSubmitting}>
              {tCommon('cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
              {isSubmitting ? '...' : isEditing ? tCommon('save') : tCommon('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
