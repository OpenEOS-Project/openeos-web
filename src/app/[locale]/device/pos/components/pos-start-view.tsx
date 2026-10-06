'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Button, Icon, Segment, TableChip, type SegmentOption } from '@openeos/ui';
import type { PosStartView as StartViewId } from '@/stores/device-store';
import { toTableKey, type DeviceTableArea, type PosTableContext } from '@/types/table';
import { matchTables, tableContext, type OpenTableEntry } from '../utils/tables';
import { OpenTablesAside } from './open-tables-aside';
import { TableKeypad, TABLE_INPUT_MAX, TABLE_SEARCH_MAX } from './table-keypad';
import { TableList } from './table-list';

interface PosStartViewProps {
  /** Wirksamer Tischbetrieb: frei eingegebene Nummer oder vordefinierte Tische. */
  mode: 'free' | 'predefined';
  /** Bereiche mit aktiven Tischen (Standardbereich zuerst). */
  areas: DeviceTableArea[];
  /** Gemerkte Ansicht des Geräts (nur `predefined`). */
  view: StartViewId;
  onViewChange: (view: StartViewId) => void;
  /** Offene Tische (Server + geparkt), sortiert. */
  openTables: OpenTableEntry[];
  openTablesLoading?: boolean;
  /** Ohne Live-Verbindung: Stand des Tischstatus. */
  staleSince?: number | null;
  onOpen: (context: PosTableContext) => void;
  /** Hinweise über dem Ziffernblock (Testmodus). */
  notices?: ReactNode;
}

/**
 * Startansicht „Tisch öffnen“ im Tischbetrieb (Spezifikation §5.2.1):
 * Nummer (frei oder Suche in den Tischen) bzw. Tischliste je Bereich,
 * „Ohne Tisch“ (Theke, To-go) und rechts „Offene Tische“.
 *
 * Die Ansichten stehen in `views`; die Karte (P5) kommt dort als weitere
 * Option dazu.
 */
export function PosStartView({
  mode,
  areas,
  view,
  onViewChange,
  openTables,
  openTablesLoading,
  staleSince,
  onOpen,
  notices,
}: PosStartViewProps) {
  const t = useTranslations('pos.tables');
  const tOrder = useTranslations('pos.order');
  const [input, setInput] = useState('');

  const tableCount = areas.reduce((sum, area) => sum + area.tables.length, 0);
  const predefined = mode === 'predefined';
  const noTables = predefined && tableCount === 0;

  const views: SegmentOption<StartViewId>[] = predefined
    ? [
        { id: 'number', label: t('viewNumber'), icon: 'grid' },
        { id: 'list', label: t('viewList'), icon: 'list' },
      ]
    : [];
  const active: StartViewId = views.some((v) => v.id === view) ? view : 'number';

  const states = useMemo(() => {
    const map = new Map<string, OpenTableEntry>();
    for (const entry of openTables) if (entry.context.kind === 'table') map.set(entry.context.key, entry);
    return map;
  }, [openTables]);

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

  const withoutTable = (
    <div className="pos-without">
      <span className="oe-label">{t('withoutTable')}</span>
      <div className="pos-without__acts">
        <Button variant="secondary" onClick={() => open({ kind: 'counter' })}>
          <Icon name="beer" />
          {t('counter')}
        </Button>
        <Button variant="secondary" onClick={() => open({ kind: 'togo' })}>
          <Icon name="send" />
          {t('togo')}
        </Button>
      </div>
    </div>
  );

  let main: ReactNode;
  if (noTables) {
    main = (
      <div className="pos-start__pad">
        <Banner tone="warn" icon={<Icon name="alert" />}>
          {t('noTables')}
        </Banner>
        {withoutTable}
      </div>
    );
  } else if (active === 'list') {
    main = (
      <div className="pos-start__list">
        <TableList areas={areas} states={states} onPick={(table) => open(tableContext(table))} />
        {withoutTable}
      </div>
    );
  } else {
    main = (
      <div className="pos-start__pad">
        <TableKeypad
          value={input}
          onChange={setInput}
          onSubmit={submit}
          captureKeyboard
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
        {withoutTable}
      </div>
    );
  }

  return (
    <section className="pos-start" aria-labelledby="pos-start-title">
      <div className="pos-start__main oe-scroll">
        <div className="pos-start__hd">
          <div>
            <h1 id="pos-start-title">{tOrder('startTitle')}</h1>
            <p>{active === 'list' ? t('subtitleList') : tOrder('startSubtitle')}</p>
          </div>
          {views.length > 1 && !noTables && (
            <div className="pos-start__mode">
              <span className="oe-label">{t('viewLabel')}</span>
              <Segment<StartViewId>
                size="lg"
                aria-label={t('viewLabel')}
                options={views}
                value={active}
                onChange={onViewChange}
              />
            </div>
          )}
        </div>
        {notices}
        {main}
      </div>
      <OpenTablesAside
        entries={openTables}
        onOpen={open}
        isLoading={openTablesLoading}
        staleSince={staleSince}
      />
    </section>
  );
}
