'use client';

import { Delete } from '@untitledui/icons';
import { cx } from '@/utils/cx';

interface NumPadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  maxLength?: number;
  className?: string;
}

/**
 * Ziffernblock für Tischnummer, Bargeld und PIN.
 *
 * Eigene Klassen aus pos.css statt Tailwind: Das Geräte-Layout lädt nur
 * diese eine Datei. Die Tailwind-Klassen, die hier vorher standen, waren
 * auf der Kasse wirkungslos — die Knöpfe erschienen in der Voreinstellung
 * des Browsers, also mit schwarzer Schrift auf hellem Grund, mitten in
 * einer dunklen Oberfläche.
 */
export function NumPad({ value, onChange, onSubmit, maxLength = 10, className }: NumPadProps) {
  const druecken = (ziffer: string) => {
    if (value.length < maxLength) onChange(value + ziffer);
  };

  const tasten = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['C', '0', 'DEL'],
  ];

  return (
    <div className={cx('pos-numpad', className)}>
      {tasten.flat().map((taste) => {
        if (taste === 'DEL') {
          return (
            <button
              key={taste}
              type="button"
              onClick={() => onChange(value.slice(0, -1))}
              className="pos-numpad__key pos-numpad__key--soft"
              aria-label="Löschen"
            >
              <Delete />
            </button>
          );
        }

        if (taste === 'C') {
          return (
            <button
              key={taste}
              type="button"
              onClick={() => onChange('')}
              className="pos-numpad__key pos-numpad__key--soft"
            >
              C
            </button>
          );
        }

        return (
          <button
            key={taste}
            type="button"
            onClick={() => druecken(taste)}
            className="pos-numpad__key"
          >
            {taste}
          </button>
        );
      })}
    </div>
  );
}
