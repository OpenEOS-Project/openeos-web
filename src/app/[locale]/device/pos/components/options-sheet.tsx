'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Chip, Chips, Field, Icon, Stepper } from '@openeos/ui';
import { useFormatPrice } from '@/hooks/use-format-price';
import type { CartItem } from '@/stores/cart-store';
import type { SelectedOption } from '@/types/order';
import type { ProductOptionGroup } from '@/types/product';
import { PosSheet } from './pos-sheet';
import { sheetIconOf, type PosProduct } from './product-visual';

export interface OptionsResult {
  selectedOptions: SelectedOption[];
  kitchenNotes: string;
  quantity: number;
  refillCount: number;
}

interface OptionsSheetProps {
  /** Neues Produkt (Hinzufügen) oder bestehende Zeile (Bearbeiten). */
  target: { product: PosProduct; item?: CartItem } | null;
  chargePfand: boolean;
  onClose: () => void;
  onConfirm: (product: PosProduct, result: OptionsResult, item?: CartItem) => void;
}

/** Vorauswahl: Zutaten alle enthalten, sonst die als Standard markierten Optionen. */
function defaultSelections(groups: ProductOptionGroup[]): SelectedOption[] {
  const out: SelectedOption[] = [];
  for (const group of groups) {
    for (const option of group.options) {
      const include =
        group.type === 'ingredients' ||
        (option.default && (group.type === 'multiple' || !out.some((o) => o.group === group.name)));
      if (include) {
        out.push({ group: group.name, option: option.name, priceModifier: option.priceModifier });
      }
    }
  }
  return out;
}

/** Auswahl einer gespeicherten Zeile wiederherstellen (Bearbeiten). */
function selectionsFromItem(groups: ProductOptionGroup[], stored: SelectedOption[]): SelectedOption[] {
  const out: SelectedOption[] = [];
  for (const group of groups) {
    if (group.type === 'ingredients') {
      for (const option of group.options) {
        const excluded = stored.some(
          (s) => s.group === group.name && s.option === option.name && s.excluded,
        );
        out.push({
          group: group.name,
          option: option.name,
          priceModifier: option.priceModifier,
          ...(excluded ? { excluded: true } : {}),
        });
      }
    } else {
      out.push(...stored.filter((s) => s.group === group.name && !s.excluded));
    }
  }
  return out;
}

/**
 * Optionen-Blatt: Gruppen als Chips, Notiz für die Küche, Nachfüllen
 * (Pfand) und Menge. Dasselbe Blatt bearbeitet eine ungesendete
 * Warenkorbzeile („Übernehmen“).
 */
export function OptionsSheet({ target, chargePfand, onClose, onConfirm }: OptionsSheetProps) {
  const t = useTranslations('pos.order');
  const formatPrice = useFormatPrice();
  const product = target?.product ?? null;
  const item = target?.item;
  const groups = useMemo(() => product?.options?.groups ?? [], [product]);

  const [selected, setSelected] = useState<SelectedOption[]>([]);
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [refill, setRefill] = useState(0);

  useEffect(() => {
    if (!target) return;
    setSelected(
      target.item
        ? selectionsFromItem(groups, target.item.selectedOptions)
        : defaultSelections(groups),
    );
    setNote(target.item?.kitchenNotes ?? '');
    setQuantity(target.item?.quantity ?? 1);
    setRefill(target.item?.refillCount ?? 0);
  }, [target, groups]);

  if (!product) return null;

  const isOn = (group: string, option: string) =>
    selected.some((s) => s.group === group && s.option === option && !s.excluded);

  const toggle = (group: ProductOptionGroup, option: { name: string; priceModifier: number }) => {
    setSelected((prev) => {
      if (group.type === 'ingredients') {
        return prev.map((s) =>
          s.group === group.name && s.option === option.name ? { ...s, excluded: !s.excluded } : s,
        );
      }
      const exists = prev.some((s) => s.group === group.name && s.option === option.name);
      if (exists) {
        // Einfachauswahl in Pflichtgruppen lässt sich nicht leeren, nur wechseln.
        if (group.type === 'single' && group.required) return prev;
        return prev.filter((s) => !(s.group === group.name && s.option === option.name));
      }
      const entry = { group: group.name, option: option.name, priceModifier: option.priceModifier };
      return group.type === 'multiple'
        ? [...prev, entry]
        : [...prev.filter((s) => s.group !== group.name), entry];
    });
  };

  const optionsPrice = selected
    .filter((s) => !s.excluded)
    .reduce((sum, s) => sum + Number(s.priceModifier || 0), 0);
  const unitPrice = Number(product.price) + optionsPrice;
  const missingRequired = groups.some(
    (g) => g.required && !selected.some((s) => s.group === g.name && !s.excluded),
  );
  const showRefill = chargePfand && !!product.pfandType;

  const confirm = () => {
    // Zutaten werden nur als „ohne X“ gespeichert, wie bisher.
    const finalOptions = selected.filter((s) => {
      const group = groups.find((g) => g.name === s.group);
      return group?.type === 'ingredients' ? !!s.excluded : true;
    });
    onConfirm(
      product,
      {
        selectedOptions: finalOptions,
        kitchenNotes: note.trim(),
        quantity,
        refillCount: Math.min(refill, quantity),
      },
      item,
    );
  };

  const sub = product.description?.split(/\r?\n/)[0]?.trim();
  const groupHint = (group: ProductOptionGroup) => {
    const parts = [group.name];
    if (group.type === 'multiple') parts.push(t('optionsMultiple'));
    if (group.type === 'ingredients') parts.push(t('optionsIngredients'));
    if (group.required) parts.push(t('optionsRequired'));
    return parts.join(' · ');
  };

  return (
    <PosSheet
      open={!!target}
      onClose={onClose}
      icon={sheetIconOf(product)}
      title={product.name}
      subtitle={[sub, formatPrice(product.price)].filter(Boolean).join(' · ')}
      footer={
        <>
          <Stepper
            size="lg"
            value={quantity}
            min={1}
            onDecrement={() => setQuantity((q) => Math.max(1, q - 1))}
            onIncrement={() => setQuantity((q) => q + 1)}
            labels={{ decrease: t('qtyDecrease'), increase: t('qtyIncrease') }}
          />
          <Button
            variant="primary"
            size="lg"
            className="oe-grow"
            disabled={missingRequired}
            onClick={confirm}
          >
            <Icon name={item ? 'check' : 'cart-plus'} />
            {item
              ? t('optionsApply', { price: formatPrice(unitPrice * quantity) })
              : t('optionsAdd', { price: formatPrice(unitPrice * quantity) })}
          </Button>
        </>
      }
    >
      {groups.map((group) => (
        <div key={group.name} className="pos-group">
          <span className="oe-label">{groupHint(group)}</span>
          <Chips>
            {group.options.map((option) => {
              const on = isOn(group.name, option.name);
              const off = group.type === 'ingredients' && !on;
              return (
                <Chip
                  key={option.name}
                  active={on}
                  className="pos-chip"
                  onClick={() => toggle(group, option)}
                >
                  {on && <Icon name="check" />}
                  {off ? <s>{t('optionsWithout', { option: option.name })}</s> : option.name}
                  {option.priceModifier > 0 && !off && (
                    <span className="pos-chip__price">+{formatPrice(option.priceModifier)}</span>
                  )}
                </Chip>
              );
            })}
          </Chips>
        </div>
      ))}

      {missingRequired && <p className="pos-hint pos-hint--warn">{t('optionsRequiredHint')}</p>}

      {showRefill && (
        <div className="pos-group">
          <span className="oe-label">{t('optionsRefill')}</span>
          <div className="pos-refill">
            <Stepper
              value={Math.min(refill, quantity)}
              max={quantity}
              onDecrement={() => setRefill((r) => Math.max(0, r - 1))}
              onIncrement={() => setRefill((r) => Math.min(quantity, r + 1))}
              labels={{ decrease: t('qtyDecrease'), increase: t('qtyIncrease') }}
            />
            <span>
              {t('optionsRefillHint', {
                name: product.pfandType?.name ?? '',
                count: Math.min(refill, quantity),
                total: quantity,
              })}
            </span>
          </div>
        </div>
      )}

      <Field label={t('optionsNote')} htmlFor="pos-options-note">
        <input
          id="pos-options-note"
          className="oe-input"
          value={note}
          maxLength={200}
          placeholder={t('optionsNotePlaceholder')}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
    </PosSheet>
  );
}
