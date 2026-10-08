'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Icon, IconBox, Input, Segment, Select, Switch, rotateBy, type FloorTool } from '@openeos/ui';

import type {
  DiningTable,
  DiningTableShape,
  TableArea,
  TableDecor,
  TableWallLine,
  TableZone,
  TableZoneType,
  UpdateDiningTableData,
} from '@/types/table';
import { isRectDecor, isWallLine, isZone } from '@/types/table';

import type { FloorSelection } from './floor-editor';
import type { LayoutFields } from './use-layout-draft';
import { LABEL_MAX, SEATS_MAX, TABLE_SIZE_MAX, TABLE_SIZE_MIN, parseIntOrNull } from './table-utils';

interface TableInspectorProps {
  areas: TableArea[];
  area: TableArea;
  selection: FloorSelection | null;
  onLayout: (tableId: string, fields: Partial<LayoutFields>) => void;
  onUpdate: (table: DiningTable, data: UpdateDiningTableData) => void;
  /** Felder eines Deko-Elements, einer Wand oder Zone. */
  onDecor: (decorId: string, fields: Record<string, unknown>) => void;
  onDuplicate: (id: string, kind: FloorSelection['kind']) => void;
  onDelete: (id: string, kind: FloorSelection['kind']) => void;
  onClose: () => void;
  /** Werkzeug der Karte; bei „Raumform“ zeigt der Inspektor die Raumform. */
  tool?: FloorTool;
  onResetOutline?: () => void;
  /** Werkzeug beenden (zurück zur Auswahl). */
  onToolDone?: () => void;
}

const ZONE_TYPE_IDS: TableZoneType[] = ['kitchen', 'blocked', 'bar', 'other'];
const ZONE_ICONS = { kitchen: 'chef', blocked: 'ban', bar: 'beer', other: 'zone' } as const;
const WALL_THICKNESS_MIN = 2;
const WALL_THICKNESS_MAX = 100;
const WALL_THICKNESS_DEFAULT = 10;

/**
 * Eigenschaften des gewählten Tisches bzw. Deko-Elements. Lage und Größe
 * gehen über den Autosave der Karte, Stammfelder (Bezeichnung, Plätze,
 * Bereich, Aktiv) per PATCH beim Verlassen des Feldes.
 */
export function TableInspector(props: TableInspectorProps) {
  const t = useTranslations('tables.inspector');
  const { area, selection } = props;

  const table = selection?.kind === 'table' ? area.tables.find((x) => x.id === selection.id) : undefined;
  const element = selection && selection.kind !== 'table' ? area.decor.find((x) => x.id === selection.id) : undefined;
  const decor = element && isRectDecor(element) ? element : undefined;
  const wall = element && isWallLine(element) ? element : undefined;
  const zone = element && isZone(element) ? element : undefined;

  if (props.tool === 'outline') {
    return (
      <aside className="oe-card tables-inspector" aria-label={t('region')}>
        <OutlineFields {...props} />
      </aside>
    );
  }

  if (wall || zone) {
    return (
      <aside className="oe-card tables-inspector" aria-label={t('region')}>
        {wall ? (
          <WallFields key={`${wall.id}:${wall.thickness ?? ''}`} wall={wall} {...props} />
        ) : (
          <ZoneFields key={`${zone!.id}:${zone!.label ?? ''}:${zone!.zoneType}`} zone={zone!} {...props} />
        )}
      </aside>
    );
  }

  if (!table && !decor) {
    return (
      <aside className="oe-card tables-inspector" aria-label={t('region')}>
        <div className="tables-inspector__empty">
          <IconBox icon="table" tone="accent" />
          <p>{t('empty')}</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="oe-card tables-inspector" aria-label={t('region')}>
      {table ? (
        <TableFields key={`${table.id}:${table.label}:${table.seats}:${table.width}:${table.height}`} table={table} {...props} />
      ) : (
        <DecorFields key={`${decor!.id}:${decor!.label}:${decor!.width}:${decor!.height}`} decor={decor!} {...props} />
      )}
    </aside>
  );
}

/** Enter übernimmt den Wert wie das Verlassen des Feldes. */
const blurOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.currentTarget.blur();
  }
};

function clampSize(value: number | null, fallback: number, max: number) {
  if (value === null) return fallback;
  return Math.min(Math.max(value, TABLE_SIZE_MIN), Math.min(TABLE_SIZE_MAX, max));
}

function RotationControls({ rotation, onRotate }: { rotation: number; onRotate: (delta: number) => void }) {
  const t = useTranslations('tables.inspector');
  const id = useId();
  return (
    <div className="oe-field">
      <span className="tables-inspector__label" id={id}>
        {t('rotation')} <span className="tables-mono">{t('degrees', { value: rotation })}</span>
      </span>
      <div className="tables-inspector__row" role="group" aria-labelledby={id}>
        <Button variant="ghost" size="sm" onClick={() => onRotate(-15)} aria-label={t('rotateLeft')}>
          {t('rotateLeftShort')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onRotate(15)} aria-label={t('rotateRight')}>
          {t('rotateRightShort')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onRotate(90)} aria-label={t('rotate90')}>
          <Icon name="rotate" />
          {t('rotate90Short')}
        </Button>
      </div>
    </div>
  );
}

function SizeFields({
  width,
  height,
  area,
  onChange,
}: {
  width: number;
  height: number;
  area: TableArea;
  onChange: (fields: { width: number; height: number }) => void;
}) {
  const t = useTranslations('tables.inspector');
  const [w, setW] = useState(String(width));
  const [h, setH] = useState(String(height));
  const commit = () => {
    const next = {
      width: clampSize(parseIntOrNull(w), width, area.width),
      height: clampSize(parseIntOrNull(h), height, area.height),
    };
    setW(String(next.width));
    setH(String(next.height));
    if (next.width !== width || next.height !== height) onChange(next);
  };
  return (
    <div className="tables-grid-2">
      <Input
        label={t('width')}
        type="number"
        inputMode="numeric"
        min={TABLE_SIZE_MIN}
        max={TABLE_SIZE_MAX}
        value={w}
        onChange={(e) => setW(e.target.value)}
        onBlur={commit}
        onKeyDown={blurOnEnter}
      />
      <Input
        label={t('height')}
        type="number"
        inputMode="numeric"
        min={TABLE_SIZE_MIN}
        max={TABLE_SIZE_MAX}
        value={h}
        onChange={(e) => setH(e.target.value)}
        onBlur={commit}
        onKeyDown={blurOnEnter}
      />
    </div>
  );
}

function TableFields({
  table,
  areas,
  area,
  onLayout,
  onUpdate,
  onDuplicate,
  onDelete,
  onClose,
}: TableInspectorProps & { table: DiningTable }) {
  const t = useTranslations('tables.inspector');
  const tShape = useTranslations('tables.shape');
  const [label, setLabel] = useState(table.label);
  const [seats, setSeats] = useState(table.seats ? String(table.seats) : '');
  const [labelError, setLabelError] = useState<string | undefined>();
  const [seatsError, setSeatsError] = useState<string | undefined>();

  const commitLabel = () => {
    const next = label.trim();
    if (!next || next.length > LABEL_MAX) {
      setLabelError(t('labelInvalid', { max: LABEL_MAX }));
      return;
    }
    setLabelError(undefined);
    if (next !== table.label) onUpdate(table, { label: next });
  };

  const commitSeats = () => {
    const raw = seats.trim();
    const value = raw ? parseIntOrNull(raw) : null;
    if (raw && (value === null || value < 1 || value > SEATS_MAX)) {
      setSeatsError(t('seatsInvalid', { max: SEATS_MAX }));
      return;
    }
    setSeatsError(undefined);
    if (value !== table.seats) onUpdate(table, { seats: value });
  };

  return (
    <>
      <div className="tables-inspector__head">
        <IconBox icon={table.shape === 'round' ? 'table-round' : 'table'} tone="accent" size="sm" />
        <h2 className="tables-inspector__title">{t('title', { label: table.label })}</h2>
        <Button variant="quiet" size="sm" iconOnly onClick={onClose} aria-label={t('close')}>
          <Icon name="x" />
        </Button>
      </div>
      <div className="tables-inspector__body">
        <Input
          label={t('label')}
          value={label}
          maxLength={LABEL_MAX}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={blurOnEnter}
          error={labelError}
          autoComplete="off"
        />
        <Input
          label={t('seats')}
          type="number"
          inputMode="numeric"
          min={1}
          max={SEATS_MAX}
          placeholder={t('seatsPlaceholder')}
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
          onBlur={commitSeats}
          onKeyDown={blurOnEnter}
          error={seatsError}
        />
        <div className="oe-field">
          <span className="tables-inspector__label" aria-hidden="true">
            {t('shape')}
          </span>
          <Segment<DiningTableShape>
            aria-label={t('shape')}
            value={table.shape}
            onChange={(shape) => onLayout(table.id, { shape })}
            options={[
              { id: 'rect', label: tShape('rect'), icon: 'table' },
              { id: 'round', label: tShape('round'), icon: 'table-round' },
            ]}
          />
        </div>
        <SizeFields
          width={table.width}
          height={table.height}
          area={area}
          onChange={(fields) => onLayout(table.id, fields)}
        />
        <RotationControls
          rotation={table.rotation}
          onRotate={(delta) => onLayout(table.id, { rotation: rotateBy(table.rotation, delta) })}
        />
        <Select
          label={t('area')}
          hint={t('areaHint')}
          value={table.areaId}
          onChange={(e) => onUpdate(table, { areaId: e.target.value })}
        >
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <div className="tables-inspector__switch">
          <Switch checked={table.isActive} onChange={(e) => onUpdate(table, { isActive: e.target.checked })}>
            {t('active')}
          </Switch>
          <p className="tables-muted">{t('activeHint')}</p>
        </div>
      </div>
      <div className="tables-inspector__foot">
        <Button variant="ghost" size="sm" onClick={() => onDuplicate(table.id, 'table')}>
          <Icon name="copy" />
          {t('duplicate')}
        </Button>
        <Button variant="danger-quiet" size="sm" onClick={() => onDelete(table.id, 'table')}>
          <Icon name="trash" />
          {t('delete')}
        </Button>
      </div>
    </>
  );
}

function DecorFields({
  decor,
  area,
  onDecor,
  onDuplicate,
  onDelete,
  onClose,
}: TableInspectorProps & { decor: TableDecor }) {
  const t = useTranslations('tables.inspector');
  const tDecor = useTranslations('tables.decor');
  const [text, setText] = useState(decor.label ?? '');
  const hasText = decor.type !== 'wall';
  const icon = decor.type === 'stage' ? 'stage' : decor.type === 'wall' ? 'wall' : decor.type === 'label' ? 'text' : 'beer';

  const commitText = () => {
    const next = text.trim();
    if (next !== (decor.label ?? '')) onDecor(decor.id, { label: next || undefined });
  };

  return (
    <>
      <div className="tables-inspector__head">
        <IconBox icon={icon} size="sm" />
        <h2 className="tables-inspector__title">{tDecor(decor.type)}</h2>
        <Button variant="quiet" size="sm" iconOnly onClick={onClose} aria-label={t('close')}>
          <Icon name="x" />
        </Button>
      </div>
      <div className="tables-inspector__body">
        {hasText && (
          <Input
            label={t('text')}
            value={text}
            maxLength={60}
            placeholder={tDecor(decor.type)}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            onKeyDown={blurOnEnter}
          />
        )}
        <SizeFields
          width={decor.width}
          height={decor.height}
          area={area}
          onChange={(fields) => onDecor(decor.id, fields)}
        />
        <RotationControls
          rotation={decor.rotation}
          onRotate={(delta) => onDecor(decor.id, { rotation: rotateBy(decor.rotation, delta) })}
        />
      </div>
      <div className="tables-inspector__foot">
        <Button variant="ghost" size="sm" onClick={() => onDuplicate(decor.id, 'decor')}>
          <Icon name="copy" />
          {t('duplicate')}
        </Button>
        <Button variant="danger-quiet" size="sm" onClick={() => onDelete(decor.id, 'decor')}>
          <Icon name="trash" />
          {t('delete')}
        </Button>
      </div>
    </>
  );
}

function ShapeFoot({
  id,
  kind,
  onDuplicate,
  onDelete,
}: Pick<TableInspectorProps, 'onDuplicate' | 'onDelete'> & { id: string; kind: 'wall' | 'zone' }) {
  const t = useTranslations('tables.inspector');
  return (
    <div className="tables-inspector__foot">
      <Button variant="ghost" size="sm" onClick={() => onDuplicate(id, kind)}>
        <Icon name="copy" />
        {t('duplicate')}
      </Button>
      <Button variant="danger-quiet" size="sm" onClick={() => onDelete(id, kind)}>
        <Icon name="trash" />
        {t('delete')}
      </Button>
    </div>
  );
}

/** Wand als Linienzug: Stärke; Punkte direkt auf der Karte. */
function WallFields({ wall, onDecor, onDuplicate, onDelete, onClose }: TableInspectorProps & { wall: TableWallLine }) {
  const t = useTranslations('tables.inspector');
  const tShapes = useTranslations('tables.shapes');
  const current = wall.thickness ?? WALL_THICKNESS_DEFAULT;
  const [value, setValue] = useState(String(current));
  const [error, setError] = useState<string | undefined>();

  const commit = () => {
    const next = parseIntOrNull(value);
    if (next === null || next < WALL_THICKNESS_MIN || next > WALL_THICKNESS_MAX) {
      setError(t('thicknessInvalid', { min: WALL_THICKNESS_MIN, max: WALL_THICKNESS_MAX }));
      return;
    }
    setError(undefined);
    if (next !== current) onDecor(wall.id, { thickness: next });
  };

  return (
    <>
      <div className="tables-inspector__head">
        <IconBox icon="wall" size="sm" />
        <h2 className="tables-inspector__title">{tShapes('wall')}</h2>
        <Button variant="quiet" size="sm" iconOnly onClick={onClose} aria-label={t('close')}>
          <Icon name="x" />
        </Button>
      </div>
      <div className="tables-inspector__body">
        <Input
          label={t('thickness')}
          hint={t('thicknessHint')}
          type="number"
          inputMode="numeric"
          min={WALL_THICKNESS_MIN}
          max={WALL_THICKNESS_MAX}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={blurOnEnter}
          error={error}
        />
        <p className="tables-muted">
          {t('points', { count: wall.points.length })} {t('pointsHint')}
        </p>
      </div>
      <ShapeFoot id={wall.id} kind="wall" onDuplicate={onDuplicate} onDelete={onDelete} />
    </>
  );
}

/** Zone: Typ und Beschriftung; Punkte direkt auf der Karte. */
function ZoneFields({ zone, onDecor, onDuplicate, onDelete, onClose }: TableInspectorProps & { zone: TableZone }) {
  const t = useTranslations('tables.inspector');
  const tZone = useTranslations('tables.zone');
  const [text, setText] = useState(zone.label ?? '');

  const commitText = () => {
    const next = text.trim();
    if (next !== (zone.label ?? '')) onDecor(zone.id, { label: next || undefined });
  };

  return (
    <>
      <div className="tables-inspector__head">
        <IconBox icon={ZONE_ICONS[zone.zoneType]} size="sm" />
        <h2 className="tables-inspector__title">{zone.label || tZone(zone.zoneType)}</h2>
        <Button variant="quiet" size="sm" iconOnly onClick={onClose} aria-label={t('close')}>
          <Icon name="x" />
        </Button>
      </div>
      <div className="tables-inspector__body">
        <Select
          label={t('zoneType')}
          hint={zone.zoneType === 'blocked' ? t('zoneBlockedHint') : t('zoneHint')}
          value={zone.zoneType}
          onChange={(e) => onDecor(zone.id, { zoneType: e.target.value as TableZoneType })}
        >
          {ZONE_TYPE_IDS.map((type) => (
            <option key={type} value={type}>
              {tZone(type)}
            </option>
          ))}
        </Select>
        <Input
          label={t('zoneLabel')}
          value={text}
          maxLength={60}
          placeholder={tZone(zone.zoneType)}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={blurOnEnter}
        />
        <p className="tables-muted">
          {t('points', { count: zone.points.length })} {t('pointsHint')}
        </p>
      </div>
      <ShapeFoot id={zone.id} kind="zone" onDuplicate={onDuplicate} onDelete={onDelete} />
    </>
  );
}

/** Raumform: Hinweise, Anzahl der Ecken, Zurücksetzen. */
function OutlineFields({ area, onResetOutline, onToolDone }: TableInspectorProps) {
  const t = useTranslations('tables.inspector');
  const custom = !!area.outline && area.outline.length >= 3;
  return (
    <>
      <div className="tables-inspector__head">
        <IconBox icon="outline" tone="accent" size="sm" />
        <h2 className="tables-inspector__title">{t('outlineTitle')}</h2>
      </div>
      <div className="tables-inspector__body">
        <p className="tables-muted">{t('outlineText')}</p>
        <p className="tables-muted">
          {custom ? t('points', { count: area.outline!.length }) : t('outlineRect')}
        </p>
      </div>
      <div className="tables-inspector__foot">
        <Button variant="ghost" size="sm" disabled={!custom} onClick={onResetOutline}>
          <Icon name="undo" />
          {t('outlineReset')}
        </Button>
        <Button variant="primary" size="sm" onClick={onToolDone}>
          <Icon name="check" />
          {t('outlineDone')}
        </Button>
      </div>
    </>
  );
}
