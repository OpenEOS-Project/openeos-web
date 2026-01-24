'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { Toggle } from '@/components/ui/toggle/toggle';
import { useCategories, useCreateCategory, useUpdateCategory } from '@/hooks/use-categories';
import type { Category } from '@/types/category';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  color: z.string().optional(),
  parentId: z.string().optional(),
  sortOrder: z.coerce.number().min(0).optional(),
  isActive: z.boolean(),
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
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const {
    control,
    handleSubmit,
    reset,
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
    },
  });

  useEffect(() => {
    if (category) {
      reset({
        name: category.name,
        description: category.description || '',
        color: category.color || '',
        parentId: category.parentId || '',
        sortOrder: category.sortOrder,
        isActive: category.isActive,
      });
    } else {
      reset({
        name: '',
        description: '',
        color: '',
        parentId: '',
        sortOrder: 0,
        isActive: true,
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

  // Filter out current category and its children for parent selection
  const availableParents = categories?.filter((c) => c.id !== category?.id) || [];

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModalOverlay>
        <Modal className="max-w-lg">
          <Dialog className="w-full">
            <div className="w-full rounded-xl bg-primary shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
                <h2 className="text-lg font-semibold text-primary">
                  {isEditing ? t('edit') : t('create')}
                </h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-2 text-fg-quaternary transition hover:bg-secondary hover:text-fg-quaternary_hover"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-4 px-6 py-5">
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={t('form.name')}
                        placeholder={t('form.namePlaceholder')}
                        isRequired
                        isInvalid={!!errors.name}
                        hint={errors.name?.message}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />

                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={t('form.description')}
                        placeholder={t('form.descriptionPlaceholder')}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Controller
                      name="color"
                      control={control}
                      render={({ field }) => (
                        <Input
                          label={t('form.color')}
                          placeholder={t('form.colorPlaceholder')}
                          type="color"
                          value={field.value || '#6366f1'}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      )}
                    />

                    <Controller
                      name="sortOrder"
                      control={control}
                      render={({ field }) => (
                        <Input
                          label={t('table.sortOrder')}
                          type="number"
                          value={String(field.value ?? 0)}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                  </div>

                  {availableParents.length > 0 && (
                    <Controller
                      name="parentId"
                      control={control}
                      render={({ field }) => (
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-secondary">
                            {t('form.parent')}
                          </label>
                          <select
                            className="w-full rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-solid focus:outline-none focus:ring-2 focus:ring-brand-solid/20"
                            value={field.value || ''}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                          >
                            <option value="">{t('form.parentPlaceholder')}</option>
                            {availableParents.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    />
                  )}

                  <Controller
                    name="isActive"
                    control={control}
                    render={({ field }) => (
                      <div className="flex items-center justify-between rounded-lg border border-secondary px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-primary">{t('form.isActive')}</p>
                          <p className="text-xs text-tertiary">
                            {field.value ? t('status.active') : t('status.inactive')}
                          </p>
                        </div>
                        <Toggle
                          isSelected={field.value}
                          onChange={field.onChange}
                        />
                      </div>
                    )}
                  />
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
                  <Button
                    type="button"
                    color="secondary"
                    onClick={handleClose}
                    isDisabled={isSubmitting}
                  >
                    {tCommon('cancel')}
                  </Button>
                  <Button
                    type="submit"
                    isLoading={isSubmitting}
                    isDisabled={isSubmitting}
                  >
                    {isEditing ? tCommon('save') : tCommon('create')}
                  </Button>
                </div>
              </form>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
