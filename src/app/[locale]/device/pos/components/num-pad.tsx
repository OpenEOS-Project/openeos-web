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

export function NumPad({ value, onChange, onSubmit, maxLength = 10, className }: NumPadProps) {
  const handlePress = (digit: string) => {
    if (value.length < maxLength) {
      onChange(value + digit);
    }
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange('');
  };

  const buttons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['C', '0', 'DEL'],
  ];

  return (
    <div className={cx('grid grid-cols-3 gap-2', className)}>
      {buttons.flat().map((btn) => {
        if (btn === 'DEL') {
          return (
            <button
              key={btn}
              type="button"
              onClick={handleBackspace}
              className="flex h-14 items-center justify-center rounded-lg border border-secondary bg-secondary text-tertiary transition-colors hover:bg-tertiary-hover active:bg-quaternary"
            >
              <Delete className="h-6 w-6" />
            </button>
          );
        }

        if (btn === 'C') {
          return (
            <button
              key={btn}
              type="button"
              onClick={handleClear}
              className="flex h-14 items-center justify-center rounded-lg border border-secondary bg-secondary text-tertiary transition-colors hover:bg-tertiary-hover active:bg-quaternary text-lg font-medium"
            >
              C
            </button>
          );
        }

        return (
          <button
            key={btn}
            type="button"
            onClick={() => handlePress(btn)}
            className="flex h-14 items-center justify-center rounded-lg border border-secondary bg-primary text-primary transition-colors hover:bg-secondary active:bg-tertiary text-2xl font-semibold"
          >
            {btn}
          </button>
        );
      })}
    </div>
  );
}
