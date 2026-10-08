'use client';

import { useMemo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Button, Icon } from '@openeos/ui';
import type { DeviceTableArea, PosTableContext } from '@/types/table';
import { tableContext, type OpenTableEntry, type TableSelectView } from '../utils/tables';
import { OpenTablesAside } from './open-tables-aside';
import { TableFloor } from './table-floor';
import { TableList } from './table-list';
import { TableNumberEntry } from './table-number-entry';

interface PosStartViewProps {
  /** Wirksamer Tischbetrieb: frei eingegebene Nummer oder vordefinierte Tische. */
  mode: 'free' | 'predefined';
  /** Bereiche mit aktiven Tischen (Standardbereich zuerst). */
  areas: DeviceTableArea[];
  /**
   * Tischwahl des Geräts (Verwaltung → Gerät → Einstellungen, siehe
   * `resolveTableSelectView`); kein Umschalter an der Kasse.
   */
  view: TableSelectView;
  /** Offene Tische (Server + geparkt), sortiert. */
  openTables: OpenTableEntry[];
  openTablesLoading?: boolean;
  /** Ohne Live-Verbindung: Stand des Tischstatus. */
  staleSince?: number | null;
  onOpen: (context: PosTableContext) => void;
}

/**
 * Startansicht „Tisch öffnen“ im Tischbetrieb (Spezifikation §5.2.1): genau
 * die Tischwahl, die für das Gerät eingestellt ist — Nummer (frei oder
 * Suche in den Tischen), Tischliste je Bereich oder Karte —, dazu „Ohne
 * Tisch“ (Theke, To-go) und rechts „Offene Tische“.
 */
export function PosStartView({ mode, areas, view, openTables, openTablesLoading, staleSince, onOpen }: PosStartViewProps) {
  const t = useTranslations('pos.tables');
  const tOrder = useTranslations('pos.order');
  const tFloor = useTranslations('pos.floor');

  const tableCount = areas.reduce((sum, area) => sum + area.tables.length, 0);
  const predefined = mode === 'predefined';
  const noTables = predefined && tableCount === 0;
  const active: TableSelectView = predefined ? view : 'number';

  const states = useMemo(() => {
    const map = new Map<string, OpenTableEntry>();
    for (const entry of openTables) if (entry.context.kind === 'table') map.set(entry.context.key, entry);
    return map;
  }, [openTables]);

  const open = (context: PosTableContext) => onOpen(context);

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
  } else if (active === 'map') {
    main = (
      <div className="pos-start__list">
        <TableFloor areas={areas} states={states} onPick={(table) => open(tableContext(table))} />
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
        <TableNumberEntry mode={mode} areas={areas} states={states} onOpen={open} />
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
            <p>
              {active === 'list'
                ? t('subtitleList')
                : active === 'map'
                  ? tFloor('subtitle')
                  : tOrder('startSubtitle')}
            </p>
          </div>
        </div>
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
