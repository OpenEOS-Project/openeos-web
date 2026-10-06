'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button, Icon, IconBox, SearchInput } from '@openeos/ui';
import { iconGroups, iconKeywords, iconNames, type IconGroup, type IconName } from '@openeos/ui/icons';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { parseOeIcon, toIconValue } from '@/utils/product-icon';
import '@/styles/icon-picker.css';

interface OeIconPickerProps {
  isOpen: boolean;
  /** Aktueller Wert (`oe:<name>`), wird hervorgehoben. */
  value?: string | null;
  onClose: () => void;
  /** Liefert den Speicherwert `oe:<name>`. */
  onSelect: (value: string) => void;
}

/** Speisen zuerst — darum geht es bei Kategorien fast immer. */
const GROUP_ORDER: IconGroup[] = ['food', 'operations', 'payment', 'actions', 'status'];

/** Klein, ohne Akzente: „Brötchen“ findet auch „brotchen“. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Icon-Auswahl aus dem OpenEOS-Set (Lucide, Spezifikation §4.6) für
 * Kategorien. Suche über den Namen und die deutschen und englischen
 * Stichwörter des Pakets, ohne Suche nach Gruppen geordnet — Speisen und
 * Getränke zuerst. Produkte wählen ihr Bild aus @openeos/pos-icons
 * (pos-icon-picker.tsx).
 */
export function OeIconPicker({ isOpen, value, onClose, onSelect }: OeIconPickerProps) {
  const t = useTranslations('oeIconPicker');
  const locale = useLocale();
  const lang: 'de' | 'en' = locale === 'de' ? 'de' : 'en';
  const titleId = useId();
  const searchRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const current = parseOeIcon(value);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    searchRef.current?.querySelector('input')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Nur dieser Dialog, nicht das Formular darunter.
        event.stopPropagation();
        setQuery('');
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [isOpen]);

  const labelOf = (name: IconName) => capitalize(iconKeywords[name]?.[lang]?.[0] ?? name.replace(/-/g, ' '));

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return null;
    const scored: { name: IconName; score: number }[] = [];
    for (const name of iconNames) {
      const words = [name, ...(iconKeywords[name]?.de ?? []), ...(iconKeywords[name]?.en ?? [])].map(normalize);
      const best = words.reduce((score, word) => {
        if (word === q) return Math.min(score, 0);
        if (word.startsWith(q)) return Math.min(score, 1);
        if (word.includes(q)) return Math.min(score, 2);
        return score;
      }, 9);
      if (best < 9) scored.push({ name, score: best });
    }
    return scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name)).map((s) => s.name);
  }, [query]);

  if (!isOpen) return null;

  const close = () => {
    setQuery('');
    onClose();
  };

  const choose = (name: IconName) => {
    onSelect(toIconValue(name));
    setQuery('');
    onClose();
  };

  const renderGrid = (names: readonly IconName[]) => (
    <div className="icon-picker__grid">
      {names.map((name) => {
        const selected = name === current;
        return (
          <button
            key={name}
            type="button"
            className={selected ? 'icon-picker__item is-selected' : 'icon-picker__item'}
            aria-pressed={selected}
            title={name}
            onClick={() => choose(name)}
          >
            <IconBox icon={name} tone={selected ? 'ink' : 'accent'} />
            <span>{labelOf(name)}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className="modal__overlay icon-picker"
      onClick={(event) => {
        // Liegt der Dialog in einem anderen Dialog, schließt nur er.
        event.stopPropagation();
        close();
      }}
    >
      <ModalPanel titleId={titleId} className="modal__panel--lg">
        <div className="modal__head">
          <h2 id={titleId}>{t('title')}</h2>
          <DialogCloseButton onClick={close} />
        </div>
        <div className="icon-picker__search" ref={searchRef}>
          <SearchInput
            icon={<Icon name="search" />}
            value={query}
            placeholder={t('search')}
            aria-label={t('search')}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="modal__body icon-picker__body">
          {results ? (
            results.length > 0 ? (
              <section aria-label={t('results', { count: results.length })}>{renderGrid(results)}</section>
            ) : (
              <p className="icon-picker__empty">{t('noResults')}</p>
            )
          ) : (
            GROUP_ORDER.map((group) => (
              <section key={group} aria-labelledby={`${titleId}-${group}`}>
                <h3 id={`${titleId}-${group}`} className="icon-picker__group">
                  {t(`groups.${group}`)}
                </h3>
                {renderGrid(iconGroups[group])}
              </section>
            ))
          )}
        </div>
        <div className="modal__foot">
          <Button variant="ghost" onClick={close}>
            {t('close')}
          </Button>
        </div>
      </ModalPanel>
    </div>
  );
}
