'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useCategories, useCreateCategory, useUpdateCategory } from '@/hooks/use-categories';
import { useProductionStations } from '@/hooks/use-production-stations';
import type { Category } from '@/types/category';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  color: z.string().optional(),
  parentId: z.string().optional(),
  sortOrder: z.coerce.number().min(0).optional(),
  isActive: z.boolean(),
  productionStationId: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormModalProps {
  isOpen: boolean;
  eventId: string;
  category?: Category | null;
  onClose: () => void;
}

export function CategoryFormModal({ isOpen, eventId, category, onClose }: CategoryFormModalProps) {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');
  const isEditing = !!category;

  const { data: categories } = useCategories(eventId);
  const { data: productionStations } = useProductionStations(eventId);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
      color: '',
      parentId: '',
      sortOrder: 0,
      isActive: true,
      productionStationId: '',
    },
  });

  const isActiveValue = watch('isActive');

  useEffect(() => {
    if (category) {
      reset({
        name: category.name,
        description: category.description || '',
        color: category.color || '',
        parentId: category.parentId || '',
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        productionStationId: category.productionStationId || '',
      });
    } else {
      reset({
        name: '',
        description: '',
        color: '',
        parentId: '',
        sortOrder: 0,
        isActive: true,
        productionStationId: '',
      });
    }
  }, [category, reset]);

  const onSubmit = async (data: CategoryFormData) => {
    if (!eventId) return;

    try {
      if (isEditing && category) {
        await updateCategory.mutateAsync({
          eventId,
          id: category.id,
          data: {
            name: data.name,
            description: data.description || undefined,
            color: data.color || undefined,
            parentId: data.parentId || null,
            sortOrder: data.sortOrder,
            isActive: data.isActive,
            productionStationId: data.productionStationId || null,
          },
        });
      } else {
        await createCategory.mutateAsync({
          eventId,
          data: {
            name: data.name,
            description: data.description || undefined,
            color: data.color || undefined,
            parentId: data.parentId || undefined,
            sortOrder: data.sortOrder,
            isActive: data.isActive,
            productionStationId: data.productionStationId || undefined,
          },
        });
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

  const availableParents = categories?.filter((c) => c.id !== category?.id) || [];

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
                  {errors.name && (
                    <span style={{ fontSize: 12, color: '#d24545', marginTop: 4 }}>{errors.name.message}</span>
                  )}
                </label>
              )}
            />

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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Controller
                name="color"
                control={control}
                render={({ field }) => (
                  <label className="auth-field">
                    <span>{t('form.color')}</span>
                    <input type="color" value={field.value || '#6366f1'} onChange={field.onChange} onBlur={field.onBlur} style={{ height: 40, padding: 4 }} />
                  </label>
                )}
              />

              <Controller
                name="sortOrder"
                control={control}
                render={({ field }) => (
                  <label className="auth-field">
                    <span>{t('table.sortOrder')}</span>
                    <input type="number" value={String(field.value ?? 0)} onChange={field.onChange} onBlur={field.onBlur} />
                  </label>
                )}
              />
            </div>

            {availableParents.length > 0 && (
              <Controller
                name="parentId"
                control={control}
                render={({ field }) => (
                  <label className="auth-field">
                    <span>{t('form.parent')}</span>
                    <select className="select" value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur}>
                      <option value="">{t('form.parentPlaceholder')}</option>
                      {availableParents.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              />
            )}

            {(productionStations?.length ?? 0) > 0 && (
              <Controller
                name="productionStationId"
                control={control}
                render={({ field }) => (
                  <label className="auth-field">
                    <span>{t('form.productionStation')}</span>
                    <select className="select" value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur}>
                      <option value="">—</option>
                      {productionStations?.map((station) => (
                        <option key={station.id} value={station.id}>{station.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              />
            )}

            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                  borderRadius: 10, padding: '12px 16px',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t('form.isActive')}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.55 }}>
                      {isActiveValue ? t('status.active') : t('status.inactive')}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={field.value}
                    onClick={() => field.onChange(!field.value)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: field.value ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 20%, transparent)',
                      position: 'relative', transition: 'background 0.2s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 2, left: field.value ? 22 : 2,
                      width: 20, height: 20, borderRadius: 10, background: 'var(--paper)',
                      transition: 'left 0.2s', display: 'block',
                    }} />
                  </button>
                </div>
              )}
            />
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
