'use client';

import { useTranslations } from 'next-intl';
import { Trash01, AlignLeft, AlignCenter, AlignRight, AlignJustify } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Label } from '@/components/ui/input/label';
import { Select } from '@/components/ui/select/select';
import { cx } from '@/utils/cx';
import type { TemplateElement, TextAlign } from '@/types/print-template';

const CONDITION_OPTIONS = [
  { value: '', labelKey: 'conditionAlways' },
  { value: 'table_number', labelKey: 'conditionTableNumber' },
  { value: 'customer_name', labelKey: 'conditionCustomerName' },
  { value: 'event_name', labelKey: 'conditionEventName' },
  { value: 'organization.address', labelKey: 'conditionAddress' },
  { value: 'organization.phone', labelKey: 'conditionPhone' },
  { value: 'payment_method', labelKey: 'conditionPaymentMethod' },
  { value: 'paid_amount', labelKey: 'conditionPaidAmount' },
  { value: 'subtotal', labelKey: 'conditionSubtotal' },
  { value: 'tax_amount', labelKey: 'conditionTax' },
  { value: 'qr_url', labelKey: 'conditionQrCode' },
  { value: 'notes', labelKey: 'conditionNotes' },
] as const;

const AMOUNT_FIELDS = new Set(['subtotal', 'tax', 'total', 'paid_amount', 'change']);

interface PropertyPanelProps {
  element: TemplateElement | null;
  onUpdate: (id: string, updates: Partial<TemplateElement>) => void;
  onRemove: (id: string) => void;
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors',
        active
          ? 'border-brand-solid bg-brand-secondary text-brand-primary'
          : 'border-secondary bg-primary text-tertiary hover:bg-secondary',
      )}
    >
      {children}
    </button>
  );
}

function AlignmentControl({
  value,
  onChange,
  label,
  showJustify,
  justifyLabel,
}: {
  value: TextAlign;
  onChange: (align: TextAlign) => void;
  label: string;
  showJustify?: boolean;
  justifyLabel?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1.5 flex gap-1">
        {showJustify && (
          <ToggleButton active={value === 'justify'} onClick={() => onChange('justify')}>
            <AlignJustify className="h-4 w-4" />
          </ToggleButton>
        )}
        <ToggleButton active={value === 'left'} onClick={() => onChange('left')}>
          <AlignLeft className="h-4 w-4" />
        </ToggleButton>
        <ToggleButton active={value === 'center'} onClick={() => onChange('center')}>
          <AlignCenter className="h-4 w-4" />
        </ToggleButton>
        <ToggleButton active={value === 'right'} onClick={() => onChange('right')}>
          <AlignRight className="h-4 w-4" />
        </ToggleButton>
      </div>
      {showJustify && value === 'justify' && justifyLabel && (
        <p className="mt-1 text-xs text-quaternary">{justifyLabel}</p>
      )}
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-secondary text-brand-solid focus:ring-brand-primary"
      />
      <span className="text-sm text-primary">{label}</span>
    </label>
  );
}

export function PropertyPanel({ element, onUpdate, onRemove }: PropertyPanelProps) {
  const t = useTranslations('printTemplates.designer');
  const tp = useTranslations('printTemplates.designer.props');

  if (!element) return null;

  const update = (updates: Partial<TemplateElement>) => {
    onUpdate(element.id, updates);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-secondary px-4 py-3">
        <h3 className="text-sm font-semibold text-primary">{t('properties')}</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Element type label */}
        <div>
          <span className="inline-flex rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary">
            {element.type === 'field' && element.field
              ? t(`fields.${element.field}`)
              : t(`elements.${element.type}`)}
          </span>
        </div>

        {/* Text content (for text type) */}
        {element.type === 'text' && (
          <div>
            <Label htmlFor="content" className="text-xs">{tp('content')}</Label>
            <Input
              id="content"
              value={element.content || ''}
              onChange={(value) => update({ content: value })}
              placeholder={tp('contentPlaceholder')}
              size="sm"
            />
          </div>
        )}

        {/* Label (for field type) */}
        {element.type === 'field' && element.field !== 'items_list' && element.field !== 'qr_code' && element.field !== 'priority' && (
          <div>
            <Label htmlFor="label" className="text-xs">{tp('label')}</Label>
            <Input
              id="label"
              value={element.label || ''}
              onChange={(value) => update({ label: value })}
              placeholder={tp('labelPlaceholder')}
              size="sm"
            />
          </div>
        )}

        {/* Alignment */}
        {(element.type === 'text' || element.type === 'field') && element.field !== 'items_list' && (
          <AlignmentControl
            value={element.align || (element.field && AMOUNT_FIELDS.has(element.field) ? 'justify' : 'left')}
            onChange={(align) => update({ align })}
            label={tp('align')}
            showJustify={!!element.field && AMOUNT_FIELDS.has(element.field)}
            justifyLabel={tp('alignJustifyHint')}
          />
        )}

        {/* Bold & Big toggles */}
        {(element.type === 'text' || element.type === 'field') && (
          <div className="flex gap-3">
            <CheckboxField
              label={tp('bold')}
              checked={element.bold || false}
              onChange={(bold) => update({ bold })}
            />
            <CheckboxField
              label={tp('big')}
              checked={element.big || false}
              onChange={(big) => update({ big })}
            />
          </div>
        )}

        {/* Separator character */}
        {element.type === 'separator' && (
          <div>
            <Label className="text-xs">{tp('char')}</Label>
            <div className="mt-1.5 flex gap-2">
              <ToggleButton
                active={element.char !== '-'}
                onClick={() => update({ char: '=' })}
              >
                =
              </ToggleButton>
              <ToggleButton
                active={element.char === '-'}
                onClick={() => update({ char: '-' })}
              >
                -
              </ToggleButton>
            </div>
          </div>
        )}

        {/* Lines count (spacer, feed) */}
        {(element.type === 'spacer' || element.type === 'feed') && (
          <div>
            <Label htmlFor="lines" className="text-xs">{tp('lines')}</Label>
            <Input
              id="lines"
              value={String(element.lines || 1)}
              onChange={(value) => {
                const num = parseInt(value) || 1;
                update({ lines: Math.max(1, Math.min(10, num)) });
              }}
              size="sm"
            />
          </div>
        )}

        {/* Condition */}
        {element.type === 'field' && (
          <div>
            <Label className="text-xs">{tp('condition')}</Label>
            <Select
              selectedKey={element.condition || ''}
              onSelectionChange={(key) =>
                update({ condition: (key as string) || undefined })
              }
              aria-label={tp('condition')}
            >
              {CONDITION_OPTIONS.map((opt) => (
                <Select.Item key={opt.value} id={opt.value}>
                  {tp(opt.labelKey)}
                </Select.Item>
              ))}
            </Select>
            <p className="mt-1 text-xs text-quaternary">{tp('conditionHint')}</p>
          </div>
        )}

        {/* Items list specific options */}
        {element.type === 'field' && element.field === 'items_list' && (
          <div className="space-y-2">
            <CheckboxField
              label={tp('showPrice')}
              checked={element.showPrice !== false}
              onChange={(showPrice) => update({ showPrice })}
            />
            <CheckboxField
              label={tp('showNotes')}
              checked={element.showNotes !== false}
              onChange={(showNotes) => update({ showNotes })}
            />
            <CheckboxField
              label={tp('showKitchenNotes')}
              checked={element.showKitchenNotes || false}
              onChange={(showKitchenNotes) => update({ showKitchenNotes })}
            />
            <CheckboxField
              label={tp('showOptions')}
              checked={element.showOptions !== false}
              onChange={(showOptions) => update({ showOptions })}
            />
          </div>
        )}

        {/* Delete button */}
        <div className="pt-4 border-t border-secondary">
          <Button
            color="tertiary"
            size="sm"
            className="w-full"
            onClick={() => onRemove(element.id)}
            iconLeading={Trash01}
          >
            {t('deleteElement')}
          </Button>
        </div>
      </div>
    </div>
  );
}
