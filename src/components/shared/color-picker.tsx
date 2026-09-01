'use client';

import { useId, useRef } from 'react';

/**
 * Farbwahl aus einer Vorgabe, mit dem Systemdialog als Ausweg.
 *
 * Zuvor stand hier ein blankes <input type="color">: ein Quadrat, dessen
 * Aussehen jedes Betriebssystem selbst bestimmt, daneben der Hexwert als
 * Text. Es passte zu nichts und zwang für jede Farbe durch einen
 * Systemdialog — obwohl praktisch immer eine der immer gleichen
 * Kategoriefarben gemeint ist.
 *
 * Zwölf Töne decken den Farbkreis in gut unterscheidbaren Schritten ab
 * und passen mitsamt Plus-Feld und Hexwert in eine Zeile. Mehr wären
 * nicht nützlicher: Standorte und Kategorien sollen sich im Kassen-Raster
 * auf einen Blick auseinanderhalten lassen, und dafür sind feine
 * Abstufungen eher hinderlich als hilfreich.
 */
const PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#6366f1', '#a855f7', '#ec4899', '#78716c',
] as const;

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  onBlur?: () => void;
}

function normalise(color: string): string {
  return (color || '').trim().toLowerCase();
}

export function ColorPicker({ value, onChange, onBlur }: ColorPickerProps) {
  const nativeRef = useRef<HTMLInputElement>(null);
  const groupId = useId();
  const current = normalise(value);
  const isPreset = PRESETS.some((preset) => preset === current);

  return (
    <div className="color-picker">
      <div className="color-picker__swatches" role="radiogroup" aria-labelledby={groupId}>
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            role="radio"
            aria-checked={current === preset}
            aria-label={preset}
            title={preset}
            className={`color-picker__swatch${current === preset ? ' is-selected' : ''}`}
            style={{ '--swatch': preset } as React.CSSProperties}
            onClick={() => onChange(preset)}
            onBlur={onBlur}
          />
        ))}

        {/* Der Systemdialog bleibt erreichbar, tritt aber in den
            Hintergrund. Das eigentliche <input> ist unsichtbar; der Knopf
            davor traegt die aktuelle Farbe, damit auch eine frei gewaehlte
            in der Reihe sichtbar bleibt. */}
        <button
          type="button"
          className={`color-picker__swatch color-picker__swatch--custom${!isPreset && current ? ' is-selected' : ''}`}
          style={{ '--swatch': current || 'transparent' } as React.CSSProperties}
          onClick={() => nativeRef.current?.click()}
          aria-label="Eigene Farbe wählen"
          title="Eigene Farbe"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <input
          ref={nativeRef}
          type="color"
          className="color-picker__native"
          value={current || '#6366f1'}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
      <span className="color-picker__value" id={groupId}>
        {current || '—'}
      </span>
    </div>
  );
}
