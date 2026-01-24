'use client';

import { useTranslations } from 'next-intl';
import { Edit01, Package, Plus, ShoppingBag01, Trash01 } from '@untitledui/icons';

import { Badge } from '@/components/ui/badges/badges';
import { Button } from '@/components/ui/buttons/button';
import { Dropdown } from '@/components/ui/dropdown/dropdown';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { Table, TableCard } from '@/components/ui/table/table';
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

  if (!products || products.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
        <EmptyState
          icon="shopping-bag"
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  const getStatusBadge = (product: Product) => {
    if (!product.isActive) {
      return <Badge color="gray" size="sm">{t('status.inactive')}</Badge>;
    }
    if (!product.isAvailable) {
      return <Badge color="warning" size="sm">{t('status.unavailable')}</Badge>;
    }
    if (product.trackInventory && product.stockQuantity <= 0) {
      return <Badge color="error" size="sm">{t('status.outOfStock')}</Badge>;
    }
    return <Badge color="success" size="sm">{t('status.available')}</Badge>;
  };

  return (
    <TableCard.Root>
      <TableCard.Header
        title={t('title')}
        badge={products.length}
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
          <Table.Head label={t('table.category')} />
          <Table.Head label={t('table.price')} />
          <Table.Head label={t('table.stock')} />
          <Table.Head label={t('table.status')} />
          <Table.Head label={t('table.actions')} />
        </Table.Header>
        <Table.Body items={products}>
          {(product) => (
            <Table.Row key={product.id} id={product.id}>
              <Table.Cell>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="size-10 rounded-lg object-cover"
                      />
                    ) : (
                      <ShoppingBag01 className="size-5 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-primary">{product.name}</p>
                    {product.description && (
                      <p className="text-xs text-tertiary">{product.description}</p>
                    )}
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>
                <span className="text-sm text-tertiary">
                  {product.category?.name || '-'}
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-sm font-medium">{formatPrice(product.price)}</span>
              </Table.Cell>
              <Table.Cell>
                {product.trackInventory ? (
                  <span className="text-sm">
                    {product.stockQuantity} {product.stockUnit}
                  </span>
                ) : (
                  <span className="text-sm text-tertiary">-</span>
                )}
              </Table.Cell>
              <Table.Cell>
                {getStatusBadge(product)}
              </Table.Cell>
              <Table.Cell>
                <Dropdown.Root>
                  <Dropdown.DotsButton />
                  <Dropdown.Popover className="w-min">
                    <Dropdown.Menu>
                      <Dropdown.Item icon={Edit01} onAction={() => onEditClick(product)}>
                        <span className="pr-4">{t('actions.edit')}</span>
                      </Dropdown.Item>
                      {product.trackInventory && (
                        <Dropdown.Item icon={Package} onAction={() => onAdjustStockClick(product)}>
                          <span className="pr-4">{t('actions.adjustStock')}</span>
                        </Dropdown.Item>
                      )}
                      <Dropdown.Separator />
                      <Dropdown.Item
                        icon={Trash01}
                        className="text-error-primary"
                        onAction={() => onDeleteClick(product)}
                      >
                        <span className="pr-4">{t('actions.delete')}</span>
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
