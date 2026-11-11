'use client';

import { useTranslations } from 'next-intl';
import { Building } from 'lucide-react';
import type { DataColumn, RowAction } from '@openeos/ui';

import { useProductionStations } from '@/hooks/use-production-stations';
import type { ProductionStation } from '@/types/production-station';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
import {
  AdminTable,
  CellMain,
  CellNone,
  CellText,
  ListAction,
  ListCount,
  ListHead,
} from '@/components/shared/admin-table';
import '@/styles/admin-table-wave3.css';

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

  if (isLoading) return <ListLoading />;

  if (error) {
    return <ListError message={tCommon('error')} onRetry={() => window.location.reload()} />;
  }

  if (!stations || stations.length === 0) {
    return (
      <ListEmpty
        title={t('empty.title')}
        description={t('empty.description')}
        icon={
          <Building size={28} />
        }
        action={
          <button className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        }
      />
    );
  }

  const stationMap = new Map(stations.map((s) => [s.id, s.name]));

  const columns: DataColumn<ProductionStation>[] = [
    {
      id: 'name',
      header: t('table.name'),
      mobile: 'title',
      cell: (station) => (
        <CellMain
          media={
            <span
              className="stations-list__dot"
              aria-hidden
              style={{ background: station.color || '#9ca3af' }}
            />
          }
          title={station.name}
          titleText={station.name}
          sub={station.description || undefined}
          subText={station.description || undefined}
        />
      ),
    },
    {
      id: 'handoff',
      header: t('table.handoffStation'),
      mobile: 'meta',
      cell: (station) => {
        const handoff = station.handoffStationId
          ? stationMap.get(station.handoffStationId) || null
          : t('form.noHandoff');
        return handoff ? <CellText muted title={handoff}>{handoff}</CellText> : <CellNone />;
      },
    },
    {
      id: 'printer',
      header: t('table.printer'),
      mobile: 'meta',
      priority: 2,
      cell: (station) =>
        station.printer?.name ? (
          <CellText muted title={station.printer.name}>{station.printer.name}</CellText>
        ) : (
          <CellNone />
        ),
    },
    {
      id: 'status',
      header: t('table.status'),
      mobile: 'subtitle',
      cell: (station) => (
        <span className={station.isActive ? 'badge badge--success' : 'badge badge--neutral'}>
          {station.isActive ? t('form.active') : t('list.inactive')}
        </span>
      ),
    },
  ];

  const actions = (station: ProductionStation): RowAction[] => [
    { id: 'edit', label: tCommon('edit'), icon: 'edit', onClick: () => onEditClick(station) },
    { id: 'delete', label: tCommon('delete'), icon: 'trash', danger: true, onClick: () => onDeleteClick(station) },
  ];

  return (
    <div className="app-card app-card--flat">
      {/* Titel und Untertitel standen schon im Seitenkopf darueber; hier
          steht wie bei den Geraeten nur die Anzahl. */}
      <ListHead actions={<ListAction variant="primary" icon="plus" label={t('create')} onClick={onCreateClick} />}>
        <ListCount>{t('count', { count: stations.length })}</ListCount>
      </ListHead>

      <AdminTable
        caption={t('title')}
        rows={stations}
        rowKey="id"
        columns={columns}
        actions={actions}
        rowClassName={(station) => (station.isActive ? undefined : 'admin-dt__row--muted')}
      />
    </div>
  );
}
