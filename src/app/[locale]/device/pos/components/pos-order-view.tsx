'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { CartBar, EmptyState, Icon, Spinner } from '@openeos/ui';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useCartStore, type CartItem } from '@/stores/cart-store';
import { useDeviceStore } from '@/stores/device-store';
import type { Category } from '@/types/category';
import { usePosCompact } from '../hooks/use-pos-compact';
import { OptionsSheet, type OptionsResult } from './options-sheet';
import { PosCart, type SentOrders } from './pos-cart';
import { FAVORITES_ID, PosCategoryRail } from './pos-category-rail';
import { PosProductGrid } from './pos-product-grid';
import { PosSearch, searchKey } from './pos-search';
import { usePosToast } from './pos-toast';
import type { PosProduct } from './product-visual';

interface PosOrderViewProps {
  eventId: string | null;
  products: PosProduct[];
  categories: Category[];
  isLoading: boolean;
  chargePfand: boolean;
  contextLabel: string;
  canSend: boolean;
  actionsDisabled: boolean;
  isSending: boolean;
  onSend: () => void;
  onCheckout: () => void;
  onPfandReturn?: () => void;
  openOrders?: { count: number; onOpen: () => void };
  /** Tischbetrieb: gesendete Bestellungen des Tisches. */
  sent?: SentOrders | null;
}

/**
 * Bestellansicht: Kategorien · Produktraster mit Suche · Warenkorb.
 * Kompakt wird der Warenkorb zur Leiste unten mit Blatt.
 */
export function PosOrderView({
  eventId,
  products,
  categories,
  isLoading,
  chargePfand,
  contextLabel,
  canSend,
  actionsDisabled,
  isSending,
  onSend,
  onCheckout,
  onPfandReturn,
  openOrders,
  sent,
}: PosOrderViewProps) {
  const t = useTranslations('pos.order');
  const tCart = useTranslations('pos.cartV2');
  const formatPrice = useFormatPrice();
  const compact = usePosCompact();
  const toast = usePosToast();
  const { items, addItem, updateItem, getPayableTotal, getNetTotal } = useCartStore();
  const lastCategory = useDeviceStore((s) => (eventId ? s.lastCategory[eventId] : undefined));
  const setLastCategory = useDeviceStore((s) => s.setLastCategory);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [optionsTarget, setOptionsTarget] = useState<{ product: PosProduct; item?: CartItem } | null>(null);

  const visible = useMemo(() => products.filter((p) => p.isActive), [products]);
  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );
  const hasFavorites = visible.some((p) => p.isFavorite);

  const counts = useMemo(() => {
    const out: Record<string, number> = { [FAVORITES_ID]: 0 };
    for (const product of visible) {
      if (product.isFavorite) out[FAVORITES_ID] += 1;
      if (product.categoryId) out[product.categoryId] = (out[product.categoryId] ?? 0) + 1;
    }
    return out;
  }, [visible]);

  // Startauswahl: zuletzt genutzte, sonst Favoriten, sonst erste Kategorie.
  const validIds = new Set([...(hasFavorites ? [FAVORITES_ID] : []), ...activeCategories.map((c) => c.id)]);
  const selectedId =
    lastCategory && validIds.has(lastCategory)
      ? lastCategory
      : hasFavorites
        ? FAVORITES_ID
        : (activeCategories[0]?.id ?? null);

  const q = searchKey(query.trim());
  const searching = searchOpen && q.length > 0;
  const shown = useMemo(() => {
    if (searching) {
      return visible.filter((p) => searchKey(`${p.name} ${p.description ?? ''}`).includes(q));
    }
    if (selectedId === FAVORITES_ID) return visible.filter((p) => p.isFavorite);
    if (!selectedId) return visible;
    return visible.filter((p) => p.categoryId === selectedId);
  }, [visible, searching, q, selectedId]);

  const quantities = useMemo(() => {
    const out: Record<string, number> = {};
    for (const item of items) out[item.product.id] = (out[item.product.id] ?? 0) + item.quantity;
    return out;
  }, [items]);

  const title = searching
    ? t('searchTitle', { query: query.trim() })
    : selectedId === FAVORITES_ID
      ? t('favorites')
      : (activeCategories.find((c) => c.id === selectedId)?.name ?? t('allItems'));

  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const payable = (chargePfand ? getPayableTotal() : getNetTotal()) + (sent?.openAmount ?? 0);

  const selectCategory = (id: string) => {
    if (eventId) setLastCategory(eventId, id);
    setQuery('');
    setSearchOpen(false);
  };

  const added = (product: PosProduct) => {
    if (compact) toast(tCart('added', { name: product.name }));
  };

  const handleProduct = (product: PosProduct) => {
    if ((product.options?.groups?.length ?? 0) > 0) {
      setOptionsTarget({ product });
      return;
    }
    addItem(product, 1, []);
    added(product);
  };

  const confirmOptions = (product: PosProduct, result: OptionsResult, item?: CartItem) => {
    if (item) {
      updateItem(item.id, result);
    } else {
      addItem(product, result.quantity, result.selectedOptions, result.kitchenNotes);
      if (result.refillCount > 0) {
        // Nachfüllen gilt für die eben angelegte bzw. erhöhte Zeile.
        const line = useCartStore
          .getState()
          .items.find(
            (i) =>
              i.product.id === product.id &&
              JSON.stringify(i.selectedOptions) === JSON.stringify(result.selectedOptions) &&
              (i.kitchenNotes || '') === result.kitchenNotes,
          );
        if (line) updateItem(line.id, { refillCount: line.refillCount + result.refillCount });
      }
      added(product);
    }
    setOptionsTarget(null);
  };

  let content: ReactNode;
  if (!eventId) {
    content = <EmptyState icon={<Icon name="calendar" />} title={t('noEvent')} description={t('noEventHint')} />;
  } else if (isLoading) {
    content = (
      <div className="pos-center">
        <Spinner />
        <span>{t('loading')}</span>
      </div>
    );
  } else if (visible.length === 0) {
    content = <EmptyState icon={<Icon name="box" />} title={t('noProducts')} description={t('noProductsHint')} />;
  } else if (shown.length === 0) {
    content = searching ? (
      <EmptyState icon={<Icon name="search" />} title={t('noResults')} description={t('noResultsHint')} />
    ) : (
      <EmptyState icon={<Icon name="box" />} title={t('emptyCategory')} />
    );
  } else {
    content = (
      <PosProductGrid
        products={shown}
        categories={activeCategories}
        quantities={quantities}
        chargePfand={chargePfand}
        onSelect={handleProduct}
      />
    );
  }

  return (
    <div className={cartOpen ? 'pos-order is-cart-open' : 'pos-order'}>
      <PosCategoryRail
        categories={activeCategories}
        counts={counts}
        showFavorites={hasFavorites}
        selectedId={searching ? null : selectedId}
        onSelect={selectCategory}
      />

      <main className="pos-order__main">
        <div className="pos-bar">
          <h2>
            <span className="pos-bar__title">{title}</span>
            <span className="pos-bar__count">{t('itemCount', { count: shown.length })}</span>
          </h2>
          <PosSearch open={searchOpen} query={query} onOpenChange={setSearchOpen} onQueryChange={setQuery} />
        </div>
        <div className="pos-gridwrap oe-scroll">
          {content}
        </div>
      </main>

      <PosCart
        contextLabel={contextLabel}
        chargePfand={chargePfand}
        canSend={canSend}
        actionsDisabled={actionsDisabled}
        isSending={isSending}
        onSend={onSend}
        onCheckout={() => {
          setCartOpen(false);
          onCheckout();
        }}
        onEditLine={(item) => setOptionsTarget({ product: item.product as PosProduct, item })}
        onPfandReturn={onPfandReturn}
        openOrders={openOrders}
        sheetOpen={cartOpen}
        onCloseSheet={() => setCartOpen(false)}
        sent={sent}
      />

      <div className="pos-cartbar">
        <CartBar
          count={count}
          countLabel={t('itemCount', { count })}
          total={formatPrice(payable)}
          label={tCart('title')}
          aria-label={tCart('openAria', { count, total: formatPrice(payable) })}
          onClick={() => setCartOpen(true)}
        />
      </div>

      <OptionsSheet
        target={optionsTarget}
        chargePfand={chargePfand}
        onClose={() => setOptionsTarget(null)}
        onConfirm={confirmOptions}
      />
    </div>
  );
}
