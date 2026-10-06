'use client';

import { useTranslations } from 'next-intl';
import { CartLine, Stepper } from '@openeos/ui';
import { useFormatPrice } from '@/hooks/use-format-price';
import type { CartItem } from '@/stores/cart-store';

interface PosCartLineProps {
  item: CartItem;
  chargePfand: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onEdit: () => void;
}

/** Eine ungesendete Warenkorbzeile: Stepper, Name, Optionen/Notiz, Summe. */
export function PosCartLine({ item, chargePfand, onIncrement, onDecrement, onEdit }: PosCartLineProps) {
  const t = useTranslations('pos.cartV2');
  const formatPrice = useFormatPrice();

  const options = item.selectedOptions.map((o) =>
    o.excluded ? t('without', { option: o.option }) : o.option,
  );
  const notes = [item.notes, item.kitchenNotes].filter(Boolean).map((n) => t('note', { note: n }));
  const refill =
    chargePfand && item.pfandType && item.refillCount > 0
      ? [t('refillMeta', { count: item.refillCount, total: item.quantity })]
      : [];
  const meta = [...options, ...refill, ...notes].join(' · ');
  const sub = item.product.description?.split(/\r?\n/)[0]?.trim();

  return (
    <CartLine
      name={item.product.name}
      sub={sub || undefined}
      meta={meta || undefined}
      total={formatPrice(item.unitPrice * item.quantity)}
      onClick={onEdit}
      stepper={
        <Stepper
          value={item.quantity}
          min={0}
          removeAtMin
          onIncrement={onIncrement}
          onDecrement={onDecrement}
          labels={{ decrease: t('qtyDecrease'), increase: t('qtyIncrease'), remove: t('qtyRemove') }}
        />
      }
    />
  );
}
