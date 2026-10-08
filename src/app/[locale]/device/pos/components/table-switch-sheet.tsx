'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Checkbox, Icon } from '@openeos/ui';
import type { DeviceTableArea, PosTableContext } from '@/types/table';
import { tableContext, type OpenTableEntry, type TableSelectView } from '../utils/tables';
import { PosSheet } from './pos-sheet';
import { TableFloor } from './table-floor';
import { TableList } from './table-list';
import { TableNumberEntry } from './table-number-entry';

interface TableSwitchSheetProps {
  open: boolean;
  onClose: () => void;
  mode: 'free' | 'predefined';
  areas: DeviceTableArea[];
  openTables: OpenTableEntry[];
  current: PosTableContext | null;
  /** Ungesendete Positionen im Warenkorb (für „Warenkorb mitnehmen“). */
  itemCount: number;
  /** Vorauswahl „Warenkorb mitnehmen“ (nach TABLE_NOT_FOUND an). */
  carryDefault?: boolean;
  onSelect: (context: PosTableContext, carry: boolean) => void;
  /** Zurück zur Startansicht (parkt den Warenkorb). */
  onStart: () => void;
  /** Tischwahl des Geräts (wie die Startansicht, siehe `resolveTableSelectView`). */
  view: TableSelectView;
}

/**
 * „Tisch wählen“ aus der Bestellansicht (Tisch-Pille): genau die Tischwahl
 * des Geräts — Ziffernblock (bei freier Nummer immer), Chips je Bereich
 * oder Karte —, kein Umschalter; immer „Ohne Tisch“. Der Wechsel parkt den
 * Warenkorb, außer er wird mitgenommen.
 */
export function TableSwitchSheet({
  open,
  onClose,
  mode,
  areas,
  openTables,
  current,
  itemCount,
  carryDefault = false,
  onSelect,
  onStart,
  view,
}: TableSwitchSheetProps) {
  const t = useTranslations('pos.tables');
  const [carry, setCarry] = useState(carryDefault);
  const active: TableSelectView = mode === 'free' ? 'number' : view;

  useEffect(() => {
    if (!open) return;
    setCarry(carryDefault);
  }, [open, carryDefault]);

  const states = useMemo(() => {
    const map = new Map<string, OpenTableEntry>();
    for (const entry of openTables) if (entry.context.kind === 'table') map.set(entry.context.key, entry);
    return map;
  }, [openTables]);

  const select = (context: PosTableContext) => onSelect(context, carry && itemCount > 0);
  const currentLabel = !current
    ? null
    : current.kind === 'table'
      ? current.label
      : current.kind === 'togo'
        ? t('togo')
        : t('counter');

  return (
    <PosSheet
      open={open}
      onClose={onClose}
      size="wide"
      icon="table"
      iconTone="default"
      title={t('switchTitle')}
      subtitle={currentLabel ? t('switchCurrent', { label: currentLabel }) : undefined}
      footer={
        <Button variant="ghost" onClick={onStart}>
          <Icon name="grid" />
          {t('toStart')}
        </Button>
      }
    >
      <div className="pos-switch">
        {active === 'map' ? (
          <TableFloor
            areas={areas}
            states={states}
            currentKey={current?.kind === 'table' ? current.key : null}
            onPick={(table) => select(tableContext(table))}
            showWaiting
          />
        ) : active === 'list' ? (
          <TableList
            size="md"
            areas={areas}
            states={states}
            currentKey={current?.kind === 'table' ? current.key : null}
            onPick={(table) => select(tableContext(table))}
          />
        ) : (
          <div className="pos-start__pad">
            {/* Neu einhängen beim Öffnen: leere Eingabe. */}
            {open && (
              <TableNumberEntry
                mode={mode}
                areas={areas}
                states={states}
                onOpen={select}
                captureKeyboard={open}
              />
            )}
          </div>
        )}
        <div className="pos-without">
          <span className="oe-label">{t('withoutTable')}</span>
          <div className="pos-without__acts">
            <Button
              variant="secondary"
              disabled={current?.kind === 'counter'}
              onClick={() => select({ kind: 'counter' })}
            >
              <Icon name="beer" />
              {t('counter')}
            </Button>
            <Button variant="secondary" disabled={current?.kind === 'togo'} onClick={() => select({ kind: 'togo' })}>
              <Icon name="send" />
              {t('togo')}
            </Button>
          </div>
        </div>
        {itemCount > 0 && (
          <label className="pos-carry">
            <Checkbox checked={carry} onChange={(e) => setCarry(e.currentTarget.checked)} />
            <span>
              <b>{t('carry')}</b>
              <small>{t('carryHint', { count: itemCount })}</small>
            </span>
          </label>
        )}
      </div>
    </PosSheet>
  );
}
