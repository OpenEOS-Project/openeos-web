'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Icon, SearchInput } from '@openeos/ui';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { PosIconImage } from '@/components/shared/pos-icon-image';
import { parsePosIcon, toPosIconValue } from '@/utils/product-icon';
import '@/styles/icon-picker.css';

interface PosIconEntry {
  id: string;
  terms: string[];
}

interface PosIconPickerProps {
  isOpen: boolean;
  /** Aktueller Wert (`pos-icon:<id>`), wird hervorgehoben. */
  value?: string | null;
  onClose: () => void;
  /** Liefert den Speicherwert `pos-icon:<id>`. */
  onSelect: (value: string) => void;
}

type Group = 'drink' | 'food';
const GROUPS: Group[] = ['drink', 'food'];

/** Katalog aus scripts/sync-pos-icons.mjs, einmal je Sitzung geladen. */
let catalog: Promise<PosIconEntry[]> | null = null;
function loadCatalog(): Promise<PosIconEntry[]> {
  catalog ??= fetch('/pos-icons/index.json')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{ icons: PosIconEntry[] }>;
    })
    .then((data) => data.icons)
    .catch((error: unknown) => {
      catalog = null;
      throw error;
    });
  return catalog;
}

/** Klein, ohne Akzente: „Crêpes“ findet auch „crepes“. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** „wasser (flasche)“ → „Wasser (Flasche)“ */
function labelOf(entry: PosIconEntry): string {
  const text = entry.terms[0] ?? entry.id.replace(/-/g, ' ');
  return text.replace(/(^|\()\p{L}/gu, (m) => m.toUpperCase());
}

function groupOf(entry: PosIconEntry): Group {
  return entry.terms.includes('drink') ? 'drink' : 'food';
}

/**
 * Auswahl des Produkt-Icons aus @openeos/pos-icons (47 Produktbilder) mit
 * Suche über die Begriffe des Pakets (data/index.json, deutsch und
 * englisch). Ohne Suche nach Getränken und Speisen geordnet.
 */
export function PosIconPicker({ isOpen, value, onClose, onSelect }: PosIconPickerProps) {
  const t = useTranslations('posIconPicker');
  const titleId = useId();
  const searchRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [icons, setIcons] = useState<PosIconEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const current = parsePosIcon(value);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || icons) return;
    let active = true;
    setFailed(false);
    loadCatalog()
      .then((list) => active && setIcons(list))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [isOpen, icons]);

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

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q || !icons) return null;
    const scored: { entry: PosIconEntry; score: number }[] = [];
    for (const entry of icons) {
      const words = [entry.id, ...entry.terms].map(normalize);
      const best = words.reduce((score, word) => {
        if (word === q) return Math.min(score, 0);
        if (word.startsWith(q)) return Math.min(score, 1);
        if (word.includes(q)) return Math.min(score, 2);
        return score;
      }, 9);
      if (best < 9) scored.push({ entry, score: best });
    }
    return scored
      .sort((a, b) => a.score - b.score || labelOf(a.entry).localeCompare(labelOf(b.entry)))
      .map((s) => s.entry);
  }, [query, icons]);

  if (!isOpen) return null;

  const close = () => {
    setQuery('');
    onClose();
  };

  const choose = (id: string) => {
    onSelect(toPosIconValue(id));
    setQuery('');
    onClose();
  };

  const renderGrid = (entries: readonly PosIconEntry[]) => (
    <div className="icon-picker__grid icon-picker__grid--images">
      {entries.map((entry) => {
        const selected = entry.id === current;
        const label = labelOf(entry);
        return (
          <button
            key={entry.id}
            type="button"
            className={selected ? 'icon-picker__item is-selected' : 'icon-picker__item'}
            aria-pressed={selected}
            title={label}
            onClick={() => choose(entry.id)}
          >
            <span className="oe-icobox oe-icobox--lg icon-picker__image">
              <PosIconImage id={entry.id} />
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );

  let body;
  if (failed) {
    body = <p className="icon-picker__empty">{t('loadError')}</p>;
  } else if (!icons) {
    body = <p className="icon-picker__empty">{t('loading')}</p>;
  } else if (results) {
    body =
      results.length > 0 ? (
        <section aria-label={t('results', { count: results.length })}>{renderGrid(results)}</section>
      ) : (
        <p className="icon-picker__empty">{t('noResults')}</p>
      );
  } else {
    body = GROUPS.map((group) => (
      <section key={group} aria-labelledby={`${titleId}-${group}`}>
        <h3 id={`${titleId}-${group}`} className="icon-picker__group">
          {t(`groups.${group}`)}
        </h3>
        {renderGrid(icons.filter((entry) => groupOf(entry) === group))}
      </section>
    ));
  }

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
        <div className="modal__body icon-picker__body">{body}</div>
        <div className="modal__foot">
          <Button variant="ghost" onClick={close}>
            {t('close')}
          </Button>
        </div>
      </ModalPanel>
    </div>
  );
}
