'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  FloorPlan,
  type FloorChange,
  type FloorDecor,
  type FloorItemKind,
  type FloorPlanLabels,
  type FloorPoint,
  type FloorShapeChange,
  type FloorShapeDraft,
  type FloorTable,
  type FloorTool,
  type FloorWall,
  type FloorZone,
} from '@openeos/ui';

import { splitAreaDecor, type TableArea } from '@/types/table';

export interface FloorSelection {
  id: string;
  kind: FloorItemKind;
}

interface FloorEditorProps {
  area: TableArea;
  mode?: 'edit' | 'view';
  /** Werkzeug: Auswahl, Wand zeichnen, Zone zeichnen, Raumform. */
  tool?: FloorTool;
  selection: FloorSelection | null;
  snap: boolean;
  showGrid: boolean;
  onSelect: (selection: FloorSelection | null) => void;
  onCommit: (change: FloorChange) => void;
  onDelete: (id: string, kind: FloorItemKind) => void;
  onDuplicate: (id: string, kind: FloorItemKind) => void;
  onShapeCreate?: (shape: FloorShapeDraft) => void;
  onShapeCommit?: (change: FloorShapeChange) => void;
  onOutlineCommit?: (points: FloorPoint[]) => void;
  onToolCancel?: () => void;
}

/**
 * Karte eines Bereichs. Ziehen, Eckgriff, Zeichnen und Tastatur stecken in
 * `FloorPlan` aus @openeos/ui (Pointer Events, auch mit dem Finger); hier
 * kommen nur Daten, Beschriftungen und die Rückmeldungen hinein.
 * `decor` der API wird in Rechtecke, Wände (Linienzug) und Zonen geteilt.
 * `mode="view"` ist die nicht bearbeitbare Vorschau auf dem Telefon.
 */
export function FloorEditor({
  area,
  mode = 'edit',
  tool = 'select',
  selection,
  snap,
  showGrid,
  onSelect,
  onCommit,
  onDelete,
  onDuplicate,
  onShapeCreate,
  onShapeCommit,
  onOutlineCommit,
  onToolCancel,
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

  const { decor, walls, zones } = useMemo(() => {
    const parts = splitAreaDecor(area.decor);
    return {
      decor: parts.rects.map<FloorDecor>((item) => ({
        ...item,
        label: item.type === 'wall' ? undefined : item.label,
      })),
      walls: parts.walls.map<FloorWall>((w) => ({ id: w.id, points: w.points, thickness: w.thickness })),
      zones: parts.zones.map<FloorZone>((z) => ({ id: z.id, zoneType: z.zoneType, points: z.points, label: z.label })),
    };
  }, [area.decor]);

  const labels = useMemo<Partial<FloorPlanLabels>>(
    () => ({
      zoneTypes: {
        kitchen: t('zone.kitchen'),
        blocked: t('zone.blockedShort'),
        bar: t('zone.bar'),
        other: t('zone.other'),
      },
      wall: t('shapes.wall'),
      outline: t('shapes.outline'),
      point: t('floorTools.point'),
      addPoint: t('floorTools.addPoint'),
      drawWall: t('floorTools.drawWall'),
      drawZone: t('floorTools.drawZone'),
      editOutline: t('floorTools.editOutline'),
      done: t('floorTools.done'),
      cancel: t('floorTools.cancel'),
      undoPoint: t('floorTools.undoPoint'),
      outside: t('floorTools.outside'),
      blocked: t('floorTools.blocked'),
    }),
    [t],
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
      walls={walls}
      zones={zones}
      outline={area.outline}
      mode={mode}
      tool={mode === 'edit' ? tool : 'select'}
      selectedId={mode === 'edit' ? (selection?.id ?? null) : null}
      snap={snap}
      showGrid={showGrid}
      tableLabel={tableLabel}
      decorLabel={decorLabel}
      labels={labels}
      minScale={0.5}
      onSelect={(id, kind) => onSelect(id ? { id, kind } : null)}
      onCommit={onCommit}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
      onShapeCreate={onShapeCreate}
      onShapeCommit={onShapeCommit}
      onOutlineCommit={onOutlineCommit}
      onToolCancel={onToolCancel}
    />
  );
}
