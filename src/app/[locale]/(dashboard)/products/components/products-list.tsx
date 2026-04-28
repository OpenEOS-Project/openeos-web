'use client';

import { useTranslations } from 'next-intl';

import { ProductImage } from '@/components/shared/product-image';
import { useProducts } from '@/hooks/use-products';
import type { Product } from '@/types/product';

interface ProductsListProps {
  eventId: string;
  onCreateClick: () => void;
  onEditClick: (product: Product) => void;
  onDeleteClick: (product: Product) => void;
  onAdjustStockClick: (product: Product) => void;
}

export function ProductsList({
  eventId,
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onAdjustStockClick,
}: ProductsListProps) {
  const t = useTranslations('products');
  const tCommon = useTranslations('common');

  const { data: products, isLoading, error } = useProducts(eventId);

  if (isLoading) {
    return (
      <div className="app-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ color: 'var(--ink)', opacity: 0.5 }}>{tCommon('loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 24px' }}>
        <div style={{ color: '#d24545' }}>{tCommon('error')}</div>
        <button className="btn btn--ghost" onClick={() => window.location.reload()}>
          {tCommon('retry')}
        </button>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="app-card">
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
            </svg>
          </div>
          <h3 className="empty-state__title">{t('empty.title')}</h3>
          <p className="empty-state__sub">{t('empty.description')}</p>
          <button className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        </div>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  const getStatusBadge = (product: Product) => {
    if (!product.isActive) return <span className="badge badge--neutral">{t('status.inactive')}</span>;
    if (!product.isAvailable) return <span className="badge badge--warning">{t('status.unavailable')}</span>;
    if (product.trackInventory && product.stockQuantity <= 0) return <span className="badge badge--error">{t('status.outOfStock')}</span>;
    return <span className="badge badge--success">{t('status.available')}</span>;
  };

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('title')}</h2>
          <p className="app-card__sub">{t('subtitle')}</p>
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
              <th>{t('table.category')}</th>
              <th className="text-right">{t('table.price')}</th>
              <th className="text-right">{t('table.stock')}</th>
              <th>{t('table.status')}</th>
              <th style={{ width: 160 }}>{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ProductImage imageUrl={product.imageUrl} productName={product.name} size="sm" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{product.name}</div>
                      {product.description && (
                        <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                          {product.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: 13, color: 'var(--ink)', opacity: 0.6 }}>
                    {product.category?.name || '-'}
                  </span>
                </td>
                <td className="mono text-right">{formatPrice(product.price)}</td>
                <td className="mono text-right">
                  {product.trackInventory
                    ? `${product.stockQuantity} ${product.stockUnit}`
                    : <span style={{ opacity: 0.4 }}>-</span>
                  }
                </td>
                <td>{getStatusBadge(product)}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <button className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onEditClick(product)}>
                      {t('actions.edit')}
                    </button>
                    {product.trackInventory && (
                      <button className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onAdjustStockClick(product)}>
                        {t('actions.adjustStock')}
                      </button>
                    )}
                    <button className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 12, color: '#d24545' }} onClick={() => onDeleteClick(product)}>
                      {t('actions.delete')}
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
