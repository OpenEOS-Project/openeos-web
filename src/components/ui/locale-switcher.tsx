'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Globe01 } from '@untitledui/icons';
import { cx } from '@/utils/cx';

interface LocaleSwitcherProps {
  className?: string;
}

const locales = [
  { code: 'de', label: 'DE' },
  { code: 'en', label: 'EN' },
];

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLocaleChange = (newLocale: string) => {
    // Change URL locale segment
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  };

  const currentLocale = locales.find((l) => l.code === locale);
  const nextLocale = locales.find((l) => l.code !== locale);

  return (
    <button
      onClick={() => nextLocale && handleLocaleChange(nextLocale.code)}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-tertiary transition hover:bg-secondary hover:text-primary',
        className
      )}
      aria-label={`Switch to ${nextLocale?.label}`}
    >
      <Globe01 className="h-4 w-4" />
      <span>{currentLocale?.label}</span>
    </button>
  );
}
