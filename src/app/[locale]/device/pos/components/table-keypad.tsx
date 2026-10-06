'use client';

import { useTranslations } from 'next-intl';
import { Keypad } from '@openeos/ui';

/** Höchstlänge einer frei eingegebenen Tischnummer (wie bisher). */
export const TABLE_INPUT_MAX = 5;
/** Suche in vordefinierten Tischen: so lang wie eine Bezeichnung sein darf. */
export const TABLE_SEARCH_MAX = 20;

/**
 * Bereinigt eine Eingabe für die freie Tischnummer: Großbuchstaben,
 * Ziffern und Bindestrich, höchstens fünf Zeichen. Führende Nullen
 * bleiben stehen („05“ ist ein anderer Tisch als „5“, wenn der Verein
 * das so beschriftet).
 */
export function normalizeTableInput(value: string, max = TABLE_INPUT_MAX): string {
  return value
    .toUpperCase()
    .replace(/[^0-9A-Z-]/g, '')
    .slice(0, max);
}

interface TableKeypadProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  /** Physische Tastatur abfangen (Startansicht, Tisch-wählen-Blatt). */
  captureKeyboard?: boolean;
  /** Höchstlänge der Eingabe (frei 5, Suche in Tischen 20). */
  maxLength?: number;
  /** Eingabe passt zu keinem Tisch: Anzeige rot, Text darunter, Öffnen gesperrt. */
  error?: string | null;
  /** Öffnen-Taste gesperrt (z. B. mehrere Treffer – erst antippen). */
  enterDisabled?: boolean;
}

/**
 * Anzeige „Tischnummer“ und Ziffernblock der Startansicht. Tippen und
 * Tastatur (Ziffern, Buchstaben, Rücktaste, Enter) gehen beide.
 */
export function TableKeypad({
  value,
  onChange,
  onSubmit,
  captureKeyboard,
  maxLength = TABLE_INPUT_MAX,
  error,
  enterDisabled,
}: TableKeypadProps) {
  const t = useTranslations('pos.order');

  const handleKey = (key: string) => {
    if (key === 'backspace') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === 'enter') {
      if (value && !error && !enterDisabled) onSubmit();
      return;
    }
    onChange(normalizeTableInput(value + key, maxLength));
  };

  const className = ['pos-tablenum', !value && 'is-empty', error && 'is-error'].filter(Boolean).join(' ');

  return (
    <>
      <div className={className} aria-live="polite">
        <span className="oe-label">{t('tableNumber')}</span>
        <b>{value}</b>
        {error && <small className="pos-tablenum__err">{error}</small>}
      </div>
      <Keypad
        size="lg"
        onKey={handleKey}
        disabledKeys={!value ? ['enter', 'backspace'] : error || enterDisabled ? ['enter'] : []}
        labels={{ backspace: t('keypadBackspace'), enter: t('keypadEnter') }}
        captureKeyboard={captureKeyboard}
        aria-label={t('keypadLabel')}
      />
    </>
  );
}
