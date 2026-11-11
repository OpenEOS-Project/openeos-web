'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  DataPager,
  DataTable,
  FilterBar,
  IconButton,
  type DataPagerProps,
  type DataTableProps,
  type FilterBarProps,
  type IconButtonProps,
} from '@openeos/ui';

import '@/styles/admin-table.css';

/*
 * Admin-Listen auf Basis von DataTable aus @openeos/ui (seit 0.7.0).
 *
 * Desktop: echte Tabelle ohne waagerechtes Scrollen — Spalten mit
 * `priority` 3 fallen unter 1180 px weg, 2 unter 1024 px. Telefon
 * (≤ 767 px): jede Zeile als zweizeiliger Eintrag (Spaltenrolle `mobile`),
 * alle Aktionen im ⋯-Menü. Hier nur die Voreinstellungen der Oberfläche:
 * Texte aus next-intl, bündig in einer .app-card (`flush`).
 */

export type AdminTableProps<T> = DataTableProps<T> & {
  /** In einer .app-card: ohne eigenen Rahmen, Ränder wie der Kartenkopf. */
  flush?: boolean;
};

export function AdminTable<T>({ flush = true, className, ...props }: AdminTableProps<T>) {
  const t = useTranslations('common.table');
  return (
    <DataTable<T>
      actionsLabel={t('actions')}
      moreLabel={t('more')}
      loadingLabel={t('loading')}
      empty={t('empty')}
      {...props}
      className={['admin-dt', flush && 'admin-dt--flush', className].filter(Boolean).join(' ')}
    />
  );
}

/** Seitenwahl unter einer AdminTable (als `footer`). */
export function AdminPager(props: Omit<DataPagerProps, 'labels'>) {
  const t = useTranslations('common.table');
  return (
    <DataPager
      {...props}
      labels={{
        prev: t('pagerPrev'),
        next: t('pagerNext'),
        info: (from, to, total) => (total === 0 ? t('pagerInfoEmpty') : t('pagerInfo', { from, to, total })),
        page: (page, pages) => t('pagerPage', { page, pages }),
        nav: t('pagerNav'),
        perPage: t('pagerPerPage'),
      }}
    />
  );
}

/** Filterzeile über einer AdminTable; auf dem Telefon Filter-Knopf + Sheet. */
export function AdminFilterBar({ className, ...props }: FilterBarProps) {
  const t = useTranslations('common.table');
  return (
    <FilterBar
      label={t('filter')}
      title={t('filterTitle')}
      resetLabel={t('resetFilters')}
      applyLabel={t('applyFilters')}
      {...props}
      className={['admin-filterbar', className].filter(Boolean).join(' ')}
    />
  );
}

interface ListHeadProps {
  /** Linke Seite: meist die Anzahl („18 Produkte“), darunter Hinweise. */
  children?: ReactNode;
  /** Rechte Seite: Symbolknöpfe (ListAction) bzw. ein Menü. */
  actions?: ReactNode;
}

/**
 * Kopf einer Listenkarte: Anzahl links, Aktionen als Symbolknöpfe mit
 * Tooltip rechts. Bleibt auch auf dem Telefon in einer Zeile.
 */
export function ListHead({ children, actions }: ListHeadProps) {
  return (
    <div className="app-card__head admin-list-head">
      <div className="admin-list-head__main">{children}</div>
      {actions ? <div className="admin-list-head__actions">{actions}</div> : null}
    </div>
  );
}

/** „18 Produkte“ im ListHead. */
export function ListCount({ children }: { children: ReactNode }) {
  return <p className="admin-list-head__count">{children}</p>;
}

/** Symbolknopf im ListHead: Beschriftung als Tooltip und aria-label. */
export function ListAction({ variant = 'ghost', ...props }: IconButtonProps) {
  return <IconButton variant={variant} tooltipPlacement="bottom" {...props} />;
}

interface CellMainProps {
  /** Symbol oder Bild links (Produktbild, Kategoriesymbol). */
  media?: ReactNode;
  title: ReactNode;
  /** Zweite Zeile, gekürzt (Beschreibung, Nummer). */
  sub?: ReactNode;
  /** Voller Text für das title-Attribut, wenn gekürzt wird. */
  titleText?: string;
  subText?: string;
  /** Zusatz unter dem Titel, der nicht gekürzt wird (Badge). */
  extra?: ReactNode;
}

/** Namenszelle: Symbol, fetter Titel, gedämpfte zweite Zeile — beide gekürzt. */
export function CellMain({ media, title, sub, titleText, subText, extra }: CellMainProps) {
  return (
    <span className="admin-cell-main">
      {media ? <span className="admin-cell-main__media">{media}</span> : null}
      <span className="admin-cell-main__text">
        <span className="admin-cell-main__title" title={titleText}>
          {title}
        </span>
        {sub ? (
          <span className="admin-cell-main__sub" title={subText}>
            {sub}
          </span>
        ) : null}
        {extra ? <span className="admin-cell-main__extra">{extra}</span> : null}
      </span>
    </span>
  );
}

/** Gekürzter Text mit vollem Inhalt als title. */
export function CellText({ children, title, muted }: { children: ReactNode; title?: string; muted?: boolean }) {
  return (
    <span className={muted ? 'admin-cell-text admin-cell-text--muted' : 'admin-cell-text'} title={title}>
      {children}
    </span>
  );
}

/** Leerer Wert („–“), gedämpft. */
export function CellNone() {
  return <span className="admin-cell-none">–</span>;
}

/** Telefon-Ansicht der Tabellen (≤ 767 px), wie in DataTable und FilterBar. */
export { FILTER_BAR_QUERY as PHONE_QUERY } from '@openeos/ui';
