'use client';

import { useDraggable } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import {
  Minus,
  Type01,
  SpacingHeight01,
  ArrowDown,
  ScissorsCut01,
  Building07,
  MarkerPin01,
  Phone,
  Calendar,
  Hash02,
  LayoutGrid01,
  User01,
  Clock,
  AlertTriangle,
  File06,
  List,
  Calculator,
  Receipt,
  CurrencyEuro,
  CreditCard01,
  BankNote01,
  CoinsStacked01,
  QrCode02,
} from '@untitledui/icons';
import { cx } from '@/utils/cx';
import { PALETTE_ITEMS, PALETTE_CATEGORIES } from '../utils/palette-items';
import type { PaletteItem } from '@/types/print-template';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'minus': Minus,
  'type01': Type01,
  'spacing-height': SpacingHeight01,
  'arrow-down': ArrowDown,
  'scissors-cut': ScissorsCut01,
  'building': Building07,
  'marker-pin': MarkerPin01,
  'phone': Phone,
  'calendar': Calendar,
  'hash': Hash02,
  'layout-grid': LayoutGrid01,
  'user': User01,
  'clock': Clock,
  'alert-triangle': AlertTriangle,
  'file-text': File06,
  'list': List,
  'calculator': Calculator,
  'receipt': Receipt,
  'currency-euro': CurrencyEuro,
  'credit-card': CreditCard01,
  'bank-note': BankNote01,
  'coins': CoinsStacked01,
  'qr-code': QrCode02,
};

function DraggablePaletteItem({ item, label }: { item: PaletteItem; label: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}-${item.field || ''}`,
    data: { type: 'palette-item', item },
  });

  const Icon = ICON_MAP[item.icon];

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cx(
        'flex cursor-grab items-center gap-2 rounded-lg border border-secondary px-3 py-2 text-sm transition-colors',
        'hover:border-brand-primary hover:bg-brand-secondary active:cursor-grabbing',
        isDragging && 'opacity-50',
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0 text-tertiary" />}
      <span className="truncate text-primary">{label}</span>
    </div>
  );
}

export function ElementPalette() {
  const t = useTranslations('printTemplates.designer');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-secondary px-4 py-3">
        <h3 className="text-sm font-semibold text-primary">{t('palette')}</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {PALETTE_CATEGORIES.map(({ key, labelKey }) => {
          const items = PALETTE_ITEMS.filter((item) => item.category === key);
          if (items.length === 0) return null;

          return (
            <div key={key}>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-quaternary">
                {t(labelKey)}
              </h4>
              <div className="space-y-1.5">
                {items.map((item) => (
                  <DraggablePaletteItem
                    key={`${item.type}-${item.field || ''}`}
                    item={item}
                    label={t(item.labelKey)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
