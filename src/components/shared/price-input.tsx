'use client';

import { useEffect, useState } from 'react';

interface PriceInputProps {
  /** Betrag, so wie er im Formular steht. */
  value: number | string;
  onChange: (value: number) => void;
  onBlur?: () => void;
  /** Anhang rechts. Standard EUR; Organisationen können eine andere Währung führen. */
  currency?: string;
  placeholder?: string;
  invalid?: boolean;
}

/** Anzeige mit Komma, weil hier deutsch gerechnet wird. */
function format(value: number | string): string {
  const amount = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (!Number.isFinite(amount)) return '';
  return amount.toFixed(2).replace('.', ',');
}

/** Liest Komma wie Punkt und ignoriert alles andere. */
function parse(text: string): number {
  const cleaned = text.replace(/[^\d,.-]/g, '').replace(',', '.');
  const amount = parseFloat(cleaned);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

/**
 * Betragseingabe: ein Feld mit der Währung als Anhang.
 *
 * Es bleibt ein Textfeld, kein `type="number"`. Dessen Pfeile springen in
 * Ein-Cent-Schritten, das Mausrad verstellt versehentlich den Preis, und
 * je nach Tastatur wird mal Komma und mal Punkt akzeptiert. Hier gelten
 * beide.
 *
 * Formatiert wird erst beim Verlassen des Felds — währenddessen bliebe
 * sonst der Cursor nicht stehen, sobald aus "4," ein "4,00" würde.
 */
export function PriceInput({
  value,
  onChange,
  onBlur,
  currency = 'EUR',
  placeholder = '0,00',
  invalid,
}: PriceInputProps) {
  const [text, setText] = useState(() => format(value));
  const [editing, setEditing] = useState(false);

  /* Von außen gesetzte Werte übernehmen — etwa beim Öffnen des Dialogs mit
     einem bestehenden Produkt. Während des Tippens nicht, sonst würde die
     Eingabe unter dem Cursor umgeschrieben. */
  useEffect(() => {
    if (!editing) setText(format(value));
  }, [value, editing]);

  return (
    <div className="oe-input-group price-group">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={`input${invalid ? ' input--error' : ''}`}
        placeholder={placeholder}
        value={text}
        onFocus={() => setEditing(true)}
        onChange={(event) => {
          setText(event.target.value);
          onChange(parse(event.target.value));
        }}
        onBlur={() => {
          setEditing(false);
          setText(format(parse(text)));
          onBlur?.();
        }}
      />
      <span className="oe-input-group__addon">{currency}</span>
    </div>
  );
}
