'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { FloorPlan, Legend, Tabs, type FloorDecor, type FloorTable } from '@openeos/ui';
import { useFormatPrice } from '@/hooks/use-format-price';
import { toTableKey, type DeviceDiningTable, type DeviceTableArea } from '@/types/table';
import { hasFloorLayout, type OpenTableEntry } from '../utils/tables';

interface TableFloorProps {
  /** Bereiche in Anzeigereihenfolge (Standardbereich zuerst); ohne Tischplan werden sie ausgelassen. */
  areas: DeviceTableArea[];
  /** Offene/wartende Tische nach Tischschlüssel. */
  states: Map<string, OpenTableEntry>;
  /** Aktuell geöffneter Tisch (Tisch-wählen-Blatt): markiert, sein Bereich zuerst. */
  currentKey?: string | null;
  onPick: (table: DeviceDiningTable) => void;
  /** Wartende Tische des Bereichs mit Grund unter der Karte (Blatt ohne „Offene Tische“). */
  showWaiting?: boolean;
}

/** Mindestmaßstab (px je Einheit); darunter scrollt die Karte waagerecht. */
const MIN_SCALE = 0.5;
/**
 * Muss die Karte ohnehin scrollen (Telefon), den Maßstab so weit anheben,
 * dass die kürzeste Tischseite etwa 40 px hat (antippbar), höchstens 0,8.
 */
const MAX_MIN_SCALE = 0.8;
const MIN_TABLE_PX = 40;

/**
 * Restaurant-Ansicht (Spezifikation §5.2.1 „Karte“): Tischplan eines
 * Bereichs wie in der Verwaltung, Tische in den Farben der Chips (frei /
 * offen / wartet) mit Betrag bzw. Wartegrund, Tipp öffnet den Tisch.
 * Mehrere Bereiche mit Tischplan → Reiter darüber. Auf schmalen Geräten
 * scrollt die Karte waagerecht (Mindestmaßstab).
 */
export function TableFloor({ areas, states, currentKey, onPick, showWaiting = false }: TableFloorProps) {
  const t = useTranslations('pos.tables');
  const tf = useTranslations('pos.floor');
  const formatPrice = useFormatPrice();

  const mapAreas = useMemo(() => areas.filter(hasFloorLayout), [areas]);
  const currentArea = currentKey
    ? mapAreas.find((area) => area.tables.some((table) => toTableKey(table.label) === currentKey))
    : undefined;
  const [picked, setPicked] = useState<string | null>(null);
  const area = mapAreas.find((a) => a.id === picked) ?? currentArea ?? mapAreas[0];

  // Verfügbare Breite der Karte (die Hülle scrollt, ihre Breite ist der Platz).
  const wrapRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<number | null>(null);
  useEffect(() => {
    const scroller = wrapRef.current?.querySelector<HTMLElement>('.oe-floor-wrap');
    if (!scroller || typeof ResizeObserver === 'undefined') return;
    const update = () => setAvailable(scroller.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [area?.id]);

  const byId = useMemo(() => new Map(area?.tables.map((table) => [table.id, table]) ?? []), [area]);

  if (!area) return null;

  const reasonText = (entry: OpenTableEntry | undefined) =>
    entry?.waitReason === 'guest' ? tf('reasonGuest') : entry?.waitReason === 'ready' ? tf('reasonReady') : null;

  /** Kurzer Hinweis auf dem Tisch; die Langfassung steht im aria-label. */
  const hintOf = (key: string, entry: OpenTableEntry | undefined) => {
    if (key === currentKey) return { short: t('hintCurrent'), long: t('hintCurrent') };
    if (entry?.state === 'wait') {
      const reason = reasonText(entry);
      const short =
        entry.waitReason === 'guest' ? tf('hintGuest') : entry.waitReason === 'ready' ? tf('hintReady') : t('hintWait');
      return { short, long: reason ? `${t('hintWait')}: ${reason}` : t('hintWait') };
    }
    if (entry) {
      const text = entry.amount > 0 ? formatPrice(entry.amount) : t('hintOpen');
      return { short: text, long: text };
    }
    return { short: null, long: t('hintFree') };
  };

  const ariaLabels = new Map<string, string>();
  const tables: FloorTable[] = area.tables.map((table) => {
    const key = toTableKey(table.label);
    const entry = states.get(key);
    const hint = hintOf(key, entry);
    ariaLabels.set(table.id, t('chipAria', { label: table.label, hint: hint.long }));
    return {
      id: table.id,
      label: table.label,
      shape: table.shape,
      x: table.x,
      y: table.y,
      width: table.width,
      height: table.height,
      rotation: table.rotation,
      seats: table.seats,
      state: entry?.state ?? 'free',
      hint: hint.short ?? undefined,
    };
  });

  const decor: FloorDecor[] = area.decor.map((item) => ({
    ...item,
    label: item.type === 'wall' ? undefined : item.label,
  }));

  const smallest = Math.min(...area.tables.map((table) => Math.min(table.width, table.height)));
  const fits = available === null || available >= area.width * MIN_SCALE;
  const minScale = fits
    ? MIN_SCALE
    : Math.min(MAX_MIN_SCALE, Math.max(MIN_SCALE, MIN_TABLE_PX / Math.max(smallest, 1)));
  const scrolls = !fits;

  const currentId = currentKey ? (area.tables.find((table) => toTableKey(table.label) === currentKey)?.id ?? null) : null;

  const waiting = showWaiting
    ? area.tables
        .map((table) => ({ table, entry: states.get(toTableKey(table.label)) }))
        .filter(({ entry }) => entry?.state === 'wait')
    : [];

  return (
    <div
      className="pos-floor"
      ref={wrapRef}
      style={{ '--pos-floor-ratio': area.width / Math.max(area.height, 1) } as CSSProperties}
    >
      {mapAreas.length > 1 && (
        <Tabs
          className="pos-floor__tabs"
          aria-label={tf('areaTabs')}
          items={mapAreas.map((a) => ({ id: a.id, label: a.name }))}
          active={area.id}
          onChange={setPicked}
        />
      )}
      <FloorPlan
        className="pos-floor__plan"
        aria-label={tf('label', { name: area.name })}
        mode="view"
        width={area.width}
        height={area.height}
        gridSize={area.gridSize}
        tables={tables}
        decor={decor}
        currentId={currentId}
        minScale={minScale}
        tableLabel={(table) => ariaLabels.get(table.id) ?? table.label}
        onTableClick={(id) => {
          const table = byId.get(id);
          if (table) onPick(table);
        }}
      />
      {scrolls && <p className="pos-floor__swipe">{tf('swipeHint')}</p>}
      {waiting.length > 0 && (
        <div className="pos-floor__waits" role="group" aria-label={tf('waitingTitle')}>
          <span className="oe-label">{tf('waitingTitle')}</span>
          <ul>
            {waiting.map(({ table, entry }) => {
              const reason = reasonText(entry) ?? t('hintWait');
              return (
                <li key={table.id}>
                  <button
                    type="button"
                    className="pos-floor__wait"
                    aria-label={t('chipAria', { label: table.label, hint: reason })}
                    onClick={() => onPick(table)}
                  >
                    <span className="oe-tablechip oe-tablechip--wait pos-openrow__chip" aria-hidden>
                      {table.label}
                    </span>
                    <span>{reason}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <Legend
        items={[
          { tone: 'free', label: t('legendFree') },
          { tone: 'busy', label: t('legendBusy') },
          { tone: 'wait', label: t('legendWait') },
        ]}
      />
    </div>
  );
}
