'use client';

import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { EmptyState, Icon, Switch, type DataColumn, type RowAction } from '@openeos/ui';

import { AdminTable } from '@/components/shared/admin-table';
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

interface Row {
  table: DiningTable;
  area: TableArea;
}

const blurOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.currentTarget.blur();
  }
};

/** Telefon: Beschriftung über dem Feld (die Kopfzeile ist dort aus). */
function PhoneField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="tables-list__field">
      <span className="tables-list__field-label" aria-hidden>
        {label}
      </span>
      {children}
    </span>
  );
}

/**
 * Alle Tische der Organisation als Tabelle mit Inline-Bearbeitung —
 * auf dem Telefon der Ersatz für die Karte. Felder speichern beim
 * Verlassen, Schalter und Auswahlfelder sofort.
 */
export function TablesList({ areas, openCount, openLoading, onUpdate, onLayout, onDelete }: TablesListProps) {
  const t = useTranslations('tables.list');
  const tShape = useTranslations('tables.shape');
  const rows: Row[] = areas.flatMap((area) => sortTables(area.tables).map((table) => ({ table, area })));

  if (rows.length === 0) {
    return (
      <div className="oe-card">
        <EmptyState icon={<Icon name="table" />} title={t('empty')} description={t('emptyHint')} />
      </div>
    );
  }

  /* Eingabefelder statt Text: die DataTable-Zeile auf dem Telefon wird
     per tables.css zur Karte mit beschrifteten Feldern (wie bisher). */
  const columns: DataColumn<Row>[] = [
    {
      id: 'label',
      header: t('label'),
      mobile: 'title',
      className: 'tables-list__c-label',
      cell: ({ table }) => (
        <PhoneField label={t('label')}>
          <LabelInput table={table} onUpdate={onUpdate} />
        </PhoneField>
      ),
    },
    {
      id: 'area',
      header: t('area'),
      mobile: 'meta',
      className: 'tables-list__c-area',
      cell: ({ table }) => (
        <PhoneField label={t('area')}>
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
        </PhoneField>
      ),
    },
    {
      id: 'seats',
      header: t('seats'),
      mobile: 'meta',
      className: 'tables-list__c-seats',
      cell: ({ table }) => (
        <PhoneField label={t('seats')}>
          <SeatsInput table={table} onUpdate={onUpdate} />
        </PhoneField>
      ),
    },
    {
      id: 'shape',
      header: t('shape'),
      mobile: 'meta',
      className: 'tables-list__c-shape',
      cell: ({ table }) => (
        <PhoneField label={t('shape')}>
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
        </PhoneField>
      ),
    },
    {
      id: 'active',
      header: t('active'),
      mobile: 'meta',
      className: 'tables-list__c-active',
      cell: ({ table }) => (
        <PhoneField label={t('active')}>
          <Switch
            checked={table.isActive}
            aria-label={t('activeOf', { label: table.label })}
            onChange={(e) => onUpdate(table, { isActive: e.target.checked })}
          />
        </PhoneField>
      ),
    },
    {
      id: 'open',
      header: t('open'),
      num: true,
      mobile: 'meta',
      className: 'tables-list__c-open',
      cell: ({ table }) => (
        <PhoneField label={t('open')}>{openLoading ? '' : openCount(table)}</PhoneField>
      ),
    },
  ];

  const actions = ({ table }: Row): RowAction[] => [
    {
      id: 'delete',
      label: t('deleteOf', { label: table.label }),
      icon: 'trash',
      danger: true,
      onClick: () => onDelete(table),
    },
  ];

  return (
    <AdminTable
      flush={false}
      className="tables-list"
      caption={t('caption', { count: rows.length })}
      actionsLabel={t('actions')}
      rows={rows}
      // Bezeichnung und Plätze im Schlüssel: ändert der Server sie, startet
      // die Zeile mit frischen Feldwerten.
      rowKey={({ table }) => `${table.id}:${table.label}:${table.seats}`}
      columns={columns}
      actions={actions}
      rowClassName={({ table }) => (table.isActive ? undefined : 'is-inactive')}
    />
  );
}

function LabelInput({ table, onUpdate }: { table: DiningTable; onUpdate: TablesListProps['onUpdate'] }) {
  const t = useTranslations('tables.list');
  const [label, setLabel] = useState(table.label);
  const [invalid, setInvalid] = useState(false);

  const commitLabel = () => {
    const next = label.trim();
    if (!next || next.length > LABEL_MAX) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (next !== table.label) onUpdate(table, { label: next });
  };

  return (
    <input
      className="oe-input tables-list__label"
      value={label}
      maxLength={LABEL_MAX}
      aria-label={t('labelOf', { label: table.label })}
      aria-invalid={invalid || undefined}
      onChange={(e) => setLabel(e.target.value)}
      onBlur={commitLabel}
      onKeyDown={blurOnEnter}
      autoComplete="off"
    />
  );
}

function SeatsInput({ table, onUpdate }: { table: DiningTable; onUpdate: TablesListProps['onUpdate'] }) {
  const t = useTranslations('tables.list');
  const [seats, setSeats] = useState(table.seats ? String(table.seats) : '');
  const [invalid, setInvalid] = useState(false);

  const commitSeats = () => {
    const raw = seats.trim();
    const value = raw ? parseIntOrNull(raw) : null;
    if (raw && (value === null || value < 1 || value > SEATS_MAX)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (value !== table.seats) onUpdate(table, { seats: value });
  };

  return (
    <input
      className="oe-input tables-list__seats"
      type="number"
      inputMode="numeric"
      min={1}
      max={SEATS_MAX}
      value={seats}
      placeholder={t('seatsPlaceholder')}
      aria-label={t('seatsOf', { label: table.label })}
      aria-invalid={invalid || undefined}
      onChange={(e) => setSeats(e.target.value)}
      onBlur={commitSeats}
      onKeyDown={blurOnEnter}
    />
  );
}
