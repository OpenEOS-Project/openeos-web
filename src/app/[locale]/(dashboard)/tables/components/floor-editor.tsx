'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { FloorPlan, type FloorChange, type FloorDecor, type FloorItemKind, type FloorTable } from '@openeos/ui';

import type { TableArea } from '@/types/table';

export interface FloorSelection {
  id: string;
  kind: FloorItemKind;
}

interface FloorEditorProps {
  area: TableArea;
  mode?: 'edit' | 'view';
  selection: FloorSelection | null;
  snap: boolean;
  showGrid: boolean;
  onSelect: (selection: FloorSelection | null) => void;
  onCommit: (change: FloorChange) => void;
  onDelete: (id: string, kind: FloorItemKind) => void;
  onDuplicate: (id: string, kind: FloorItemKind) => void;
}

/**
 * Karte eines Bereichs. Ziehen, Eckgriff und Tastatur stecken in
 * `FloorPlan` aus @openeos/ui (Pointer Events, auch mit dem Finger);
 * hier kommen nur Daten, Beschriftungen und die Rückmeldungen hinein.
 * `mode="view"` ist die nicht bearbeitbare Vorschau auf dem Telefon.
 */
export function FloorEditor({
  area,
  mode = 'edit',
  selection,
  snap,
  showGrid,
  onSelect,
  onCommit,
  onDelete,
  onDuplicate,
}: FloorEditorProps) {
  const t = useTranslations('tables');

  const tables = useMemo<FloorTable[]>(
    () =>
      area.tables.map((table) => ({
        id: table.id,
        label: table.label,
        shape: table.shape,
        x: table.x,
        y: table.y,
        width: table.width,
        height: table.height,
        rotation: table.rotation,
        seats: table.seats,
        disabled: !table.isActive,
      })),
    [area.tables],
  );

  const decor = useMemo<FloorDecor[]>(
    () =>
      area.decor.map((item) => ({
        ...item,
        label: item.type === 'wall' ? undefined : item.label,
      })),
    [area.decor],
  );

  const tableLabel = (table: FloorTable) => {
    const base = table.seats
      ? t('floor.tableSeats', { label: table.label, seats: table.seats })
      : t('floor.table', { label: table.label });
    return table.disabled ? `${base}, ${t('floor.inactive')}` : base;
  };

  const decorLabel = (item: FloorDecor) => {
    const type = t(`decor.${item.type}`);
    return item.label && item.label !== type ? `${type}: ${item.label}` : type;
  };

  return (
    <FloorPlan
      className="tables-floor"
      aria-label={t('floor.label', { name: area.name })}
      width={area.width}
      height={area.height}
      gridSize={area.gridSize}
      tables={tables}
      decor={decor}
      mode={mode}
      selectedId={mode === 'edit' ? selection?.id ?? null : null}
      snap={snap}
      showGrid={showGrid}
      tableLabel={tableLabel}
      decorLabel={decorLabel}
      minScale={0.5}
      onSelect={(id, kind) => onSelect(id ? { id, kind } : null)}
      onCommit={onCommit}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
    />
  );
}
