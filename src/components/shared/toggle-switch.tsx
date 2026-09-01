'use client';

import { Switch } from '@openeos/ui';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name — required when no visible label is associated. */
  'aria-label'?: string;
  /** Id of a visible label, as an alternative to aria-label. */
  'aria-labelledby'?: string;
}

/**
 * Standardschalter aller Dashboard-Formulare.
 *
 * Reicht nur noch an den Schalter des Designsystems durch. Zuvor stand
 * hier eine eigene Umsetzung mit `.toggle` in landing.css, parallel zu
 * `.oe-switch` — zwei Schalter, die dasselbe tun und sich getrennt
 * verändern konnten. Die Schnittstelle bleibt, damit die Aufrufstellen
 * unberührt bleiben: sie geben einen Wahrheitswert, kein Ereignis.
 */
export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: ToggleSwitchProps) {
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}
