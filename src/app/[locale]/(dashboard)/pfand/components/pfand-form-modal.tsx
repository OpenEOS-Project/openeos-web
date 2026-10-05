'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useCreatePfandType, useUpdatePfandType } from '@/hooks/use-pfand-types';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import type { PfandType } from '@/types/pfand';
import { SettingToggle } from '@/components/shared/setting-toggle';
import { PriceInput } from '@/components/shared/price-input';

// Als Factory, damit die Meldungen ueber next-intl uebersetzt werden —
// ausserhalb der Komponente gibt es noch kein t().
function createPfandSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('nameRequired')).max(255),
    amount: z.coerce.number().min(0, t('amountNotNegative')),
    isActive: z.boolean(),
    sortOrder: z.coerce.number().min(0).optional(),
  });
}

type PfandFormData = z.infer<ReturnType<typeof createPfandSchema>>;

interface PfandFormModalProps {
  isOpen: boolean;
  organizationId: string;
  pfandType?: PfandType | null;
  onClose: () => void;
}

export function PfandFormModal({ isOpen, organizationId, pfandType, onClose }: PfandFormModalProps) {
  const t = useTranslations('pfand');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');
  const validationSchema = useMemo(() => createPfandSchema(tValidation), [tValidation]);
  const isEditing = !!pfandType;

  const createType = useCreatePfandType(organizationId);
  const updateType = useUpdatePfandType(organizationId);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PfandFormData>({
    resolver: zodResolver(validationSchema),
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

  if (!isOpen) return null;

  return (
    <div className="modal__overlay" onClick={handleClose}>
      <div className="modal__panel modal__panel--md" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{isEditing ? t('edit') : t('create')}</h2>
          <DialogCloseButton onClick={handleClose} />
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <label className="auth-field">
                  <span>{t('form.name')} <span style={{ color: 'var(--danger)' }}>*</span></span>
                  <input type="text" placeholder={t('form.namePlaceholder')} {...field} />
                  {errors.name && <span role="alert" className="auth-field__error">{errors.name.message}</span>}
                </label>
              )}
            />

            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <label className="auth-field">
                  <span>{t('form.amount')} <span style={{ color: 'var(--danger)' }}>*</span></span>
                  <PriceInput
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    invalid={!!errors.amount}
                  />
                  {errors.amount && <span role="alert" className="auth-field__error">{errors.amount.message}</span>}
                </label>
              )}
            />

            {/* Ohne Wrapper: SettingToggle bringt seinen Rahmen selbst mit,
                der aeussere ergab einen Kasten im Kasten. */}
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <SettingToggle
                  label={t('form.isActive')}
                  hint={t('form.isActiveHint')}
                  checked={!!field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={isSubmitting}>
              {tCommon('cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
              {isSubmitting ? tCommon('saving') : isEditing ? tCommon('save') : tCommon('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
