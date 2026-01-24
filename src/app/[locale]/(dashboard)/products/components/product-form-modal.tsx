'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash01, X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { Toggle } from '@/components/ui/toggle/toggle';
import { useCategories } from '@/hooks/use-categories';
import { useCreateProduct, useUpdateProduct } from '@/hooks/use-products';
import type { Category } from '@/types/category';
import type { Product, ProductOption } from '@/types/product';

import { CategoryFormModal } from './category-form-modal';

const productSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  price: z.coerce.number().min(0, 'Price must be positive'),
  isActive: z.boolean(),
  isAvailable: z.boolean(),
  trackInventory: z.boolean(),
  stockQuantity: z.coerce.number().min(0).optional(),
  stockUnit: z.string().optional(),
  sortOrder: z.coerce.number().min(0).optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormModalProps {
  isOpen: boolean;
  eventId: string;
  product?: Product | null;
  onClose: () => void;
}

export function ProductFormModal({ isOpen, eventId, product, onClose }: ProductFormModalProps) {
  const t = useTranslations('products');
  const tCommon = useTranslations('common');
  const isEditing = !!product;

  const { data: categories } = useCategories(eventId);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  // Extras state (managed separately from react-hook-form)
  const [extras, setExtras] = useState<ProductOption[]>([]);
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraPrice, setNewExtraPrice] = useState('');

  // Category form modal state
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      categoryId: '',
      price: 0,
      isActive: true,
      isAvailable: true,
      trackInventory: false,
      stockQuantity: 0,
      stockUnit: 'Stück',
      sortOrder: 0,
    },
  });

  const trackInventory = watch('trackInventory');

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        description: product.description || '',
        categoryId: product.categoryId,
        price: product.price,
        isActive: product.isActive,
        isAvailable: product.isAvailable,
        trackInventory: product.trackInventory,
        stockQuantity: product.stockQuantity,
        stockUnit: product.stockUnit || 'Stück',
        sortOrder: product.sortOrder,
      });
      // Load existing extras from product options
      const existingExtras = product.options?.groups?.[0]?.options || [];
      setExtras(existingExtras);
    } else {
      reset({
        name: '',
        description: '',
        categoryId: '',
        price: 0,
        isActive: true,
        isAvailable: true,
        trackInventory: false,
        stockQuantity: 0,
        stockUnit: 'Stück',
        sortOrder: 0,
      });
      setExtras([]);
    }
  }, [product, reset]);

  const handleAddExtra = () => {
    if (!newExtraName.trim()) return;
    const price = parseFloat(newExtraPrice) || 0;
    setExtras([...extras, { name: newExtraName.trim(), priceModifier: price }]);
    setNewExtraName('');
    setNewExtraPrice('');
  };

  const handleRemoveExtra = (index: number) => {
    setExtras(extras.filter((_, i) => i !== index));
  };

  const handleCategoryCreated = (category: Category) => {
    // Auto-select the newly created category
    setValue('categoryId', category.id);
    setIsCategoryFormOpen(false);
  };

  const onSubmit = async (data: ProductFormData) => {
    if (!eventId) return;

    try {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        categoryId: data.categoryId,
        price: data.price,
        isActive: data.isActive,
        isAvailable: data.isAvailable,
        trackInventory: data.trackInventory,
        stockQuantity: data.trackInventory ? data.stockQuantity : undefined,
        stockUnit: data.trackInventory ? data.stockUnit : undefined,
        sortOrder: data.sortOrder,
        options: extras.length > 0
          ? {
              groups: [{
                name: 'Extras',
                type: 'multiple' as const,
                required: false,
                options: extras,
              }],
            }
          : { groups: [] },
      };

      if (isEditing && product) {
        await updateProduct.mutateAsync({
          eventId,
          id: product.id,
          data: payload,
        });
      } else {
        await createProduct.mutateAsync({
          eventId,
          data: payload,
        });
      }
      onClose();
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleClose = () => {
    reset();
    setExtras([]);
    setNewExtraName('');
    setNewExtraPrice('');
    onClose();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  return (
    <>
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModalOverlay>
        <Modal className="max-w-2xl">
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
                <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
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
                      name="categoryId"
                      control={control}
                      render={({ field }) => (
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-secondary">
                            {t('form.category')} <span className="text-error-primary">*</span>
                          </label>
                          <div className="flex gap-2">
                            <select
                              className="flex-1 rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-solid focus:outline-none focus:ring-2 focus:ring-brand-solid/20"
                              value={field.value || ''}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                            >
                              <option value="">{t('form.categoryPlaceholder')}</option>
                              {categories?.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              color="secondary"
                              size="md"
                              iconLeading={Plus}
                              onClick={() => setIsCategoryFormOpen(true)}
                              title={t('form.createCategory')}
                            />
                          </div>
                          {errors.categoryId && (
                            <p className="mt-1 text-sm text-error-primary">{errors.categoryId.message}</p>
                          )}
                        </div>
                      )}
                    />
                  </div>

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

                  {/* Price */}
                  <Controller
                    name="price"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={t('form.price')}
                        placeholder={t('form.pricePlaceholder')}
                        type="number"
                        isRequired
                        isInvalid={!!errors.price}
                        hint={errors.price?.message}
                        value={String(field.value)}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />

                  {/* Extras Section */}
                  <div className="space-y-3 rounded-lg border border-secondary p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-primary">{t('extras.title')}</h3>
                      <span className="text-xs text-tertiary">{t('extras.subtitle')}</span>
                    </div>

                    {/* Existing extras */}
                    {extras.length > 0 && (
                      <div className="space-y-2">
                        {extras.map((extra, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between rounded-md bg-secondary px-3 py-2"
                          >
                            <span className="text-sm text-primary">{extra.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-primary">
                                +{formatPrice(extra.priceModifier)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveExtra(index)}
                                className="rounded p-1 text-tertiary hover:bg-tertiary hover:text-primary"
                              >
                                <Trash01 className="size-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new extra */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Input
                          label={t('extras.name')}
                          placeholder={t('extras.namePlaceholder')}
                          value={newExtraName}
                          onChange={(value) => setNewExtraName(value)}
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          label={t('extras.price')}
                          placeholder="0.00"
                          type="number"
                          value={newExtraPrice}
                          onChange={(value) => setNewExtraPrice(value)}
                        />
                      </div>
                      <Button
                        type="button"
                        color="secondary"
                        size="md"
                        iconLeading={Plus}
                        onClick={handleAddExtra}
                        isDisabled={!newExtraName.trim()}
                      >
                        {t('extras.add')}
                      </Button>
                    </div>
                  </div>

                  {/* Status Toggles */}
                  <div className="space-y-3 rounded-lg border border-secondary p-4">
                    <Controller
                      name="isActive"
                      control={control}
                      render={({ field }) => (
                        <div className="flex items-center justify-between">
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

                    <Controller
                      name="isAvailable"
                      control={control}
                      render={({ field }) => (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-primary">{t('form.isAvailable')}</p>
                            <p className="text-xs text-tertiary">
                              {field.value ? t('status.available') : t('status.unavailable')}
                            </p>
                          </div>
                          <Toggle
                            isSelected={field.value}
                            onChange={field.onChange}
                          />
                        </div>
                      )}
                    />

                    <Controller
                      name="trackInventory"
                      control={control}
                      render={({ field }) => (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-primary">{t('form.trackInventory')}</p>
                            <p className="text-xs text-tertiary">
                              {t('form.trackInventoryDescription')}
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

                  {/* Inventory Fields (conditional) */}
                  {trackInventory && (
                    <div className="grid grid-cols-2 gap-4 rounded-lg border border-secondary p-4">
                      <Controller
                        name="stockQuantity"
                        control={control}
                        render={({ field }) => (
                          <Input
                            label={t('form.stockQuantity')}
                            type="number"
                            value={String(field.value ?? 0)}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                          />
                        )}
                      />

                      <Controller
                        name="stockUnit"
                        control={control}
                        render={({ field }) => (
                          <Input
                            label={t('form.stockUnit')}
                            placeholder="Stück"
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                          />
                        )}
                      />
                    </div>
                  )}
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

      {/* Category Form Modal */}
      <CategoryFormModal
        isOpen={isCategoryFormOpen}
        eventId={eventId}
        onClose={() => setIsCategoryFormOpen(false)}
        onCreated={handleCategoryCreated}
      />
    </>
  );
}
