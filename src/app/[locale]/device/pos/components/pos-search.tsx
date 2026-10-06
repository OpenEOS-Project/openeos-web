'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Icon } from '@openeos/ui';

interface PosSearchProps {
  open: boolean;
  query: string;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
}

/** Such-Knopf, der zu einem Feld aufklappt. Escape schließt. */
export function PosSearch({ open, query, onOpenChange, onQueryChange }: PosSearchProps) {
  const t = useTranslations('pos.order');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = () => {
    onQueryChange('');
    onOpenChange(false);
  };

  return (
    <div className={open ? 'pos-search is-open' : 'pos-search'} role="search">
      <input
        ref={inputRef}
        type="search"
        className="oe-input"
        value={query}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        autoComplete="off"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        }}
      />
      <Button
        variant="ghost"
        iconOnly
        className="pos-search__btn"
        aria-label={open ? t('searchClose') : t('searchOpen')}
        aria-expanded={open}
        onClick={() => (open ? close() : onOpenChange(true))}
      >
        <Icon name={open ? 'x' : 'search'} />
      </Button>
    </div>
  );
}

/** Vergleichsform: klein, ohne Diakritika („Brötchen“ trifft „brotchen“). */
export function searchKey(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
