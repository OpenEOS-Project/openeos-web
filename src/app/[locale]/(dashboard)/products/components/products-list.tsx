'use client';

import { useTranslations } from 'next-intl';
import '@/styles/products.css';
import { Icon, IconButton, useMediaQuery, type DataColumn, type RowAction } from '@openeos/ui';
import { ShoppingBag, Upload } from 'lucide-react';
import Link from 'next/link';

import { useLocaleFormat } from '@/hooks/use-locale-format';
import { ProductImage } from '@/components/shared/product-image';
import { useProducts, useUpdateProduct } from '@/hooks/use-products';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { toast } from '@/components/shared/toast';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
import {
  AdminTable,
  CellMain,
  CellNone,
  CellText,
  ListAction,
  ListCount,
  ListHead,
  PHONE_QUERY,
} from '@/components/shared/admin-table';
import type { Product } from '@/types/product';

interface ProductsListProps {
  eventId: string;
  onCreateClick: () => void;
  /** Öffnet den Import-Dialog (Speisekarte und CSV). */
  onImportClick: () => void;
  /** Admin-Hinweis auf die Einstellung, solange der Assistent aus ist. */
  menuImportHint?: boolean;
  onManageCategoriesClick: () => void;
  onEditClick: (product: Product) => void;
  onDeleteClick: (product: Product) => void;
  onAdjustStockClick: (product: Product) => void;
  /** Nur Produkte dieser Kategorie (aus ?category=). */
  categoryFilter?: string | null;
  onClearCategoryFilter?: () => void;
}

export function ProductsList({
  eventId,
  onCreateClick,
  onImportClick,
  menuImportHint = false,
  onManageCategoriesClick,
  onEditClick,
  onDeleteClick,
  onAdjustStockClick,
  categoryFilter = null,
  onClearCategoryFilter,
}: ProductsListProps) {
  const t = useTranslations('products');
  const { formatCurrency } = useLocaleFormat();

  const { data: allProducts, isLoading, error } = useProducts(eventId);
  const products = categoryFilter
    ? allProducts?.filter((product) => product.categoryId === categoryFilter)
    : allProducts;
  const filterCategoryName = categoryFilter
    ? allProducts?.find((product) => product.categoryId === categoryFilter)?.category?.name
    : undefined;
  const updateProduct = useUpdateProduct();
  const phone = useMediaQuery(PHONE_QUERY);
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

  if (categoryFilter && allProducts && allProducts.length > 0 && (!products || products.length === 0)) {
    return (
      <ListEmpty
        title={t('categoryFilter.emptyTitle')}
        description={t('categoryFilter.emptyText')}
        icon={<ShoppingBag size={28} />}
        action={
          <button className="btn btn--ghost" onClick={onClearCategoryFilter}>
            {t('categoryFilter.clear')}
          </button>
        }
      />
    );
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn btn--primary" onClick={onCreateClick}>
              {t('create')}
            </button>
            <button className="btn btn--ghost" onClick={onImportClick}>
              {t('import.trigger')}
            </button>
          </div>
        }
      />
    );
  }

  const statusBadge = (product: Product) => {
    if (!product.isActive) return <span className="badge badge--neutral">{t('status.inactive')}</span>;
    if (!product.isAvailable) return <span className="badge badge--warning">{t('status.unavailable')}</span>;
    if (product.trackInventory && product.stockQuantity <= 0) return <span className="badge badge--error">{t('status.outOfStock')}</span>;
    return <span className="badge badge--success">{t('status.available')}</span>;
  };

  const columns: DataColumn<Product>[] = [
    {
      id: 'favorite',
      header: <span className="oe-sr-only">{t('favorite')}</span>,
      width: 44,
      mobile: 'hidden',
      cell: (product) => {
        const label = t(product.isFavorite ? 'favoriteRemove' : 'favoriteAdd', { name: product.name });
        return (
          <IconButton
            variant="quiet"
            size="xs"
            className={product.isFavorite ? 'products-fav is-on' : 'products-fav'}
            aria-pressed={!!product.isFavorite}
            label={label}
            icon={<Icon name="star" filled={!!product.isFavorite} />}
            onClick={() => toggleFavorite(product)}
            disabled={updateProduct.isPending && updateProduct.variables?.id === product.id}
          />
        );
      },
    },
    {
      id: 'name',
      header: t('table.name'),
      mobile: 'title',
      cell: (product) => (
        <CellMain
          media={<ProductImage product={product} productName={product.name} size="sm" />}
          title={product.name}
          titleText={product.name}
          sub={product.description || undefined}
          subText={product.description || undefined}
        />
      ),
    },
    {
      id: 'category',
      header: t('table.category'),
      mobile: 'meta',
      priority: 2,
      cell: (product) =>
        product.category?.name ? (
          <CellText muted title={product.category.name}>{product.category.name}</CellText>
        ) : (
          <CellNone />
        ),
    },
    {
      id: 'price',
      header: t('table.price'),
      num: true,
      mobile: 'trailing',
      cell: (product) => formatCurrency(product.price),
    },
    {
      id: 'stock',
      header: t('table.stock'),
      num: true,
      priority: 3,
      mobile: 'meta',
      cell: (product) =>
        product.trackInventory ? `${product.stockQuantity} ${product.stockUnit}` : null,
    },
    {
      id: 'status',
      header: t('table.status'),
      mobile: 'subtitle',
      cell: (product) => statusBadge(product),
    },
  ];

  const actions = (product: Product): RowAction[] => [
    { id: 'edit', label: t('actions.edit'), icon: 'edit', onClick: () => onEditClick(product) },
    {
      id: 'stock',
      label: t('actions.adjustStock'),
      icon: 'sliders',
      hidden: !product.trackInventory,
      onClick: () => onAdjustStockClick(product),
    },
    {
      id: 'favorite',
      label: t(product.isFavorite ? 'actions.favoriteRemove' : 'actions.favoriteAdd'),
      icon: <Icon name="star" filled={!!product.isFavorite} />,
      // Auf dem Telefon fehlt die Sternspalte; dort steht der Favorit im Menü.
      hidden: !phone,
      onClick: () => toggleFavorite(product),
    },
    { id: 'delete', label: t('actions.delete'), icon: 'trash', danger: true, onClick: () => onDeleteClick(product) },
  ];

  return (
    <div className="app-card app-card--flat">
      <ListHead
        actions={
          /* Nur Symbole; die Beschriftung steht als Tooltip (Hover, Fokus,
             langes Drücken) und als aria-label. Ein Import-Knopf für
             Speisekarte und CSV. */
          <>
            <ListAction icon="tag" label={t('manageCategories')} onClick={onManageCategoriesClick} />
            {/* Hochladen statt Download-Pfeil: der steht beim Export. */}
            <ListAction icon={<Upload />} label={t('import.trigger')} onClick={onImportClick} />
            <ListAction variant="primary" icon="plus" label={t('create')} onClick={onCreateClick} />
          </>
        }
      >
        {/* Titel und Untertitel standen schon im Seitenkopf darueber; hier
            steht wie bei den Geraeten nur die Anzahl. */}
        <ListCount>{t('count', { count: products.length })}</ListCount>
        {categoryFilter && (
          <p className="products-list__filter" data-testid="products-category-filter">
            <span className="badge badge--neutral">
              {t('categoryFilter.label', { name: filterCategoryName ?? '–' })}
            </span>
            <button type="button" className="notice-link products-list__filter-clear" onClick={onClearCategoryFilter}>
              {t('categoryFilter.clear')}
            </button>
          </p>
        )}
        {menuImportHint && (
          <p className="products-list__hint">
            {t('menuImport.hint')}{' '}
            <Link href="/settings?tab=org-assistant" className="notice-link">
              {t('menuImport.hintAction')}
            </Link>
          </p>
        )}
      </ListHead>

      <AdminTable
        caption={t('title')}
        rows={products}
        rowKey="id"
        columns={columns}
        actions={actions}
        rowClassName={(product) => (product.isActive ? undefined : 'admin-dt__row--muted')}
      />
    </div>
  );
}
