'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Checkbox, Icon, Segment } from '@openeos/ui';
import { toTableKey, type DeviceTableArea, type PosTableContext } from '@/types/table';
import { hasFloorLayout, tableContext, type OpenTableEntry } from '../utils/tables';
import { PosSheet } from './pos-sheet';
import { TableFloor } from './table-floor';
import { TableKeypad } from './table-keypad';
import { TableList } from './table-list';

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
  /** Ansicht beim Öffnen: Karte, wenn die Startansicht des Geräts die Karte ist. */
  preferMap?: boolean;
}

type SwitchView = 'list' | 'map';

/**
 * „Tisch wählen“ aus der Bestellansicht (Tisch-Pille): bei vordefinierten
 * Tischen die Chips je Bereich oder die Karte (Umschalter, wenn ein Bereich
 * einen Tischplan hat), bei freier Nummer der Ziffernblock; immer „Ohne
 * Tisch“. Der Wechsel parkt den Warenkorb, außer er wird mitgenommen.
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
  preferMap = false,
}: TableSwitchSheetProps) {
  const t = useTranslations('pos.tables');
  const tOrder = useTranslations('pos.order');
  const tFloor = useTranslations('pos.floor');
  const [input, setInput] = useState('');
  const [carry, setCarry] = useState(carryDefault);
  const hasMap = mode === 'predefined' && areas.some(hasFloorLayout);
  const [view, setView] = useState<SwitchView>(preferMap ? 'map' : 'list');

  useEffect(() => {
    if (!open) return;
    setInput('');
    setCarry(carryDefault);
    setView(preferMap ? 'map' : 'list');
  }, [open, carryDefault, preferMap]);

  const showMap = hasMap && view === 'map';

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

  const submitFree = () => {
    const label = input.trim();
    if (label) select({ kind: 'table', key: toTableKey(label), label });
  };

  return (
    <PosSheet
      open={open}
      onClose={onClose}
      size="wide"
      icon="table"
      iconTone="default"
      title={t('switchTitle')}
      subtitle={currentLabel ? t('switchCurrent', { label: currentLabel }) : undefined}
      toolbar={
        hasMap ? (
          <Segment<SwitchView>
            size="lg"
            aria-label={t('viewLabel')}
            options={[
              { id: 'list', label: t('viewList'), icon: 'list' },
              { id: 'map', label: tFloor('viewMap'), icon: 'map' },
            ]}
            value={view}
            onChange={setView}
          />
        ) : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onStart}>
            <Icon name="grid" />
            {t('toStart')}
          </Button>
          {mode === 'free' && (
            <Button variant="primary" size="lg" className="oe-grow" disabled={!input} onClick={submitFree}>
              <Icon name="arrow-right" />
              {input ? tOrder('openTable', { label: input }) : tOrder('enterNumber')}
            </Button>
          )}
        </>
      }
    >
      <div className="pos-switch">
        {showMap ? (
          <TableFloor
            areas={areas}
            states={states}
            currentKey={current?.kind === 'table' ? current.key : null}
            onPick={(table) => select(tableContext(table))}
            showWaiting
          />
        ) : mode === 'predefined' ? (
          <TableList
            size="md"
            areas={areas}
            states={states}
            currentKey={current?.kind === 'table' ? current.key : null}
            onPick={(table) => select(tableContext(table))}
          />
        ) : (
          <div className="pos-start__pad">
            <TableKeypad value={input} onChange={setInput} onSubmit={submitFree} captureKeyboard={open} />
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
