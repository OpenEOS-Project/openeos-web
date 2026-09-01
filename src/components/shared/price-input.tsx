'use client';

import { useEffect, useRef, useState } from 'react';

interface PriceInputProps {
  /** Betrag in Euro, so wie er im Formular steht. */
  value: number | string;
  onChange: (value: number) => void;
  onBlur?: () => void;
  currencySymbol?: string;
  autoFocus?: boolean;
  'aria-invalid'?: boolean;
}

/** Zerlegt einen Betrag in ganze Euro und Cent. */
function split(value: number | string): { euro: string; cent: string } {
  const amount = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (!Number.isFinite(amount)) return { euro: '', cent: '' };
  const cents = Math.round(Math.abs(amount) * 100);
  return {
    euro: String(Math.floor(cents / 100)),
    cent: String(cents % 100).padStart(2, '0'),
  };
}

function toAmount(euro: string, cent: string): number {
  const e = parseInt(euro || '0', 10) || 0;
  // Eine einzelne Ziffer im Cent-Feld sind Zehner: "5" heisst 50 Cent, nicht 5.
  // Sonst wuerde aus 3 € 5 unterwegs 3,05 € statt der erwarteten 3,50 €.
  const raw = cent.trim();
  const c = raw.length === 1 ? parseInt(raw, 10) * 10 : parseInt(raw || '0', 10) || 0;
  return e + Math.min(c, 99) / 100;
}

/**
 * Preiseingabe in zwei Feldern: Euro und Cent.
 *
 * Ein einzelnes Zahlenfeld mit Schrittweite 0,01 sieht harmlos aus, ist an
 * der Kasse aber unangenehm: das Dezimaltrennzeichen unterscheidet sich je
 * nach Tastatur, auf dem Telefon erscheint mal ein Komma und mal ein Punkt,
 * und die kleinen Pfeile springen in Ein-Cent-Schritten. Zwei Felder
 * brauchen kein Trennzeichen.
 *
 * Komma oder Punkt im Euro-Feld springen weiter zum Cent, die Rücktaste
 * im leeren Cent-Feld führt zurück. Wer "3,50" tippt, landet also richtig,
 * ohne die Felder bewusst wechseln zu müssen.
 */
export function PriceInput({
  value,
  onChange,
  onBlur,
  currencySymbol = '€',
  autoFocus,
  'aria-invalid': ariaInvalid,
}: PriceInputProps) {
  const [parts, setParts] = useState(() => split(value));
  const centRef = useRef<HTMLInputElement>(null);
  const euroRef = useRef<HTMLInputElement>(null);

  /* Der Betrag kann sich von aussen aendern — beim Oeffnen des Dialogs mit
     einem bestehenden Produkt. Waehrend des Tippens nicht zurueckschreiben,
     sonst verschwindet ein halb eingegebener Cent-Wert. */
  useEffect(() => {
    const next = split(value);
    setParts((current) =>
      toAmount(current.euro, current.cent) === toAmount(next.euro, next.cent) ? current : next,
    );
  }, [value]);

  const update = (euro: string, cent: string) => {
    setParts({ euro, cent });
    onChange(toAmount(euro, cent));
  };

  const digitsOnly = (raw: string, max: number) => raw.replace(/\D/g, '').slice(0, max);

  return (
    <div className="price-input" aria-invalid={ariaInvalid}>
      <input
        ref={euroRef}
        className="input price-input__euro"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="0"
        aria-label="Euro"
        value={parts.euro}
        onChange={(e) => update(digitsOnly(e.target.value, 6), parts.cent)}
        onKeyDown={(e) => {
          // Wer die Zahl am Stueck tippt, trennt sie mit Komma oder Punkt.
          if (e.key === ',' || e.key === '.') {
            e.preventDefault();
            centRef.current?.focus();
          }
        }}
        onBlur={onBlur}
      />
      <span className="price-input__separator" aria-hidden="true">,</span>
      <input
        ref={centRef}
        className="input price-input__cent"
        inputMode="numeric"
        autoComplete="off"
        placeholder="00"
        aria-label="Cent"
        value={parts.cent}
        onChange={(e) => update(parts.euro, digitsOnly(e.target.value, 2))}
        onKeyDown={(e) => {
          if (e.key === 'Backspace' && parts.cent === '') {
            e.preventDefault();
            euroRef.current?.focus();
          }
        }}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          // Beim Verlassen auf zwei Stellen auffuellen, damit dort nicht
          // "3,5" stehen bleibt, wo 3,50 gemeint war.
          if (parts.cent !== '') {
            const padded = String(Math.min(toAmountCent(parts.cent), 99)).padStart(2, '0');
            if (padded !== parts.cent) setParts((p) => ({ ...p, cent: padded }));
          }
          onBlur?.();
        }}
      />
      <span className="price-input__currency">{currencySymbol}</span>
    </div>
  );
}

function toAmountCent(cent: string): number {
  return cent.length === 1 ? parseInt(cent, 10) * 10 : parseInt(cent, 10) || 0;
}
