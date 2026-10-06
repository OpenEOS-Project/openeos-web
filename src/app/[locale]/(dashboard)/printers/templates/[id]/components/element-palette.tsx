'use client';

import { useDraggable } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import {
  ArrowDown,
  Banknote,
  Barcode,
  Building,
  Calculator,
  Calendar,
  Clock,
  Coins,
  CreditCard,
  Euro,
  FileText,
  Hash,
  LayoutGrid,
  List,
  MapPin,
  Minus,
  Phone,
  QrCode,
  ReceiptText,
  Scissors,
  TriangleAlert,
  Type,
  UnfoldVertical,
  User,
} from 'lucide-react';
import { cx } from '@/utils/cx';
import { PALETTE_ITEMS, PALETTE_CATEGORIES } from '../utils/palette-items';
import type { PaletteItem } from '@/types/print-template';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'minus': Minus,
  'type01': Type,
  'spacing-height': UnfoldVertical,
  'arrow-down': ArrowDown,
  'scissors-cut': Scissors,
  'building': Building,
  'marker-pin': MapPin,
  'phone': Phone,
  'calendar': Calendar,
  'hash': Hash,
  'layout-grid': LayoutGrid,
  'user': User,
  'clock': Clock,
  'alert-triangle': TriangleAlert,
  'file-text': FileText,
  'list': List,
  'calculator': Calculator,
  'receipt': ReceiptText,
  'currency-euro': Euro,
  'credit-card': CreditCard,
  'bank-note': Banknote,
  'coins': Coins,
  'qr-code': QrCode,
  'barcode': Barcode,
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
