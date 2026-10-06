'use client';

import { useTranslations } from 'next-intl';
import { Keypad } from '@openeos/ui';

/** Höchstlänge einer frei eingegebenen Tischnummer (wie bisher). */
export const TABLE_INPUT_MAX = 5;

/**
 * Bereinigt eine Eingabe für die freie Tischnummer: Großbuchstaben,
 * Ziffern und Bindestrich, höchstens fünf Zeichen. Führende Nullen
 * bleiben stehen („05“ ist ein anderer Tisch als „5“, wenn der Verein
 * das so beschriftet).
 */
export function normalizeTableInput(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^0-9A-Z-]/g, '')
    .slice(0, TABLE_INPUT_MAX);
}

interface TableKeypadProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  /** Physische Tastatur abfangen (nur auf der Startansicht). */
  captureKeyboard?: boolean;
}

/**
 * Anzeige „Tischnummer“ und Ziffernblock der Startansicht. Tippen und
 * Tastatur (Ziffern, Buchstaben, Rücktaste, Enter) gehen beide.
 */
export function TableKeypad({ value, onChange, onSubmit, captureKeyboard }: TableKeypadProps) {
  const t = useTranslations('pos.order');

  const handleKey = (key: string) => {
    if (key === 'backspace') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === 'enter') {
      if (value) onSubmit();
      return;
    }
    onChange(normalizeTableInput(value + key));
  };

  return (
    <>
      <div className={value ? 'pos-tablenum' : 'pos-tablenum is-empty'} aria-live="polite">
        <span className="oe-label">{t('tableNumber')}</span>
        <b>{value}</b>
      </div>
      <Keypad
        size="lg"
        onKey={handleKey}
        disabledKeys={value ? [] : ['enter', 'backspace']}
        labels={{ backspace: t('keypadBackspace'), enter: t('keypadEnter') }}
        captureKeyboard={captureKeyboard}
        aria-label={t('keypadLabel')}
      />
    </>
  );
}
