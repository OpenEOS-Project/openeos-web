'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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

  const [optionGroups, setOptionGroups] = useState<ProductOptionGroup[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const isActiveVal = watch('isActive');
  const isAvailableVal = watch('isAvailable');

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

  const handleAddGroup = () => {
    setOptionGroups([...optionGroups, { name: '', type: 'multiple', required: false, options: [] }]);
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

  const handleUpdateOption = (groupIndex: number, optionIndex: number, field: string, value: unknown) => {
    setOptionGroups(
      optionGroups.map((g, i) =>
        i === groupIndex
          ? { ...g, options: g.options.map((o, oi) => (oi === optionIndex ? { ...o, [field]: value } : o)) }
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
      const cleanedGroups = optionGroups
        .filter((g) => g.name.trim())
        .map((g) => ({ ...g, options: g.options.filter((o) => o.name.trim()) }));

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
        await updateProduct.mutateAsync({ eventId, id: product.id, data: { ...payload, imageUrl: imageUrl || null } });
      } else {
        await createProduct.mutateAsync({ eventId, data: { ...payload, imageUrl: imageUrl || undefined } });
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

  const inputRow: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
    border: '1px solid color-mix(in oklab, var(--ink) 14%, transparent)',
    background: 'var(--paper)', color: 'var(--ink)', outline: 'none',
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal__overlay" onClick={handleClose}>
        <div className="modal__panel" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
          <div className="modal__head">
            <h2>{isEditing ? t('edit') : t('create')}</h2>
            <button type="button" className="modal__close" onClick={handleClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="modal__body" style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Image */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', opacity: 0.7, marginBottom: 8 }}>
                  {t('form.image.title')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ProductImage imageUrl={imageUrl} productName={watch('name') || '?'} size="lg" />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                    <button type="button" className="btn btn--ghost" style={{ fontSize: 12 }} disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
                      {isUploading ? t('form.image.uploading') : t('form.image.upload')}
                    </button>
                    <button type="button" className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => setIsIconPickerOpen(true)}>
                      {t('form.image.chooseIcon')}
                    </button>
                    {imageUrl && (
                      <button type="button" className="btn btn--ghost" style={{ fontSize: 12, color: '#d24545' }} onClick={() => setImageUrl(null)}>
                        {t('form.image.remove')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Name + Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                  name="categoryId"
                  control={control}
                  render={({ field }) => (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', opacity: 0.7, marginBottom: 6 }}>
                        {t('form.category')} <span style={{ color: '#d24545' }}>*</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select
                          className="select"
                          style={{ flex: 1 }}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value)}
                          onBlur={field.onBlur}
                        >
                          <option value="">{t('form.categoryPlaceholder')}</option>
                          {categories?.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          style={{ flexShrink: 0, padding: '0 10px' }}
                          onClick={() => setIsCategoryFormOpen(true)}
                          title={t('form.createCategory')}
                        >
                          +
                        </button>
                      </div>
                      {errors.categoryId && (
                        <div style={{ fontSize: 12, color: '#d24545', marginTop: 4 }}>{errors.categoryId.message}</div>
                      )}
                    </div>
                  )}
                />
              </div>

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

              {/* Price */}
              <Controller
                name="price"
                control={control}
                render={({ field }) => (
                  <label className="auth-field">
                    <span>{t('form.price')} <span style={{ color: '#d24545' }}>*</span></span>
                    <input type="number" step="0.01" placeholder={t('form.pricePlaceholder')} value={String(field.value)} onChange={field.onChange} onBlur={field.onBlur} />
                    {errors.price && <span style={{ fontSize: 12, color: '#d24545', marginTop: 4 }}>{errors.price.message}</span>}
                  </label>
                )}
              />

              {/* Production Station */}
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
                      <span style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5, marginTop: 4 }}>{t('form.productionStationHint')}</span>
                    </label>
                  )}
                />
              )}

              {/* Option Groups */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t('form.optionGroups')}</div>
                  <button type="button" className="btn btn--ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={handleAddGroup}>
                    + {t('form.addGroup')}
                  </button>
                </div>

                {optionGroups.map((group, groupIndex) => (
                  <div key={groupIndex} style={{ border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)', borderRadius: 10, padding: 12, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="text"
                        style={{ ...inputRow, flex: 1 }}
                        placeholder={t('form.groupNamePlaceholder')}
                        value={group.name}
                        onChange={(e) => handleUpdateGroup(groupIndex, 'name', e.target.value)}
                      />
                      <select
                        style={inputRow}
                        value={group.type}
                        onChange={(e) => handleUpdateGroup(groupIndex, 'type', e.target.value)}
                      >
                        <option value="single">{t('form.typeSingle')}</option>
                        <option value="multiple">{t('form.typeMultiple')}</option>
                        <option value="ingredients">{t('form.typeIngredients')}</option>
                      </select>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ink)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={group.required}
                          onChange={(e) => handleUpdateGroup(groupIndex, 'required', e.target.checked)}
                        />
                        {t('form.required')}
                      </label>
                      <button type="button" className="btn btn--ghost" style={{ padding: '4px 8px', color: '#d24545', fontSize: 12 }} onClick={() => handleRemoveGroup(groupIndex)}>
                        ✕
                      </button>
                    </div>

                    {group.options.length > 0 && (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto auto', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', opacity: 0.5 }}>{t('form.optionName')}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', opacity: 0.5 }}>{t('form.optionPrice')}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', opacity: 0.5 }}>
                            {group.type === 'ingredients' ? t('form.includedOption') : t('form.defaultOption')}
                          </span>
                          <span />
                        </div>
                        {group.options.map((option, optionIndex) => (
                          <div key={optionIndex} style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto auto', gap: 6, marginBottom: 4, alignItems: 'center' }}>
                            <input
                              type="text"
                              style={inputRow}
                              placeholder={t('form.optionName')}
                              value={option.name}
                              onChange={(e) => handleUpdateOption(groupIndex, optionIndex, 'name', e.target.value)}
                            />
                            <input
                              type="number"
                              step="0.01"
                              style={inputRow}
                              placeholder="0.00"
                              value={option.priceModifier}
                              onChange={(e) => handleUpdateOption(groupIndex, optionIndex, 'priceModifier', parseFloat(e.target.value) || 0)}
                            />
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <input
                                type="checkbox"
                                checked={option.default ?? false}
                                onChange={(e) => handleUpdateOption(groupIndex, optionIndex, 'default', e.target.checked)}
                              />
                            </div>
                            <button type="button" className="btn btn--ghost" style={{ padding: '2px 6px', fontSize: 12 }} onClick={() => handleRemoveOption(groupIndex, optionIndex)}>
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--green-ink)', textAlign: 'left', padding: 0 }}
                      onClick={() => handleAddOption(groupIndex)}
                    >
                      + {t('form.addOption')}
                    </button>
                  </div>
                ))}
              </div>

              {/* Status Toggles */}
              <div style={{ border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t('form.isActive')}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5 }}>{t('form.activeDescription')}</div>
                      </div>
                      <button type="button" role="switch" aria-checked={field.value} onClick={() => field.onChange(!field.value)} style={toggleStyle(field.value)}>
                        <span style={toggleKnob(field.value)} />
                      </button>
                    </div>
                  )}
                />

                <Controller
                  name="isAvailable"
                  control={control}
                  render={({ field }) => (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t('form.isAvailable')}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5 }}>{t('form.availableDescription')}</div>
                      </div>
                      <button type="button" role="switch" aria-checked={field.value} onClick={() => field.onChange(!field.value)} style={toggleStyle(field.value)}>
                        <span style={toggleKnob(field.value)} />
                      </button>
                    </div>
                  )}
                />

                <Controller
                  name="trackInventory"
                  control={control}
                  render={({ field }) => (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t('form.trackInventory')}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5 }}>{t('form.trackInventoryDescription')}</div>
                      </div>
                      <button type="button" role="switch" aria-checked={field.value} onClick={() => field.onChange(!field.value)} style={toggleStyle(field.value)}>
                        <span style={toggleKnob(field.value)} />
                      </button>
                    </div>
                  )}
                />
              </div>

              {/* Inventory Fields */}
              {trackInventory && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)', borderRadius: 10, padding: 12 }}>
                  <Controller
                    name="stockQuantity"
                    control={control}
                    render={({ field }) => (
                      <label className="auth-field">
                        <span>{t('form.stockQuantity')}</span>
                        <input type="number" value={String(field.value ?? 0)} onChange={field.onChange} onBlur={field.onBlur} />
                      </label>
                    )}
                  />

                  <Controller
                    name="stockUnit"
                    control={control}
                    render={({ field }) => (
                      <label className="auth-field">
                        <span>{t('form.stockUnit')}</span>
                        <input type="text" placeholder="Stück" {...field} />
                      </label>
                    )}
                  />
                </div>
              )}
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

      <CategoryFormModal
        isOpen={isCategoryFormOpen}
        eventId={eventId}
        onClose={() => setIsCategoryFormOpen(false)}
        onCreated={handleCategoryCreated}
      />

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
