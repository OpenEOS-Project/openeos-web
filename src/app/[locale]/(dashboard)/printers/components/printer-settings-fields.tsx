'use client';

import { useTranslations } from 'next-intl';

import { SettingToggle } from '@/components/shared/setting-toggle';
import type { PrinterPaperWidth, PrinterType } from '@/types/printer';

export interface PrinterSettings {
  type: PrinterType;
  paperWidth: PrinterPaperWidth;
  hasCashDrawer: boolean;
}

interface PrinterSettingsFieldsProps {
  value: PrinterSettings;
  onChange: (next: PrinterSettings) => void;
}

export function FormRow({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <label className="auth-field" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/**
 * Type, paper width and cash drawer — the three things the user decides for
 * every printer, whether adopted from discovery or created by hand.
 */
export function PrinterSettingsFields({ value, onChange }: PrinterSettingsFieldsProps) {
  const t = useTranslations('printers');

  return (
    <>
      <div className="field-row">
        <FormRow label={t('form.type')}>
          <select
            className="select"
            value={value.type}
            onChange={(e) => onChange({ ...value, type: e.target.value as PrinterType })}
          >
            <option value="receipt">{t('types.receipt')}</option>
            <option value="kitchen">{t('types.kitchen')}</option>
            <option value="label">{t('types.label')}</option>
          </select>
        </FormRow>

        <FormRow label={t('form.paperWidth')}>
          <select
            className="select"
            value={String(value.paperWidth)}
            onChange={(e) => onChange({ ...value, paperWidth: Number(e.target.value) as PrinterPaperWidth })}
          >
            <option value="58">58 mm</option>
            <option value="80">80 mm</option>
          </select>
        </FormRow>
      </div>

      <SettingToggle
        label={t('form.hasCashDrawer')}
        hint={t('form.hasCashDrawerHint')}
        checked={value.hasCashDrawer}
        onChange={(checked) => onChange({ ...value, hasCashDrawer: checked })}
      />
    </>
  );
}
