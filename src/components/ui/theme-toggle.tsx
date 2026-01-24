'use client';

import { useTheme } from 'next-themes';
import { Moon01, Sun } from '@untitledui/icons';
import { useEffect, useState } from 'react';

import { cx } from '@/utils/cx';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className={cx(
          'inline-flex size-10 items-center justify-center rounded-lg text-fg-quaternary transition hover:bg-primary_hover hover:text-fg-quaternary_hover',
          className
        )}
        aria-label="Toggle theme"
      >
        <div className="size-5" />
      </button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cx(
        'inline-flex size-10 items-center justify-center rounded-lg text-fg-quaternary transition hover:bg-primary_hover hover:text-fg-quaternary_hover',
        className
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="size-5" /> : <Moon01 className="size-5" />}
    </button>
  );
}
