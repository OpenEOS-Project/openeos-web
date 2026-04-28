'use client';

import { useTranslations } from 'next-intl';
import {
  Trash01,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from '@untitledui/icons';
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

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function AlignmentControl({ value, onChange, label, showJustify, justifyLabel }: {
  value: TextAlign;
  onChange: (align: TextAlign) => void;
  label: string;
  showJustify?: boolean;
  justifyLabel?: string;
}) {
  return (
    <div>
      <label className="text-xs text-secondary block mb-1.5">{label}</label>
      <div className="flex gap-1">
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

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
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

  const update = (updates: Partial<TemplateElement>) => onUpdate(element.id, updates);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-secondary px-4 py-3">
        <h3 className="text-sm font-semibold text-primary">{t('properties')}</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <span className="inline-flex rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary">
            {element.type === 'field' && element.field
              ? t(`fields.${element.field}`)
              : t(`elements.${element.type}`)}
          </span>
        </div>

        {element.type === 'text' && (
          <div>
            <label htmlFor="content" className="text-xs text-secondary block mb-1.5">{tp('content')}</label>
            <input
              id="content"
              className="input"
              value={element.content || ''}
              onChange={(e) => update({ content: e.target.value })}
              placeholder={tp('contentPlaceholder')}
            />
          </div>
        )}

        {element.type === 'field' && element.field !== 'items_list' && element.field !== 'qr_code' && element.field !== 'priority' && (
          <div>
            <label htmlFor="label" className="text-xs text-secondary block mb-1.5">{tp('label')}</label>
            <input
              id="label"
              className="input"
              value={element.label || ''}
              onChange={(e) => update({ label: e.target.value })}
              placeholder={tp('labelPlaceholder')}
            />
          </div>
        )}

        {(element.type === 'text' || element.type === 'field') && element.field !== 'items_list' && (
          <AlignmentControl
            value={element.align || (element.field && AMOUNT_FIELDS.has(element.field) ? 'justify' : 'left')}
            onChange={(align) => update({ align })}
            label={tp('align')}
            showJustify={!!element.field && AMOUNT_FIELDS.has(element.field)}
            justifyLabel={tp('alignJustifyHint')}
          />
        )}

        {(element.type === 'text' || element.type === 'field') && (
          <div className="flex gap-3">
            <CheckboxField label={tp('bold')} checked={element.bold || false} onChange={(bold) => update({ bold })} />
            <CheckboxField label={tp('big')} checked={element.big || false} onChange={(big) => update({ big })} />
          </div>
        )}

        {element.type === 'separator' && (
          <div>
            <label className="text-xs text-secondary block mb-1.5">{tp('char')}</label>
            <div className="flex gap-2">
              <ToggleButton active={element.char !== '-'} onClick={() => update({ char: '=' })}>
                =
              </ToggleButton>
              <ToggleButton active={element.char === '-'} onClick={() => update({ char: '-' })}>
                -
              </ToggleButton>
            </div>
          </div>
        )}

        {(element.type === 'spacer' || element.type === 'feed') && (
          <div>
            <label htmlFor="lines" className="text-xs text-secondary block mb-1.5">{tp('lines')}</label>
            <input
              id="lines"
              className="input"
              value={String(element.lines || 1)}
              onChange={(e) => {
                const num = parseInt(e.target.value) || 1;
                update({ lines: Math.max(1, Math.min(10, num)) });
              }}
            />
          </div>
        )}

        {element.type === 'field' && (
          <div>
            <label className="text-xs text-secondary block mb-1.5">{tp('condition')}</label>
            <select
              className="select"
              value={element.condition || ''}
              onChange={(e) => update({ condition: (e.target.value as string) || undefined })}
            >
              {CONDITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{tp(opt.labelKey)}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-quaternary">{tp('conditionHint')}</p>
          </div>
        )}

        {element.type === 'field' && element.field === 'items_list' && (
          <div className="space-y-2">
            <CheckboxField label={tp('showPrice')} checked={element.showPrice !== false} onChange={(showPrice) => update({ showPrice })} />
            <CheckboxField label={tp('showNotes')} checked={element.showNotes !== false} onChange={(showNotes) => update({ showNotes })} />
            <CheckboxField label={tp('showKitchenNotes')} checked={element.showKitchenNotes || false} onChange={(showKitchenNotes) => update({ showKitchenNotes })} />
            <CheckboxField label={tp('showOptions')} checked={element.showOptions !== false} onChange={(showOptions) => update({ showOptions })} />
          </div>
        )}

        <div className="pt-4 border-t border-secondary">
          <button
            type="button"
            className="btn btn--ghost"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#d24545' }}
            onClick={() => onRemove(element.id)}
          >
            <Trash01 className="h-4 w-4" />
            {t('deleteElement')}
          </button>
        </div>
      </div>
    </div>
  );
}
