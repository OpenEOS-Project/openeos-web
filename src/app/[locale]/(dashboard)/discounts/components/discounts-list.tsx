'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useDiscountVouchers } from '@/hooks/use-discount-vouchers';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
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
      return <span style={{ opacity: 0.6 }}>{t('table.manualAmount')}</span>;
    }
    return formatCurrency(Number(voucher.amount ?? 0));
  };

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          {/* Nur die Anzahl wie bei Produkten und Geraeten — Titel und
              Untertitel stehen schon im Seitenkopf darueber. */}
          <p style={{ fontSize: 13, color: 'var(--ink)', opacity: .6 }}>{t('count', { count: vouchers.length })}</p>
        </div>
        <button className="btn btn--primary" onClick={onCreateClick}>
          {t('create')}
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('table.name')}</th>
              <th>{t('table.type')}</th>
              <th className="text-right">{t('table.amount')}</th>
              <th>{t('table.status')}</th>
              <th style={{ width: 120 }}>{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((voucher) => (
              <tr key={voucher.id}>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{voucher.name}</div>
                  {voucher.description && (
                    <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                      {voucher.description}
                    </div>
                  )}
                </td>
                <td>
                  <span style={{ fontSize: 13, color: 'var(--ink)', opacity: 0.7 }}>
                    {t(`types.${voucher.type}`)}
                  </span>
                </td>
                <td className="mono text-right">{formatAmount(voucher)}</td>
                <td>
                  {voucher.isActive ? (
                    <span className="badge badge--success">{t('status.active')}</span>
                  ) : (
                    <span className="badge badge--neutral">{t('status.inactive')}</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: 6, minWidth: 0 }}
                      onClick={() => onEditClick(voucher)}
                      aria-label={t('actions.edit')}
                      title={t('actions.edit')}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: 6, minWidth: 0, color: 'var(--danger)' }}
                      onClick={() => onDeleteClick(voucher)}
                      aria-label={t('actions.delete')}
                      title={t('actions.delete')}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
