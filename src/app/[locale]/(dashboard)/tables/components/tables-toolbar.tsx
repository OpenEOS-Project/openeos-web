'use client';

import { useTranslations } from 'next-intl';
import { Button, Dropdown, DropdownOption, Icon, Segment, Status, Switch, Toolbar, type FloorTool, type IconName } from '@openeos/ui';

import type { DiningTableShape, TableDecorType, TableZoneType } from '@/types/table';

import type { SaveState } from './use-layout-draft';

export type TablesView = 'map' | 'list';

interface TablesToolbarProps {
  view: TablesView;
  onViewChange: (view: TablesView) => void;
  /** Ab 768 px: Karte bearbeitbar, sonst nur Liste. */
  canEditMap: boolean;
  snap: boolean;
  onSnapChange: (snap: boolean) => void;
  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;
  saveState: SaveState;
  busy?: boolean;
  onAddTable: (shape: DiningTableShape) => void;
  onBulk: () => void;
  onAddDecor: (type: TableDecorType) => void;
  /** Werkzeug der Karte (Auswahl, Wand, Zone, Raumform). */
  tool: FloorTool;
  /** Typ der nächsten Zone (Werkzeug „Zone“). */
  zoneType: TableZoneType;
  onToolChange: (tool: FloorTool, zoneType?: TableZoneType) => void;
}

/* Wände zeichnet man seit 0.6 als Linienzug (Werkzeug „Wand“); bestehende
   Rechteck-Wände bleiben bearbeitbar, werden aber nicht mehr angeboten. */
const DECOR: { type: TableDecorType; icon: IconName }[] = [
  { type: 'bar', icon: 'beer' },
  { type: 'stage', icon: 'stage' },
  { type: 'label', icon: 'text' },
];

export const ZONE_TYPES: { type: TableZoneType; icon: IconName }[] = [
  { type: 'kitchen', icon: 'chef' },
  { type: 'blocked', icon: 'ban' },
  { type: 'bar', icon: 'beer' },
  { type: 'other', icon: 'zone' },
];

/** Werkzeugleiste über Karte bzw. Liste, rechts der Speicherstatus. */
export function TablesToolbar({
  view,
  onViewChange,
  canEditMap,
  snap,
  onSnapChange,
  showGrid,
  onShowGridChange,
  saveState,
  busy,
  onAddTable,
  onBulk,
  onAddDecor,
  tool,
  zoneType,
  onToolChange,
}: TablesToolbarProps) {
  const t = useTranslations('tables.toolbar');
  const tDecor = useTranslations('tables.decor');
  const tZone = useTranslations('tables.zone');
  const tSave = useTranslations('tables.save');
  const mapTools = canEditMap && view === 'map';

  const tone = saveState === 'saved' ? 'live' : saveState === 'error' ? 'danger' : 'warn';

  return (
    <Toolbar className="tables-toolbar">
      <div className="tables-toolbar__group" role="group" aria-label={t('add')}>
        <Button variant="primary" size="sm" onClick={() => onAddTable('rect')} disabled={busy}>
          <Icon name="table" />
          {t('addTable')}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onAddTable('round')} disabled={busy}>
          <Icon name="table-round" />
          {t('addRoundTable')}
        </Button>
        <Button variant="secondary" size="sm" onClick={onBulk} disabled={busy}>
          <Icon name="grid" />
          {t('bulk')}
        </Button>
        {mapTools && (
          <Dropdown
            triggerSize="sm"
            trigger={
              <>
                <Icon name="stage" />
                {t('decor')}
              </>
            }
          >
            {DECOR.map((item) => (
              <DropdownOption key={item.type} icon={<Icon name={item.icon} />} onClick={() => onAddDecor(item.type)}>
                {tDecor(item.type)}
              </DropdownOption>
            ))}
          </Dropdown>
        )}
      </div>

      {mapTools && (
        <div className="tables-toolbar__group" role="group" aria-label={t('draw')}>
          <Button
            variant={tool === 'wall' ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={tool === 'wall'}
            onClick={() => onToolChange(tool === 'wall' ? 'select' : 'wall')}
          >
            <Icon name="wall" />
            {t('wall')}
          </Button>
          <Dropdown
            triggerSize="sm"
            trigger={
              <>
                <Icon name={tool === 'zone' ? (ZONE_TYPES.find((z) => z.type === zoneType)?.icon ?? 'zone') : 'zone'} />
                {tool === 'zone' ? t('zoneActive', { type: tZone(zoneType) }) : t('zone')}
              </>
            }
          >
            {ZONE_TYPES.map((item) => (
              <DropdownOption key={item.type} icon={<Icon name={item.icon} />} onClick={() => onToolChange('zone', item.type)}>
                {tZone(item.type)}
              </DropdownOption>
            ))}
          </Dropdown>
          <Button
            variant={tool === 'outline' ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={tool === 'outline'}
            onClick={() => onToolChange(tool === 'outline' ? 'select' : 'outline')}
          >
            <Icon name="outline" />
            {t('outline')}
          </Button>
        </div>
      )}

      {mapTools && (
        <div className="tables-toolbar__group">
          <Switch checked={showGrid} onChange={(e) => onShowGridChange(e.target.checked)}>
            {t('grid')}
          </Switch>
          <Switch checked={snap} onChange={(e) => onSnapChange(e.target.checked)}>
            {t('snap')}
          </Switch>
        </div>
      )}

      <div className="oe-toolbar__grow" />

      <span className="tables-toolbar__status" aria-live="polite">
        <Status tone={tone}>{tSave(saveState)}</Status>
      </span>

      {canEditMap && (
        <Segment<TablesView>
          aria-label={t('view')}
          value={view}
          onChange={onViewChange}
          options={[
            { id: 'map', label: t('viewMap'), icon: 'map' },
            { id: 'list', label: t('viewList'), icon: 'list' },
          ]}
        />
      )}
    </Toolbar>
  );
}
