'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ImagePlus, Plus, Trash01, X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { Toggle } from '@/components/ui/toggle/toggle';
import { ProductImage } from '@/components/shared/product-image';
import { PosIconPicker } from '@/components/shared/pos-icon-picker';
import { useCategories } from '@/hooks/use-categories';
import { useCreateProduct, useUpdateProduct } from '@/hooks/use-products';
import { useProductionStations } from '@/hooks/use-production-stations';
import { uploadsApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { Category } from '@/types/category';
import type { Product, ProductOptionGroup } from '@/types/product';

import { CategoryFormModal } from './category-form-modal';

const productSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  categoryId: z.string().uuid('Category is required'),
  price: z.coerce.number().min(0, 'Price must be positive'),
  isActive: z.boolean(),
  isAvailable: z.boolean(),
  trackInventory: z.boolean(),
  stockQuantity: z.coerce.number().min(0).optional(),
  stockUnit: z.string().optional(),
  sortOrder: z.coerce.number().min(0).optional(),
  productionStationId: z.string().optional(),
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
  const { data: productionStations } = useProductionStations(eventId);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  // Option groups state (managed separately from react-hook-form)
  const [optionGroups, setOptionGroups] = useState<ProductOptionGroup[]>([]);

  // Image state
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      productionStationId: '',
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
        productionStationId: product.productionStationId || '',
      });
      setOptionGroups(product.options?.groups || []);
      setImageUrl(product.imageUrl ?? null);
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
        productionStationId: '',
      });
      setOptionGroups([]);
      setImageUrl(null);
    }
  }, [product, reset]);

  // Option group helpers
  const handleAddGroup = () => {
    setOptionGroups([
      ...optionGroups,
      { name: '', type: 'multiple', required: false, options: [] },
    ]);
  };

  const handleRemoveGroup = (groupIndex: number) => {
    setOptionGroups(optionGroups.filter((_, i) => i !== groupIndex));
  };

  const handleUpdateGroup = (groupIndex: number, field: keyof ProductOptionGroup, value: unknown) => {
    setOptionGroups(optionGroups.map((g, i) => (i === groupIndex ? { ...g, [field]: value } : g)));
  };

  const handleAddOption = (groupIndex: number) => {
    setOptionGroups(
      optionGroups.map((g, i) =>
        i === groupIndex
          ? { ...g, options: [...g.options, { name: '', priceModifier: 0, default: false }] }
          : g,
      ),
    );
  };

  const handleRemoveOption = (groupIndex: number, optionIndex: number) => {
    setOptionGroups(
      optionGroups.map((g, i) =>
        i === groupIndex
          ? { ...g, options: g.options.filter((_, oi) => oi !== optionIndex) }
          : g,
      ),
    );
  };

  const handleUpdateOption = (
    groupIndex: number,
    optionIndex: number,
    field: string,
    value: unknown,
  ) => {
    setOptionGroups(
      optionGroups.map((g, i) =>
        i === groupIndex
          ? {
              ...g,
              options: g.options.map((o, oi) =>
                oi === optionIndex ? { ...o, [field]: value } : o,
              ),
            }
          : g,
      ),
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organizationId) return;

    setIsUploading(true);
    try {
      const result = await uploadsApi.uploadProductImage(organizationId, file);
      setImageUrl(result.data.url);
    } catch {
      // Upload failed — silently ignore
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCategoryCreated = (category: Category) => {
    setValue('categoryId', category.id);
    setIsCategoryFormOpen(false);
  };

  const onSubmit = async (data: ProductFormData) => {
    if (!eventId) return;

    try {
      // Filter out option groups with no name and options with no name
      const cleanedGroups = optionGroups
        .filter((g) => g.name.trim())
        .map((g) => ({
          ...g,
          options: g.options.filter((o) => o.name.trim()),
        }));

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
        options: { groups: cleanedGroups },
        productionStationId: data.productionStationId || null,
      };

      if (isEditing && product) {
        await updateProduct.mutateAsync({
          eventId,
          id: product.id,
          data: { ...payload, imageUrl: imageUrl || null },
        });
      } else {
        await createProduct.mutateAsync({
          eventId,
          data: { ...payload, imageUrl: imageUrl || undefined },
        });
      }
      onClose();
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleClose = () => {
    reset();
    setOptionGroups([]);
    setImageUrl(null);
    onClose();
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
                  {/* Product Image */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-secondary">
                      {t('form.image.title')}
                    </label>
                    <div className="flex items-center gap-4">
                      <ProductImage imageUrl={imageUrl} productName={watch('name') || '?'} size="lg" />
                      <div className="flex flex-wrap gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                        <Button
                          type="button"
                          color="secondary"
                          size="sm"
                          iconLeading={ImagePlus}
                          isLoading={isUploading}
                          isDisabled={isUploading}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {isUploading ? t('form.image.uploading') : t('form.image.upload')}
                        </Button>
                        <Button
                          type="button"
                          color="secondary"
                          size="sm"
                          onClick={() => setIsIconPickerOpen(true)}
                        >
                          {t('form.image.chooseIcon')}
                        </Button>
                        {imageUrl && (
                          <Button
                            type="button"
                            color="secondary"
                            size="sm"
                            iconLeading={Trash01}
                            onClick={() => setImageUrl(null)}
                          >
                            {t('form.image.remove')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

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
                              onChange={(e) => field.onChange(e.target.value)}
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

                  {/* Production Station */}
                  {(productionStations?.length ?? 0) > 0 && (
                    <Controller
                      name="productionStationId"
                      control={control}
                      render={({ field }) => (
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-secondary">
                            {t('form.productionStation')}
                          </label>
                          <select
                            className="w-full rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-solid focus:outline-none focus:ring-2 focus:ring-brand-solid/20"
                            value={field.value || ''}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                          >
                            <option value="">—</option>
                            {productionStations?.map((station) => (
                              <option key={station.id} value={station.id}>
                                {station.name}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-tertiary">
                            {t('form.productionStationHint')}
                          </p>
                        </div>
                      )}
                    />
                  )}

                  {/* Option Groups Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-primary">{t('form.optionGroups')}</h3>
                      <Button
                        type="button"
                        color="secondary"
                        size="sm"
                        iconLeading={Plus}
                        onClick={handleAddGroup}
                      >
                        {t('form.addGroup')}
                      </Button>
                    </div>

                    {optionGroups.map((group, groupIndex) => (
                      <div
                        key={groupIndex}
                        className="space-y-3 rounded-lg border border-secondary p-4"
                      >
                        {/* Group config row */}
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <input
                              type="text"
                              className="w-full rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary placeholder:text-quaternary focus:border-brand-solid focus:outline-none focus:ring-2 focus:ring-brand-solid/20"
                              placeholder={t('form.groupNamePlaceholder')}
                              value={group.name}
                              onChange={(e) =>
                                handleUpdateGroup(groupIndex, 'name', e.target.value)
                              }
                            />
                          </div>
                          <select
                            className="rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-solid focus:outline-none focus:ring-2 focus:ring-brand-solid/20"
                            value={group.type}
                            onChange={(e) =>
                              handleUpdateGroup(groupIndex, 'type', e.target.value)
                            }
                          >
                            <option value="single">{t('form.typeSingle')}</option>
                            <option value="multiple">{t('form.typeMultiple')}</option>
                            <option value="ingredients">{t('form.typeIngredients')}</option>
                          </select>
                          <label className="flex items-center gap-1.5 whitespace-nowrap py-2 text-sm text-secondary">
                            <input
                              type="checkbox"
                              className="size-4 rounded border-primary text-brand-solid focus:ring-brand-solid/20"
                              checked={group.required}
                              onChange={(e) =>
                                handleUpdateGroup(groupIndex, 'required', e.target.checked)
                              }
                            />
                            {t('form.required')}
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveGroup(groupIndex)}
                            className="rounded-lg p-2 text-tertiary transition hover:bg-secondary hover:text-error-primary"
                          >
                            <Trash01 className="size-4" />
                          </button>
                        </div>

                        {/* Options table */}
                        {group.options.length > 0 && (
                          <div className="space-y-1">
                            <div className="grid grid-cols-[1fr_100px_auto_auto] items-center gap-2 px-1 text-xs font-medium text-tertiary">
                              <span>{t('form.optionName')}</span>
                              <span>{t('form.optionPrice')}</span>
                              <span>
                                {group.type === 'ingredients'
                                  ? t('form.includedOption')
                                  : t('form.defaultOption')}
                              </span>
                              <span />
                            </div>
                            {group.options.map((option, optionIndex) => (
                              <div
                                key={optionIndex}
                                className="grid grid-cols-[1fr_100px_auto_auto] items-center gap-2"
                              >
                                <input
                                  type="text"
                                  className="rounded-md border border-primary bg-primary px-2.5 py-1.5 text-sm text-primary placeholder:text-quaternary focus:border-brand-solid focus:outline-none focus:ring-2 focus:ring-brand-solid/20"
                                  placeholder={t('form.optionName')}
                                  value={option.name}
                                  onChange={(e) =>
                                    handleUpdateOption(
                                      groupIndex,
                                      optionIndex,
                                      'name',
                                      e.target.value,
                                    )
                                  }
                                />
                                <input
                                  type="number"
                                  step="0.01"
                                  className="rounded-md border border-primary bg-primary px-2.5 py-1.5 text-sm text-primary placeholder:text-quaternary focus:border-brand-solid focus:outline-none focus:ring-2 focus:ring-brand-solid/20"
                                  placeholder="0.00"
                                  value={option.priceModifier}
                                  onChange={(e) =>
                                    handleUpdateOption(
                                      groupIndex,
                                      optionIndex,
                                      'priceModifier',
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                                <div className="flex justify-center">
                                  <input
                                    type="checkbox"
                                    className="size-4 rounded border-primary text-brand-solid focus:ring-brand-solid/20"
                                    checked={option.default ?? false}
                                    onChange={(e) =>
                                      handleUpdateOption(
                                        groupIndex,
                                        optionIndex,
                                        'default',
                                        e.target.checked,
                                      )
                                    }
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOption(groupIndex, optionIndex)}
                                  className="rounded p-1 text-tertiary transition hover:bg-secondary hover:text-error-primary"
                                >
                                  <X className="size-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add option button */}
                        <button
                          type="button"
                          onClick={() => handleAddOption(groupIndex)}
                          className="flex items-center gap-1 text-sm text-brand-secondary transition hover:text-brand-secondary_hover"
                        >
                          <Plus className="size-4" />
                          {t('form.addOption')}
                        </button>
                      </div>
                    ))}
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
                              {t('form.activeDescription')}
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
                              {t('form.availableDescription')}
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

      {/* POS Icon Picker Modal */}
      <PosIconPicker
        isOpen={isIconPickerOpen}
        onClose={() => setIsIconPickerOpen(false)}
        onSelect={(iconUrl) => {
          setImageUrl(iconUrl);
          setIsIconPickerOpen(false);
        }}
      />
    </>
  );
}
