'use client';

import { useState, useEffect } from 'react';
import { X, Check } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { cx } from '@/utils/cx';
import { useTranslations } from 'next-intl';
import type { Product, ProductOptionGroup } from '@/types/product';

interface SelectedOption {
  group: string;
  option: string;
  priceModifier: number;
  excluded?: boolean;
}

interface ProductOptionsModalProps {
  isOpen: boolean;
  product: Product;
  onClose: () => void;
  onAdd: (selectedOptions: SelectedOption[]) => void;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
}

function buildDefaultSelections(groups: ProductOptionGroup[]): SelectedOption[] {
  const defaults: SelectedOption[] = [];

  for (const group of groups) {
    if (group.type === 'ingredients') {
      // All ingredients start selected
      for (const option of group.options) {
        defaults.push({
          group: group.name,
          option: option.name,
          priceModifier: option.priceModifier,
        });
      }
    } else if (group.type === 'single') {
      const defaultOption = group.options.find((o) => o.default);
      if (defaultOption) {
        defaults.push({
          group: group.name,
          option: defaultOption.name,
          priceModifier: defaultOption.priceModifier,
        });
      }
    } else if (group.type === 'multiple') {
      for (const option of group.options) {
        if (option.default) {
          defaults.push({
            group: group.name,
            option: option.name,
            priceModifier: option.priceModifier,
          });
        }
      }
    }
  }

  return defaults;
}

export function ProductOptionsModal({
  isOpen,
  product,
  onClose,
  onAdd,
}: ProductOptionsModalProps) {
  const t = useTranslations('pos');
  const groups = product.options?.groups || [];

  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>(() =>
    buildDefaultSelections(groups),
  );

  // Re-initialize defaults when the modal opens with a new product
  useEffect(() => {
    if (isOpen) {
      setSelectedOptions(buildDefaultSelections(groups));
    }
  }, [isOpen, product.id]);

  const handleOptionToggle = (group: ProductOptionGroup, optionName: string, priceModifier: number) => {
    if (group.type === 'ingredients') {
      setSelectedOptions((prev) => {
        const existing = prev.find(
          (o) => o.group === group.name && o.option === optionName,
        );

        if (existing) {
          if (existing.excluded) {
            // Re-include: remove excluded flag
            return prev.map((o) =>
              o.group === group.name && o.option === optionName
                ? { ...o, excluded: false }
                : o,
            );
          } else {
            // Exclude: mark as excluded
            return prev.map((o) =>
              o.group === group.name && o.option === optionName
                ? { ...o, excluded: true }
                : o,
            );
          }
        }
        // Should not happen for ingredients, but handle gracefully
        return [...prev, { group: group.name, option: optionName, priceModifier }];
      });
      return;
    }

    const isMultiple = group.type === 'multiple';

    setSelectedOptions((prev) => {
      const existingIndex = prev.findIndex(
        (o) => o.group === group.name && o.option === optionName,
      );

      if (existingIndex >= 0) {
        // Remove if already selected
        return prev.filter((_, i) => i !== existingIndex);
      }

      if (isMultiple) {
        // Add to existing selections for this group
        return [...prev, { group: group.name, option: optionName, priceModifier }];
      } else {
        // Replace selection for this group (single select)
        return [
          ...prev.filter((o) => o.group !== group.name),
          { group: group.name, option: optionName, priceModifier },
        ];
      }
    });
  };

  const isOptionSelected = (groupName: string, optionName: string) => {
    const opt = selectedOptions.find((o) => o.group === groupName && o.option === optionName);
    return opt ? !opt.excluded : false;
  };

  const isOptionExcluded = (groupName: string, optionName: string) => {
    const opt = selectedOptions.find((o) => o.group === groupName && o.option === optionName);
    return opt?.excluded === true;
  };

  // Price calculation: only include non-excluded options with positive priceModifier
  const totalOptionsPrice = selectedOptions
    .filter((o) => !o.excluded && o.priceModifier > 0)
    .reduce((sum, o) => sum + o.priceModifier, 0);
  const totalPrice = Number(product.price) + totalOptionsPrice;

  // Check if all required groups have selections
  const hasRequiredSelections = groups
    .filter((g) => g.required)
    .every((g) => selectedOptions.some((o) => o.group === g.name && !o.excluded));

  const handleAdd = () => {
    // For ingredients groups: only pass excluded items (what was removed)
    // For other groups: pass selected items as before
    const finalOptions = selectedOptions.filter((o) => {
      if (o.excluded) return true; // excluded ingredient → keep as "ohne X"
      // Non-excluded ingredient → skip (don't list what's included)
      const group = groups.find((g) => g.name === o.group);
      if (group?.type === 'ingredients') return false;
      return true; // single/multiple selections → keep
    });
    onAdd(finalOptions);
    setSelectedOptions([]);
  };

  const handleClose = () => {
    setSelectedOptions([]);
    onClose();
  };

  const getGroupHint = (type: ProductOptionGroup['type']) => {
    switch (type) {
      case 'single':
        return t('productOptions.singleHint');
      case 'multiple':
        return t('productOptions.multipleHint');
      case 'ingredients':
        return t('productOptions.ingredientsHint');
    }
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModalOverlay>
        <Modal className="max-w-md">
          <Dialog className="w-full">
            <div className="w-full rounded-xl bg-primary shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary">{product.name}</h2>
                  <p className="text-sm text-tertiary">{formatPrice(product.price)}</p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-2 text-fg-quaternary transition hover:bg-secondary hover:text-fg-quaternary_hover"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Options */}
              <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
                {groups.map((group) => (
                  <div key={group.name} className="mb-6 last:mb-0">
                    <div className="mb-3">
                      <h3 className="text-sm font-medium text-primary">
                        {group.name}
                        {group.required && (
                          <span className="ml-1 text-error-primary">*</span>
                        )}
                      </h3>
                      <p className="text-xs text-tertiary">
                        {getGroupHint(group.type)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {group.options.map((option) => {
                        const selected = isOptionSelected(group.name, option.name);
                        const excluded = isOptionExcluded(group.name, option.name);

                        if (group.type === 'ingredients') {
                          return (
                            <button
                              key={option.name}
                              type="button"
                              onClick={() =>
                                handleOptionToggle(group, option.name, option.priceModifier)
                              }
                              className={cx(
                                'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors',
                                excluded
                                  ? 'border-error-secondary bg-error-secondary opacity-60 dark:text-white'
                                  : 'border-success-secondary bg-success-secondary dark:text-white',
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={cx(
                                    'flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
                                    excluded
                                      ? 'border-error-solid bg-error-solid'
                                      : 'border-success-solid bg-success-solid',
                                  )}
                                >
                                  {excluded ? (
                                    <X className="h-3 w-3 text-white" />
                                  ) : (
                                    <Check className="h-3 w-3 text-white" />
                                  )}
                                </div>
                                <span
                                  className={cx(
                                    'text-sm font-medium',
                                    excluded
                                      ? 'text-tertiary line-through'
                                      : 'text-primary',
                                  )}
                                >
                                  {option.name}
                                </span>
                              </div>
                              {option.priceModifier > 0 && !excluded && (
                                <span className="text-sm text-tertiary">
                                  +{formatPrice(option.priceModifier)}
                                </span>
                              )}
                            </button>
                          );
                        }

                        return (
                          <button
                            key={option.name}
                            type="button"
                            onClick={() =>
                              handleOptionToggle(group, option.name, option.priceModifier)
                            }
                            className={cx(
                              'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors',
                              selected
                                ? 'border-brand-solid bg-brand-secondary'
                                : 'border-secondary hover:bg-secondary',
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cx(
                                  'flex h-5 w-5 items-center justify-center border-2 transition-colors',
                                  group.type === 'multiple' ? 'rounded' : 'rounded-full',
                                  selected
                                    ? 'border-brand-solid bg-brand-solid'
                                    : 'border-tertiary',
                                )}
                              >
                                {selected && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </div>
                              <span className="text-sm font-medium text-primary">
                                {option.name}
                              </span>
                            </div>
                            {option.priceModifier > 0 && (
                              <span className="text-sm text-tertiary">
                                +{formatPrice(option.priceModifier)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-secondary px-6 py-4">
                <div>
                  <p className="text-sm text-tertiary">{t('productOptions.total')}</p>
                  <p className="text-xl font-bold text-primary">{formatPrice(totalPrice)}</p>
                </div>
                <Button
                  onClick={handleAdd}
                  isDisabled={!hasRequiredSelections}
                  size="lg"
                >
                  {t('productOptions.add')}
                </Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
