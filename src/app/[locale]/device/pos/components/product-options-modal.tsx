'use client';

import { useState } from 'react';
import { X, Check } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { cx } from '@/utils/cx';
import type { Product, ProductOptionGroup } from '@/types/product';

interface SelectedOption {
  group: string;
  option: string;
  priceModifier: number;
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

export function ProductOptionsModal({
  isOpen,
  product,
  onClose,
  onAdd,
}: ProductOptionsModalProps) {
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);

  const groups = product.options?.groups || [];

  const handleOptionToggle = (group: ProductOptionGroup, optionName: string, priceModifier: number) => {
    const isMultiple = group.type === 'multiple';

    setSelectedOptions((prev) => {
      const existingIndex = prev.findIndex(
        (o) => o.group === group.name && o.option === optionName
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
    return selectedOptions.some((o) => o.group === groupName && o.option === optionName);
  };

  const totalOptionsPrice = selectedOptions.reduce((sum, o) => sum + o.priceModifier, 0);
  const totalPrice = product.price + totalOptionsPrice;

  // Check if all required groups have selections
  const hasRequiredSelections = groups
    .filter((g) => g.required)
    .every((g) => selectedOptions.some((o) => o.group === g.name));

  const handleAdd = () => {
    onAdd(selectedOptions);
    setSelectedOptions([]);
  };

  const handleClose = () => {
    setSelectedOptions([]);
    onClose();
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
                        {group.type === 'multiple'
                          ? 'Mehrere auswählbar'
                          : 'Eine Option wählen'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {group.options.map((option) => (
                        <button
                          key={option.name}
                          type="button"
                          onClick={() =>
                            handleOptionToggle(group, option.name, option.priceModifier)
                          }
                          className={cx(
                            'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors',
                            isOptionSelected(group.name, option.name)
                              ? 'border-brand-primary bg-brand-secondary'
                              : 'border-secondary hover:bg-secondary'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cx(
                                'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
                                isOptionSelected(group.name, option.name)
                                  ? 'border-brand-primary bg-brand-primary'
                                  : 'border-tertiary'
                              )}
                            >
                              {isOptionSelected(group.name, option.name) && (
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
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-secondary px-6 py-4">
                <div>
                  <p className="text-sm text-tertiary">Gesamt</p>
                  <p className="text-xl font-bold text-primary">{formatPrice(totalPrice)}</p>
                </div>
                <Button
                  onClick={handleAdd}
                  isDisabled={!hasRequiredSelections}
                  size="lg"
                >
                  Hinzufügen
                </Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
