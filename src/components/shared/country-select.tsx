'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { countryOptions } from '@/lib/countries';

interface CountrySelectProps {
  value: string;
  onChange: (code: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  /** Fehlerzustand (rote Umrandung über die Klasse des Feldes). */
  invalid?: boolean;
  autoFocus?: boolean;
}

/**
 * Länderauswahl (ISO 3166-1 alpha-2): Deutschland, Österreich, Schweiz
 * oben, darunter alle übrigen Länder alphabetisch in der Sprache der
 * Oberfläche. Native `<select>`, damit Tastatur, Mobilgeräte und
 * Screenreader ohne Zusatzaufwand funktionieren.
 */
export function CountrySelect({ value, onChange, id, className, disabled, invalid, autoFocus }: CountrySelectProps) {
  const t = useTranslations('countrySelect');
  const locale = useLocale();
  const { top, rest } = useMemo(() => countryOptions(locale), [locale]);

  return (
    <select
      id={id}
      className={className ?? 'select'}
      value={value}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      data-testid="country-select"
    >
      <option value="" disabled>
        {t('placeholder')}
      </option>
      <optgroup label={t('frequent')}>
        {top.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </optgroup>
      <optgroup label={t('all')}>
        {rest.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
