'use client';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name — required when no visible label is associated. */
  'aria-label'?: string;
}

/** Standard toggle used across all dashboard forms — styled via .toggle in landing.css. */
export function ToggleSwitch({ checked, onChange, disabled, 'aria-label': ariaLabel }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className="toggle"
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__knob" />
    </button>
  );
}
