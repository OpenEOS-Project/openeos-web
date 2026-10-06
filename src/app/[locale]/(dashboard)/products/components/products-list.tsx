'use client';

import { useTranslations } from 'next-intl';
import { Button, Icon } from '@openeos/ui';
import { ShoppingBag } from 'lucide-react';

import { useLocaleFormat } from '@/hooks/use-locale-format';
import { ProductImage } from '@/components/shared/product-image';
import { useProducts, useUpdateProduct } from '@/hooks/use-products';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { toast } from '@/components/shared/toast';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
import type { Product } from '@/types/product';

interface ProductsListProps {
  eventId: string;
  onCreateClick: () => void;
  onImportClick: () => void;
  onManageCategoriesClick: () => void;
  onEditClick: (product: Product) => void;
  onDeleteClick: (product: Product) => void;
  onAdjustStockClick: (product: Product) => void;
}

export function ProductsList({
  eventId,
  onCreateClick,
  onImportClick,
  onManageCategoriesClick,
  onEditClick,
  onDeleteClick,
  onAdjustStockClick,
}: ProductsListProps) {
  const t = useTranslations('products');
  const { formatCurrency } = useLocaleFormat();

  const { data: products, isLoading, error } = useProducts(eventId);
  const updateProduct = useUpdateProduct();
  const apiErrorMessage = useApiErrorMessage();

  /* Favoriten erscheinen an der Kasse in einer eigenen Kategorie ganz
     oben — ein Klick auf den Stern, ohne das Formular zu öffnen. */
  const toggleFavorite = (product: Product) => {
    updateProduct.mutate(
      { eventId, id: product.id, data: { isFavorite: !product.isFavorite } },
      { onError: (err) => toast.error(apiErrorMessage(err)) },
    );
  };

  if (isLoading) {
    return <ListLoading />;
  }

  if (error) {
    return <ListError />;
  }

  if (!products || products.length === 0) {
    return (
      <ListEmpty
        title={t('empty.title')}
        description={t('empty.description')}
        icon={
          <ShoppingBag size={28} />
        }
        action={
          <button className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        }
      />
    );
  }

  const formatPrice = (price: number) => formatCurrency(price);

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
          {/* Titel und Untertitel standen schon im Seitenkopf darueber; hier
              steht wie bei den Geraeten nur die Anzahl. */}
          <p style={{ fontSize: 13, color: 'var(--ink)', opacity: .6 }}>{t('count', { count: products.length })}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost" onClick={onManageCategoriesClick}>
            {t('manageCategories')}
          </button>
          <button className="btn btn--ghost" onClick={onImportClick}>
            {t('import.trigger')}
          </button>
          <button className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 44 }}>
                <span className="oe-sr-only">{t('favorite')}</span>
              </th>
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
                  <Button
                    variant="quiet"
                    size="sm"
                    iconOnly
                    style={product.isFavorite ? { color: 'var(--oe-warn)' } : undefined}
                    aria-pressed={!!product.isFavorite}
                    aria-label={t(product.isFavorite ? 'favoriteRemove' : 'favoriteAdd', { name: product.name })}
                    title={t(product.isFavorite ? 'favoriteRemove' : 'favoriteAdd', { name: product.name })}
                    onClick={() => toggleFavorite(product)}
                    disabled={updateProduct.isPending && updateProduct.variables?.id === product.id}
                  >
                    <Icon name="star" filled={!!product.isFavorite} />
                  </Button>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ProductImage product={product} productName={product.name} size="sm" />
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: 6, minWidth: 0 }}
                      onClick={() => onEditClick(product)}
                      aria-label={t('actions.edit')}
                      title={t('actions.edit')}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    {product.trackInventory && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ padding: 6, minWidth: 0 }}
                        onClick={() => onAdjustStockClick(product)}
                        aria-label={t('actions.adjustStock')}
                        title={t('actions.adjustStock')}
                      >
                        <Icon name="sliders" size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: 6, minWidth: 0, color: 'var(--danger)' }}
                      onClick={() => onDeleteClick(product)}
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
