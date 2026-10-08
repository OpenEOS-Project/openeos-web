'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Icon, TableChip } from '@openeos/ui';
import { toTableKey, type DeviceTableArea, type PosTableContext } from '@/types/table';
import { matchTables, tableContext, type OpenTableEntry } from '../utils/tables';
import { TableKeypad, TABLE_INPUT_MAX, TABLE_SEARCH_MAX } from './table-keypad';

interface TableNumberEntryProps {
  /** `free`: Nummer frei eingeben · `predefined`: Suche in den angelegten Tischen. */
  mode: 'free' | 'predefined';
  areas: DeviceTableArea[];
  /** Offene/wartende Tische nach Tischschlüssel (Farbe der Treffer). */
  states: Map<string, OpenTableEntry>;
  onOpen: (context: PosTableContext) => void;
  /** Tastatur abgreifen (nur, solange die Ansicht sichtbar ist). */
  captureKeyboard?: boolean;
}

/**
 * Tischwahl „Nummer eingeben“: Ziffernblock, bei vordefinierten Tischen mit
 * Trefferliste, und der Knopf „Tisch … öffnen“. Gemeinsam für die
 * Startansicht und das Blatt „Tisch wählen“.
 */
export function TableNumberEntry({ mode, areas, states, onOpen, captureKeyboard = true }: TableNumberEntryProps) {
  const t = useTranslations('pos.tables');
  const tOrder = useTranslations('pos.order');
  const [input, setInput] = useState('');
  const predefined = mode === 'predefined';

  const matches = useMemo(() => (predefined ? matchTables(input, areas) : []), [predefined, input, areas]);

  const open = (context: PosTableContext) => {
    setInput('');
    onOpen(context);
  };

  const submit = () => {
    const label = input.trim();
    if (!label) return;
    if (!predefined) {
      open({ kind: 'table', key: toTableKey(label), label });
      return;
    }
    if (matches.length === 1) open(tableContext(matches[0].table));
  };

  const error = predefined && input && matches.length === 0 ? t('noMatch', { input }) : null;
  let buttonLabel = tOrder('enterNumber');
  if (input && !predefined) buttonLabel = tOrder('openTable', { label: input });
  else if (input && matches.length === 1) buttonLabel = tOrder('openTable', { label: matches[0].table.label });
  else if (input && matches.length > 1) buttonLabel = t('pickMatch');
  const canSubmit = !!input && (!predefined || matches.length === 1);

  return (
    <>
      <TableKeypad
        value={input}
        onChange={setInput}
        onSubmit={submit}
        captureKeyboard={captureKeyboard}
        maxLength={predefined ? TABLE_SEARCH_MAX : TABLE_INPUT_MAX}
        error={error}
        enterDisabled={!canSubmit}
      />
      {matches.length > 1 && (
        <div className="pos-matches" role="group" aria-label={t('matchesLabel', { count: matches.length })}>
          {matches.map(({ table, area }) => (
            <TableChip
              key={table.id}
              label={table.label}
              hint={area.name}
              aria-label={t('chipAria', { label: table.label, hint: area.name })}
              state={states.get(toTableKey(table.label))?.state ?? 'free'}
              onClick={() => open(tableContext(table))}
            />
          ))}
        </div>
      )}
      <Button variant="primary" size="lg" block disabled={!canSubmit} onClick={submit}>
        <Icon name="arrow-right" />
        {buttonLabel}
      </Button>
    </>
  );
}
