'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  useCreateDiscountVoucher,
  useUpdateDiscountVoucher,
} from '@/hooks/use-discount-vouchers';
import type { DiscountVoucher } from '@/types/discount-voucher';

const voucherSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    description: z.string().optional(),
    type: z.enum(['fixed', 'manual']),
    amount: z.coerce.number().min(0).optional(),
    isActive: z.boolean(),
    allowMultiplePerOrder: z.boolean(),
    sortOrder: z.coerce.number().min(0).optional(),
  })
  .refine((data) => data.type !== 'fixed' || (data.amount !== undefined && data.amount > 0), {
    message: 'Amount is required for fixed vouchers',
    path: ['amount'],
  });

type VoucherFormData = z.infer<typeof voucherSchema>;

interface DiscountFormModalProps {
  isOpen: boolean;
  organizationId: string;
  voucher?: DiscountVoucher | null;
  onClose: () => void;
}

export function DiscountFormModal({ isOpen, organizationId, voucher, onClose }: DiscountFormModalProps) {
  const t = useTranslations('discounts');
  const tCommon = useTranslations('common');
  const isEditing = !!voucher;

  const createVoucher = useCreateDiscountVoucher(organizationId);
  const updateVoucher = useUpdateDiscountVoucher(organizationId);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<VoucherFormData>({
    resolver: zodResolver(voucherSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'fixed',
      amount: 0,
      isActive: true,
      allowMultiplePerOrder: false,
      sortOrder: 0,
    },
  });

  const type = watch('type');

  useEffect(() => {
    if (voucher) {
      reset({
        name: voucher.name,
        description: voucher.description || '',
        type: voucher.type,
        amount: Number(voucher.amount ?? 0),
        isActive: voucher.isActive,
        allowMultiplePerOrder: voucher.allowMultiplePerOrder,
        sortOrder: voucher.sortOrder,
      });
    } else {
      reset({ name: '', description: '', type: 'fixed', amount: 0, isActive: true, allowMultiplePerOrder: false, sortOrder: 0 });
    }
  }, [voucher, reset]);

  const onSubmit = async (data: VoucherFormData) => {
    const payload = {
      name: data.name,
      description: data.description || undefined,
      type: data.type,
      amount: data.type === 'fixed' ? data.amount : undefined,
      isActive: data.isActive,
      allowMultiplePerOrder: data.allowMultiplePerOrder,
      sortOrder: data.sortOrder,
    };

    try {
      if (isEditing && voucher) {
        await updateVoucher.mutateAsync({ id: voucher.id, data: payload });
      } else {
        await createVoucher.mutateAsync(payload);
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
            {/* Name */}
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <label className="auth-field">
                  <span>{t('form.name')} <span style={{ color: 'var(--danger)' }}>*</span></span>
                  <input type="text" placeholder={t('form.namePlaceholder')} {...field} />
                  {errors.name && <span style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.name.message}</span>}
                </label>
              )}
            />

            {/* Description */}
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <label className="auth-field">
                  <span>{t('form.description')}</span>
                  <input type="text" placeholder={t('form.descriptionPlaceholder')} {...field} />
                </label>
              )}
            />

            {/* Type */}
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <label className="auth-field">
                  <span>{t('form.type')} <span style={{ color: 'var(--danger)' }}>*</span></span>
                  <select className="select" value={field.value} onChange={field.onChange} onBlur={field.onBlur}>
                    <option value="fixed">{t('types.fixed')}</option>
                    <option value="manual">{t('types.manual')}</option>
                  </select>
                  <span style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5, marginTop: 4 }}>
                    {type === 'fixed' ? t('form.typeFixedHint') : t('form.typeManualHint')}
                  </span>
                </label>
              )}
            />

            {/* Amount (fixed only) */}
            {type === 'fixed' && (
              <Controller
                name="amount"
                control={control}
                render={({ field }) => (
                  <label className="auth-field">
                    <span>{t('form.amount')} <span style={{ color: 'var(--danger)' }}>*</span></span>
                    <input type="number" step="0.01" min="0" placeholder="3.00" value={String(field.value ?? 0)} onChange={field.onChange} onBlur={field.onBlur} />
                    {errors.amount && <span style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.amount.message}</span>}
                  </label>
                )}
              />
            )}

            {/* Active toggle */}
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

              <Controller
                name="allowMultiplePerOrder"
                control={control}
                render={({ field }) => (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t('form.allowMultiple')}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5 }}>{t('form.allowMultipleHint')}</div>
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
