'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Checkbox, Icon } from '@openeos/ui';

import '@/styles/event-copy.css';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { EventSourceSelect } from '@/components/shared/event-source-select';
import { ListError, ListLoading } from '@/components/shared/list-states';
import { ModalPanel } from '@/components/shared/modal-panel';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useCategories } from '@/hooks/use-categories';
import { useAllEvents, useCopyCatalog } from '@/hooks/use-events';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useProducts } from '@/hooks/use-products';
import { buildCopyTree, eventsByStart } from '@/lib/event-copy';
import type { CatalogCopyResult } from '@/types/event';

interface CopyFromEventDialogProps {
  organizationId: string;
  eventId: string;
  onClose: () => void;
}

/** „Aus Veranstaltung übernehmen“: Vorlage, Auswahl (Kategorien → Produkte), Ergebnis. */
export function CopyFromEventDialog({ organizationId, eventId, onClose }: CopyFromEventDialogProps) {
  const t = useTranslations('products.copyFrom');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { formatCurrency } = useLocaleFormat();
  const copy = useCopyCatalog();

  const { data: allEvents, isLoading: loadingEvents, isError: eventsFailed } = useAllEvents(organizationId);
  const sources = useMemo(
    () => eventsByStart((allEvents ?? []).filter((event) => event.id !== eventId)),
    [allEvents, eventId],
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const sourceId = chosen ?? sources[0]?.id ?? '';

  const { data: categories, isLoading: loadingCategories, isError: categoriesFailed } = useCategories(sourceId);
  const { data: products, isLoading: loadingProducts, isError: productsFailed } = useProducts(sourceId);
  const tree = useMemo(() => buildCopyTree(categories ?? [], products ?? []), [categories, products]);

  const [productIds, setProductIds] = useState<Set<string>>(new Set());
  /** Nur Kategorien ohne Produkte; die anderen ergeben sich aus den Produkten. */
  const [emptyIds, setEmptyIds] = useState<Set<string>>(new Set());
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [result, setResult] = useState<CatalogCopyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectAll = (on: boolean) => {
    setProductIds(new Set(on ? tree.flatMap((node) => node.products.map((p) => p.id)) : []));
    setEmptyIds(new Set(on ? tree.filter((node) => !node.products.length).map((node) => node.category.id) : []));
  };

  // Neue Vorlage: alles vorausgewählt.
  useEffect(() => {
    setProductIds(new Set(tree.flatMap((node) => node.products.map((p) => p.id))));
    setEmptyIds(new Set(tree.filter((node) => !node.products.length).map((node) => node.category.id)));
  }, [tree]);

  const toggle = (set: Set<string>, ids: string[], on: boolean) => {
    const next = new Set(set);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    return next;
  };

  const totalProducts = tree.reduce((sum, node) => sum + node.products.length, 0);
  const totalEmpty = tree.filter((node) => !node.products.length).length;
  const selectedCount = productIds.size + emptyIds.size;
  const total = totalProducts + totalEmpty;

  const submit = async () => {
    if (copy.isPending || selectedCount === 0) return;
    setError(null);
    const categoryIds = tree
      .filter((node) =>
        node.products.length ? node.products.some((p) => productIds.has(p.id)) : emptyIds.has(node.category.id),
      )
      .map((node) => node.category.id);
    try {
      setResult(
        await copy.mutateAsync({
          organizationId,
          targetEventId: eventId,
          sourceEventId: sourceId,
          data: { categoryIds, productIds: [...productIds], includeDuplicates },
        }),
      );
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const loading = loadingEvents || loadingCategories || loadingProducts;
  const failed = eventsFailed || categoriesFailed || productsFailed;

  return (
    <div className="modal__overlay" onClick={copy.isPending ? undefined : onClose}>
      <ModalPanel titleId="copy-from-event-title" className="modal__panel--md">
        <div className="modal__head">
          <h2 id="copy-from-event-title">{t('title')}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>
        {result ? (
          <>
            <div className="modal__body event-copy-dialog__body" data-testid="copy-result">
              <Banner tone="success" icon={<Icon name="check" />}>
                {result.productsSkipped > 0
                  ? t('resultSkipped', { copied: result.productsCopied, skipped: result.productsSkipped })
                  : t('result', { copied: result.productsCopied })}
              </Banner>
              <p className="event-copy-dialog__hint">
                {t('resultDetails', {
                  categories: result.categoriesCopied,
                  categoriesMerged: result.categoriesMerged,
                  stations: result.stationsCopied,
                  stationsMerged: result.stationsMerged,
                })}
              </p>
              {result.skippedProducts.length > 0 && (
                <ul className="event-copy-dialog__list">
                  {result.skippedProducts.map((row, index) => (
                    <li key={index}>
                      {row.name} ({row.category})
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                {tCommon('close')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal__body event-copy-dialog__body">
              {!loadingEvents && !eventsFailed && sources.length === 0 ? (
                <p className="event-copy-dialog__hint">{t('noSources')}</p>
              ) : (
                <>
                  <label className="auth-field">
                    <span>{t('source')}</span>
                    <EventSourceSelect events={sources} value={sourceId} onChange={setChosen} label={t('source')} />
                  </label>
                  {loading ? (
                    <ListLoading />
                  ) : failed ? (
                    <ListError />
                  ) : tree.length === 0 ? (
                    <p className="event-copy-dialog__hint">{t('emptySource')}</p>
                  ) : (
                    <>
                      <div className="event-copy-tree" data-testid="copy-tree">
                        <TriCheckbox
                          state={selectedCount === 0 ? 'none' : selectedCount === total ? 'all' : 'some'}
                          onChange={selectAll}
                        >
                          {t('selectAll')}
                        </TriCheckbox>
                        {tree.map(({ category, depth, products: rows }) => {
                          const picked = rows.filter((p) => productIds.has(p.id)).length;
                          const state = rows.length
                            ? picked === 0
                              ? 'none'
                              : picked === rows.length
                                ? 'all'
                                : 'some'
                            : emptyIds.has(category.id)
                              ? 'all'
                              : 'none';
                          return (
                            <div key={category.id} style={{ marginLeft: depth * 22 }}>
                              <TriCheckbox
                                className="event-copy-tree__category"
                                state={state}
                                onChange={(on) =>
                                  rows.length
                                    ? setProductIds((set) => toggle(set, rows.map((p) => p.id), on))
                                    : setEmptyIds((set) => toggle(set, [category.id], on))
                                }
                              >
                                {category.name}
                                <span className="event-copy-tree__meta">
                                  {rows.length ? `${picked}/${rows.length}` : t('emptyCategory')}
                                </span>
                              </TriCheckbox>
                              {rows.map((product) => (
                                <Checkbox
                                  key={product.id}
                                  className="event-copy-tree__product"
                                  checked={productIds.has(product.id)}
                                  onChange={(e) => {
                                    const on = e.target.checked;
                                    setProductIds((set) => toggle(set, [product.id], on));
                                  }}
                                >
                                  {product.name}
                                  <span className="event-copy-tree__meta">{formatCurrency(product.price)}</span>
                                </Checkbox>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                      <Checkbox
                        checked={includeDuplicates}
                        onChange={(e) => setIncludeDuplicates(e.target.checked)}
                      >
                        {t('includeDuplicates')}
                      </Checkbox>
                      <p className="event-copy-dialog__hint">{t('hint')}</p>
                    </>
                  )}
                </>
              )}
              {error && (
                <div role="alert" className="event-copy-dialog__error">
                  {error}
                </div>
              )}
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={copy.isPending}>
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={submit}
                disabled={copy.isPending || loading || failed || selectedCount === 0}
              >
                {copy.isPending ? tCommon('saving') : t('submit', { count: productIds.size })}
              </button>
            </div>
          </>
        )}
      </ModalPanel>
    </div>
  );
}

interface TriCheckboxProps {
  state: 'none' | 'some' | 'all';
  onChange: (on: boolean) => void;
  className?: string;
  children: React.ReactNode;
}

/** Häkchen mit Zwischenzustand; ein Klick darauf wählt alles. */
function TriCheckbox({ state, onChange, className, children }: TriCheckboxProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const input = ref.current?.querySelector('input');
    if (input) input.indeterminate = state === 'some';
  }, [state]);
  return (
    <span ref={ref} style={{ display: 'block' }}>
      <Checkbox className={className} checked={state === 'all'} onChange={(e) => onChange(e.target.checked)}>
        {children}
      </Checkbox>
    </span>
  );
}
