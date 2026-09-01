'use client';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name — required when no visible label is associated. */
  'aria-label'?: string;
  /** Id of a visible label, as an alternative to aria-label. */
  'aria-labelledby'?: string;
}

/** Standard toggle used across all dashboard forms — styled via .toggle in landing.css. */
export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      disabled={disabled}
      className="toggle"
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__knob" />
    </button>
  );
}
