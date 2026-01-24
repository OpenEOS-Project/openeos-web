'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Minus, Plus, X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { useUpdateProductStock } from '@/hooks/use-products';
import type { Product } from '@/types/product';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  eventId: string;
  product: Product | null;
  onClose: () => void;
}

export function StockAdjustmentModal({
  isOpen,
  eventId,
  product,
  onClose,
}: StockAdjustmentModalProps) {
  const t = useTranslations('products');
  const tCommon = useTranslations('common');

  const [adjustmentValue, setAdjustmentValue] = useState<string>('');
  const [reason, setReason] = useState('');

  const updateStock = useUpdateProductStock();

  const handleClose = () => {
    setAdjustmentValue('');
    setReason('');
    onClose();
  };

  const handleAdjust = async (type: 'add' | 'subtract') => {
    if (!product || !eventId) return;

    const quantity = parseInt(adjustmentValue, 10);
    if (isNaN(quantity) || quantity <= 0) return;

    const adjustedQuantity = type === 'add' ? quantity : -quantity;

    try {
      await updateStock.mutateAsync({
        eventId,
        id: product.id,
        quantity: adjustedQuantity,
        reason: reason || undefined,
      });
      handleClose();
    } catch {
      // Error is handled by the mutation
    }
  };

  if (!product) return null;

  const adjustmentNum = parseInt(adjustmentValue, 10) || 0;
  const newStockAfterAdd = product.stockQuantity + adjustmentNum;
  const newStockAfterSubtract = product.stockQuantity - adjustmentNum;

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModalOverlay>
        <Modal className="max-w-md">
          <Dialog className="w-full">
            <div className="w-full rounded-xl bg-primary shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
                <h2 className="text-lg font-semibold text-primary">
                  {t('stock.title')}
                </h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-2 text-fg-quaternary transition hover:bg-secondary hover:text-fg-quaternary_hover"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-5 px-6 py-5">
                {/* Product Info */}
                <div className="rounded-lg bg-secondary p-4">
                  <p className="text-sm font-medium text-primary">{product.name}</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-primary">
                      {product.stockQuantity}
                    </span>
                    <span className="text-sm text-tertiary">{product.stockUnit}</span>
                  </div>
                  <p className="mt-1 text-xs text-tertiary">{t('stock.currentStock')}</p>
                </div>

                {/* Adjustment Input */}
                <div>
                  <Input
                    label={t('stock.adjustmentAmount')}
                    type="number"
                    placeholder="0"
                    value={adjustmentValue}
                    onChange={(value) => setAdjustmentValue(value)}
                  />
                </div>

                {/* Reason Input */}
                <div>
                  <Input
                    label={t('stock.reason')}
                    placeholder={t('stock.reasonPlaceholder')}
                    value={reason}
                    onChange={(value) => setReason(value)}
                  />
                </div>

                {/* Preview */}
                {adjustmentNum > 0 && (
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-secondary p-3">
                    <div className="text-center">
                      <p className="text-xs text-tertiary">{t('stock.afterAdd')}</p>
                      <p className="text-lg font-semibold text-success-primary">
                        {newStockAfterAdd} {product.stockUnit}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-tertiary">{t('stock.afterSubtract')}</p>
                      <p className={`text-lg font-semibold ${newStockAfterSubtract < 0 ? 'text-error-primary' : 'text-warning-primary'}`}>
                        {newStockAfterSubtract} {product.stockUnit}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-between gap-3 border-t border-secondary px-6 py-4">
                <Button
                  type="button"
                  color="secondary"
                  onClick={handleClose}
                  isDisabled={updateStock.isPending}
                >
                  {tCommon('cancel')}
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    color="primary-destructive"
                    iconLeading={Minus}
                    onClick={() => handleAdjust('subtract')}
                    isLoading={updateStock.isPending}
                    isDisabled={updateStock.isPending || adjustmentNum <= 0 || newStockAfterSubtract < 0}
                  >
                    {t('stock.subtract')}
                  </Button>
                  <Button
                    type="button"
                    iconLeading={Plus}
                    onClick={() => handleAdjust('add')}
                    isLoading={updateStock.isPending}
                    isDisabled={updateStock.isPending || adjustmentNum <= 0}
                  >
                    {t('stock.add')}
                  </Button>
                </div>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
