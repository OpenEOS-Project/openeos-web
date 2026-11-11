'use client';

import { useTranslations } from 'next-intl';
import { Icon, type DataColumn, type RowAction } from '@openeos/ui';

import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useDiscountVouchers } from '@/hooks/use-discount-vouchers';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
import {
  AdminTable,
  CellMain,
  CellText,
  ListAction,
  ListCount,
  ListHead,
} from '@/components/shared/admin-table';
import type { DiscountVoucher } from '@/types/discount-voucher';

interface DiscountsListProps {
  organizationId: string;
  onCreateClick: () => void;
  onEditClick: (voucher: DiscountVoucher) => void;
  onDeleteClick: (voucher: DiscountVoucher) => void;
}

export function DiscountsList({
  organizationId,
  onCreateClick,
  onEditClick,
  onDeleteClick,
}: DiscountsListProps) {
  const t = useTranslations('discounts');
  const { formatCurrency } = useLocaleFormat();

  const { data: vouchers, isLoading, error } = useDiscountVouchers(organizationId);

  if (isLoading) {
    return <ListLoading />;
  }

  if (error) {
    return <ListError />;
  }

  if (!vouchers || vouchers.length === 0) {
    return (
      <ListEmpty
        title={t('empty.title')}
        description={t('empty.description')}
        icon={
          <Icon name="tag" size={28} />
        }
        action={
          <button className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        }
      />
    );
  }

  const formatAmount = (voucher: DiscountVoucher) => {
    if (voucher.type === 'manual') {
      return <span className="admin-cell-text--muted">{t('table.manualAmount')}</span>;
    }
    return formatCurrency(Number(voucher.amount ?? 0));
  };

  const columns: DataColumn<DiscountVoucher>[] = [
    {
      id: 'name',
      header: t('table.name'),
      mobile: 'title',
      cell: (voucher) => (
        <CellMain
          title={voucher.name}
          titleText={voucher.name}
          sub={voucher.description || undefined}
          subText={voucher.description || undefined}
        />
      ),
    },
    {
      id: 'type',
      header: t('table.type'),
      mobile: 'meta',
      cell: (voucher) => (
        <CellText muted title={t(`types.${voucher.type}`)}>
          {t(`types.${voucher.type}`)}
        </CellText>
      ),
    },
    {
      id: 'amount',
      header: t('table.amount'),
      num: true,
      mobile: 'trailing',
      cell: (voucher) => formatAmount(voucher),
    },
    {
      id: 'status',
      header: t('table.status'),
      mobile: 'subtitle',
      cell: (voucher) =>
        voucher.isActive ? (
          <span className="badge badge--success">{t('status.active')}</span>
        ) : (
          <span className="badge badge--neutral">{t('status.inactive')}</span>
        ),
    },
  ];

  const actions = (voucher: DiscountVoucher): RowAction[] => [
    { id: 'edit', label: t('actions.edit'), icon: 'edit', onClick: () => onEditClick(voucher) },
    { id: 'delete', label: t('actions.delete'), icon: 'trash', danger: true, onClick: () => onDeleteClick(voucher) },
  ];

  return (
    <div className="app-card app-card--flat">
      {/* Nur die Anzahl wie bei Produkten und Geraeten — Titel und
          Untertitel stehen schon im Seitenkopf darueber. */}
      <ListHead actions={<ListAction variant="primary" icon="plus" label={t('create')} onClick={onCreateClick} />}>
        <ListCount>{t('count', { count: vouchers.length })}</ListCount>
      </ListHead>

      <AdminTable
        caption={t('title')}
        rows={vouchers}
        rowKey="id"
        columns={columns}
        actions={actions}
        rowClassName={(voucher) => (voucher.isActive ? undefined : 'admin-dt__row--muted')}
      />
    </div>
  );
}
