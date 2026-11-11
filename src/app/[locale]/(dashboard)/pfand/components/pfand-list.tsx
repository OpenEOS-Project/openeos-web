'use client';

import { useTranslations } from 'next-intl';
import { Icon, type DataColumn, type RowAction } from '@openeos/ui';

import { useLocaleFormat } from '@/hooks/use-locale-format';
import { usePfandTypes } from '@/hooks/use-pfand-types';
import { useOrganization } from '@/hooks/use-organizations';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
import { AdminTable, CellMain, ListAction, ListCount, ListHead } from '@/components/shared/admin-table';
import type { PfandType } from '@/types/pfand';

interface PfandListProps {
  organizationId: string;
  onCreateClick: () => void;
  onSettingsClick: () => void;
  onEditClick: (type: PfandType) => void;
  onDeleteClick: (type: PfandType) => void;
}

export function PfandList({ organizationId, onCreateClick, onSettingsClick, onEditClick, onDeleteClick }: PfandListProps) {
  const t = useTranslations('pfand');
  const { formatCurrency } = useLocaleFormat();

  const { data: types, isLoading, error } = usePfandTypes(organizationId);
  // Ohne Umsatzsteuer (Kleinunternehmer) wirkt der Satz nicht: „–“.
  const { data: organization } = useOrganization(organizationId);
  const vatExempt = organization?.settings?.vatExempt !== false;

  if (isLoading) {
    return <ListLoading />;
  }

  if (error) {
    return <ListError />;
  }

  if (!types || types.length === 0) {
    return (
      <ListEmpty
        title={t('empty.title')}
        description={t('empty.description')}
        icon={
          <Icon name="deposit" size={28} />
        }
        action={
          <button className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        }
      />
    );
  }

  const formatAmount = (amount: number) => formatCurrency(Number(amount));

  const columns: DataColumn<PfandType>[] = [
    {
      id: 'name',
      header: t('table.name'),
      mobile: 'title',
      cell: (type) => <CellMain title={type.name} titleText={type.name} />,
    },
    {
      id: 'amount',
      header: t('table.amount'),
      num: true,
      mobile: 'trailing',
      cell: (type) => formatAmount(type.amount),
    },
    {
      id: 'vatRate',
      header: t('table.vatRate'),
      num: true,
      mobile: 'meta',
      cell: (type) => (vatExempt ? '–' : `${Number(type.vatRate ?? 19)} %`),
    },
    {
      id: 'status',
      header: t('table.status'),
      mobile: 'subtitle',
      cell: (type) =>
        type.isActive ? (
          <span className="badge badge--success">{t('status.active')}</span>
        ) : (
          <span className="badge badge--neutral">{t('status.inactive')}</span>
        ),
    },
  ];

  const actions = (type: PfandType): RowAction[] => [
    { id: 'edit', label: t('actions.edit'), icon: 'edit', onClick: () => onEditClick(type) },
    { id: 'delete', label: t('actions.delete'), icon: 'trash', danger: true, onClick: () => onDeleteClick(type) },
  ];

  return (
    <div className="app-card app-card--flat">
      {/* Nur die Anzahl wie bei Produkten und Geraeten — Titel und
          Untertitel stehen schon im Seitenkopf darueber. */}
      <ListHead
        actions={
          <>
            <ListAction icon="sliders" label={t('settings.trigger')} onClick={onSettingsClick} />
            <ListAction variant="primary" icon="plus" label={t('create')} onClick={onCreateClick} />
          </>
        }
      >
        <ListCount>{t('count', { count: types.length })}</ListCount>
      </ListHead>

      <AdminTable
        caption={t('title')}
        rows={types}
        rowKey="id"
        columns={columns}
        actions={actions}
        rowClassName={(type) => (type.isActive ? undefined : 'admin-dt__row--muted')}
      />
    </div>
  );
}
