'use client';

import { useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button, EmptyState, Icon, Switch } from '@openeos/ui';

import type { DiningTable, DiningTableShape, TableArea, UpdateDiningTableData } from '@/types/table';

import type { LayoutFields } from './use-layout-draft';
import { LABEL_MAX, SEATS_MAX, parseIntOrNull, sortTables } from './table-utils';

interface TablesListProps {
  areas: TableArea[];
  openCount: (table: DiningTable) => number;
  openLoading?: boolean;
  onUpdate: (table: DiningTable, data: UpdateDiningTableData) => void;
  onLayout: (table: DiningTable, fields: Partial<LayoutFields>) => void;
  onDelete: (table: DiningTable) => void;
}

const blurOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.currentTarget.blur();
  }
};

/**
 * Alle Tische der Organisation als Tabelle mit Inline-Bearbeitung —
 * auf dem Telefon der Ersatz für die Karte. Felder speichern beim
 * Verlassen, Schalter und Auswahlfelder sofort.
 */
export function TablesList({ areas, openCount, openLoading, onUpdate, onLayout, onDelete }: TablesListProps) {
  const t = useTranslations('tables.list');
  const rows = areas.flatMap((area) => sortTables(area.tables).map((table) => ({ table, area })));

  if (rows.length === 0) {
    return (
      <div className="oe-card">
        <EmptyState icon={<Icon name="table" />} title={t('empty')} description={t('emptyHint')} />
      </div>
    );
  }

  return (
    <div className="oe-table-wrap tables-list">
      <table className="oe-table oe-table--compact">
        <caption className="oe-sr-only">{t('caption', { count: rows.length })}</caption>
        <thead>
          <tr>
            <th scope="col">{t('label')}</th>
            <th scope="col">{t('area')}</th>
            <th scope="col">{t('seats')}</th>
            <th scope="col">{t('shape')}</th>
            <th scope="col">{t('active')}</th>
            <th scope="col" className="oe-table__num">
              {t('open')}
            </th>
            <th scope="col">
              <span className="oe-sr-only">{t('actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ table }) => (
            <TableRow
              key={`${table.id}:${table.label}:${table.seats}`}
              table={table}
              areas={areas}
              open={openLoading ? null : openCount(table)}
              onUpdate={onUpdate}
              onLayout={onLayout}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableRow({
  table,
  areas,
  open,
  onUpdate,
  onLayout,
  onDelete,
}: {
  table: DiningTable;
  areas: TableArea[];
  open: number | null;
  onUpdate: TablesListProps['onUpdate'];
  onLayout: TablesListProps['onLayout'];
  onDelete: TablesListProps['onDelete'];
}) {
  const t = useTranslations('tables.list');
  const tShape = useTranslations('tables.shape');
  const [label, setLabel] = useState(table.label);
  const [seats, setSeats] = useState(table.seats ? String(table.seats) : '');
  const [invalid, setInvalid] = useState<'label' | 'seats' | null>(null);

  const commitLabel = () => {
    const next = label.trim();
    if (!next || next.length > LABEL_MAX) {
      setInvalid('label');
      return;
    }
    setInvalid(null);
    if (next !== table.label) onUpdate(table, { label: next });
  };

  const commitSeats = () => {
    const raw = seats.trim();
    const value = raw ? parseIntOrNull(raw) : null;
    if (raw && (value === null || value < 1 || value > SEATS_MAX)) {
      setInvalid('seats');
      return;
    }
    setInvalid(null);
    if (value !== table.seats) onUpdate(table, { seats: value });
  };

  return (
    <tr className={table.isActive ? undefined : 'is-inactive'}>
      <td data-label={t('label')}>
        <input
          className="oe-input tables-list__label"
          value={label}
          maxLength={LABEL_MAX}
          aria-label={t('labelOf', { label: table.label })}
          aria-invalid={invalid === 'label' || undefined}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={blurOnEnter}
          autoComplete="off"
        />
      </td>
      <td data-label={t('area')}>
        <span className="oe-select-wrap">
          <select
            className="oe-select"
            value={table.areaId}
            aria-label={t('areaOf', { label: table.label })}
            onChange={(e) => onUpdate(table, { areaId: e.target.value })}
          >
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </span>
      </td>
      <td data-label={t('seats')}>
        <input
          className="oe-input tables-list__seats"
          type="number"
          inputMode="numeric"
          min={1}
          max={SEATS_MAX}
          value={seats}
          placeholder={t('seatsPlaceholder')}
          aria-label={t('seatsOf', { label: table.label })}
          aria-invalid={invalid === 'seats' || undefined}
          onChange={(e) => setSeats(e.target.value)}
          onBlur={commitSeats}
          onKeyDown={blurOnEnter}
        />
      </td>
      <td data-label={t('shape')}>
        <span className="oe-select-wrap">
          <select
            className="oe-select"
            value={table.shape}
            aria-label={t('shapeOf', { label: table.label })}
            onChange={(e) => onLayout(table, { shape: e.target.value as DiningTableShape })}
          >
            <option value="rect">{tShape('rect')}</option>
            <option value="round">{tShape('round')}</option>
          </select>
        </span>
      </td>
      <td data-label={t('active')}>
        <Switch
          checked={table.isActive}
          aria-label={t('activeOf', { label: table.label })}
          onChange={(e) => onUpdate(table, { isActive: e.target.checked })}
        />
      </td>
      <td data-label={t('open')} className="oe-table__num">
        {open === null ? '' : open}
      </td>
      <td className="tables-list__actions">
        <Button
          variant="quiet"
          size="sm"
          iconOnly
          aria-label={t('deleteOf', { label: table.label })}
          onClick={() => onDelete(table)}
        >
          <Icon name="trash" />
        </Button>
      </td>
    </tr>
  );
}
