'use client';

import { useTranslations } from 'next-intl';
import { Edit01, Plus, Trash01 } from '@untitledui/icons';

import { Badge } from '@/components/ui/badges/badges';
import { Button } from '@/components/ui/buttons/button';
import { Dropdown } from '@/components/ui/dropdown/dropdown';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { Table, TableCard } from '@/components/ui/table/table';
import { useProductionStations } from '@/hooks/use-production-stations';
import type { ProductionStation } from '@/types/production-station';

interface ProductionStationsListProps {
  eventId: string;
  onCreateClick: () => void;
  onEditClick: (station: ProductionStation) => void;
  onDeleteClick: (station: ProductionStation) => void;
}

export function ProductionStationsList({
  eventId,
  onCreateClick,
  onEditClick,
  onDeleteClick,
}: ProductionStationsListProps) {
  const t = useTranslations('productionStations');
  const tCommon = useTranslations('common');

  const { data: stations, isLoading, error } = useProductionStations(eventId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-tertiary">{tCommon('loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="text-error-primary">{tCommon('error')}</div>
        <Button color="secondary" onClick={() => window.location.reload()}>
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  if (!stations || stations.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
        <EmptyState
          icon="building"
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button iconLeading={Plus} onClick={onCreateClick}>
              {t('create')}
            </Button>
          }
        />
      </div>
    );
  }

  // Build a lookup map for handoff station names
  const stationMap = new Map(stations.map((s) => [s.id, s.name]));

  return (
    <TableCard.Root>
      <TableCard.Header
        title={t('title')}
        badge={stations.length}
        description={t('subtitle')}
        contentTrailing={
          <Button iconLeading={Plus} onClick={onCreateClick}>
            {t('create')}
          </Button>
        }
      />
      <Table aria-label={t('title')}>
        <Table.Header>
          <Table.Head label={t('table.name')} isRowHeader />
          <Table.Head label={t('table.handoffStation')} />
          <Table.Head label={t('table.printer')} />
          <Table.Head label={t('table.displayDevice')} />
          <Table.Head label={t('table.status')} />
          <Table.Head label={t('table.actions')} />
        </Table.Header>
        <Table.Body items={stations}>
          {(station) => (
            <Table.Row key={station.id} id={station.id}>
              <Table.Cell>
                <div className="flex items-center gap-3">
                  <div
                    className="size-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor: station.color || '#9ca3af',
                    }}
                  />
                  <div>
                    <p className="text-sm font-medium text-primary">{station.name}</p>
                    {station.description && (
                      <p className="text-xs text-tertiary line-clamp-1">{station.description}</p>
                    )}
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>
                <span className="text-sm text-tertiary">
                  {station.handoffStationId
                    ? stationMap.get(station.handoffStationId) || '-'
                    : t('form.noHandoff')}
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-sm text-tertiary">
                  {station.printer?.name || '-'}
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-sm text-tertiary">
                  {station.displayDevice?.name || '-'}
                </span>
              </Table.Cell>
              <Table.Cell>
                <Badge color={station.isActive ? 'success' : 'gray'} size="sm">
                  {station.isActive ? t('form.active') : 'Inaktiv'}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <Dropdown.Root>
                  <Dropdown.DotsButton />
                  <Dropdown.Popover className="w-min">
                    <Dropdown.Menu>
                      <Dropdown.Item icon={Edit01} onAction={() => onEditClick(station)}>
                        <span className="pr-4">{tCommon('edit')}</span>
                      </Dropdown.Item>
                      <Dropdown.Separator />
                      <Dropdown.Item
                        icon={Trash01}
                        className="text-error-primary"
                        onAction={() => onDeleteClick(station)}
                      >
                        <span className="pr-4">{tCommon('delete')}</span>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown.Root>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
    </TableCard.Root>
  );
}
