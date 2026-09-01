'use client';

import type { ReactNode } from 'react';

import { ToggleSwitch } from './toggle-switch';

interface SettingToggleProps {
  label: ReactNode;
  /** Erklärender Satz unter der Beschriftung. */
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Weitere Bedienelemente, die zur Einstellung gehören — nur sichtbar, wenn sie an ist. */
  children?: ReactNode;
}

/**
 * Eine An/Aus-Einstellung: Beschriftung links, Kippschalter rechts.
 *
 * Bisher gab es dafür drei Muster nebeneinander — einen Kippschalter in
 * einem Rahmen, ein Ankreuzfeld in einem Rahmen und ein Ankreuzfeld ohne
 * Rahmen. Sie sahen unterschiedlich aus und verhielten sich unterschiedlich,
 * obwohl sie dasselbe bedeuten.
 *
 * Der Kippschalter statt des Ankreuzfelds ist nicht nur Geschmack: ein
 * Ankreuzfeld sagt "ausgewählt", ein Kippschalter sagt "an" — und um das
 * Zweite geht es hier. Ein Häkchen wirkt außerdem, als müsse man noch
 * speichern; ein Schalter sieht nach sofortiger Wirkung aus.
 */
export function SettingToggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
  children,
}: SettingToggleProps) {
  const labelId = `setting-${String(label).replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <div className="setting-toggle">
      <div className="setting-toggle__row">
        <div className="setting-toggle__copy">
          <div className="setting-toggle__label" id={labelId}>
            {label}
          </div>
          {hint && <div className="setting-toggle__hint">{hint}</div>}
        </div>
        <ToggleSwitch
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          aria-labelledby={labelId}
        />
      </div>
      {checked && children && <div className="setting-toggle__body">{children}</div>}
    </div>
  );
}
