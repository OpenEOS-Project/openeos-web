'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useCategories, useCreateCategory, useUpdateCategory } from '@/hooks/use-categories';
import { useProductionStations } from '@/hooks/use-production-stations';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import type { Category } from '@/types/category';
import { ColorPicker } from '@/components/shared/color-picker';
import { SettingToggle } from '@/components/shared/setting-toggle';

/*
 * Dieses Modal lag zweimal im Baum, unter products/ und unter categories/,
 * beide in Benutzung und fast gleich — aber schon auseinandergelaufen: die
 * eine Fassung kannte einen onCreated-Rueckruf, die andere nicht, und sie
 * legten unterschiedliche Standardfarben an. Was ein Nutzer sah, hing davon
 * ab, ueber welche Seite er das Modal geoeffnet hatte.
 *
 * Geblieben ist die Obermenge. Deshalb liegt es hier und nicht unter einer
 * der beiden Seiten: keine von beiden ist die Heimat.
 */

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
  onCreated?: (category: Category) => void;
}

export function CategoryFormModal({
  isOpen,
  eventId,
  category,
  onClose,
  onCreated,
}: CategoryFormModalProps) {
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
      color: '#6366f1',
      parentId: '',
      sortOrder: 0,
      isActive: true,
      productionStationId: '',
    },
  });


  useEffect(() => {
    if (category) {
      reset({
        name: category.name,
        description: category.description || '',
        color: category.color || '#6366f1',
        parentId: category.parentId || '',
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        productionStationId: category.productionStationId || '',
      });
    } else {
      reset({
        name: '',
        description: '',
        color: '#6366f1',
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
        const result = await createCategory.mutateAsync({
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
        if (onCreated && result) {
          onCreated(result);
        }
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
      <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
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
                  {errors.name && (
                    <span role="alert" style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.name.message}</span>
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

              <Controller
              name="sortOrder"
              control={control}
              render={({ field }) => (
                <label className="auth-field">
                  <span>{t('table.sortOrder')}</span>
                  <input type="number" min="0" step="1" value={String(field.value ?? 0)} onChange={field.onChange} onBlur={field.onBlur} />
                </label>
              )}
            />

              <Controller
              name="color"
              control={control}
              render={({ field }) => (
                <div className="auth-field">
                  <span>{t('form.color')}</span>
                  <ColorPicker
                    value={field.value || '#6366f1'}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </div>
              )}
            />

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
                      <option value="">{t('form.productionStationNone')}</option>
                      {productionStations?.map((station) => (
                        <option key={station.id} value={station.id}>{station.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              />
            )}

            {/* Ohne Hinweistext: er sagte nur "Aktiv" bzw. "Inaktiv" und
                wiederholte damit, was der Schalter daneben schon zeigt. */}
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <SettingToggle
                  label={t('form.isActive')}
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
