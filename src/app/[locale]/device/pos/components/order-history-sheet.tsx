'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import {
  DISPLAY_STATUS_ICON,
  DISPLAY_STATUS_TONE,
  STATUS_FILTERS,
  groupByDay,
  itemsSummary,
  orderPlace,
  paymentBadges,
  startOfLocalDay,
} from '@/utils/order-history';
import {
  Badge,
  Button,
  Chip,
  Chips,
  EmptyState,
  Icon,
  SearchInput,
  Segment,
  Spinner,
} from '@openeos/ui';

import { useFormatPrice } from '@/hooks/use-format-price';

import type { HistoryPaymentFilter, OrderHistoryRow } from '@/types/order-history';
import type { PosCardMode } from '@/utils/pos-card-mode';

import { DEFAULT_FILTERS, type HistoryFilters, useOrderHistory } from '../hooks/use-order-history';
import type { DoneInfo } from './done-sheet';
import { OrderDetailSheet } from './order-detail-sheet';
import { PosSheet } from './pos-sheet';

interface OrderHistorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string | null;
  card: PosCardMode;
  disabled?: boolean;
  onPaid: (info: DoneInfo) => void;
}

const PAYMENT_FILTERS: {
  id: HistoryPaymentFilter;
  icon: 'cash' | 'card' | 'contactless' | 'percent';
}[] = [
  { id: 'cash', icon: 'cash' },
  { id: 'card', icon: 'card' },
  { id: 'sumup', icon: 'contactless' },
  { id: 'discount', icon: 'percent' },
];

/**
 * Bestellverlauf der Kasse: nach Tag gruppiert, je Zeile Nummer, Uhrzeit,
 * Ort, Kurzinhalt, Betrag, Zahlart und genau ein Status. Suche und Filter
 * laufen auf dem Server; weitere Seiten lädt „Mehr laden“ bzw. das
 * Scrollen ans Ende. Eine Zeile öffnet das Detail mit allen Aktionen.
 */
export function OrderHistorySheet({
  isOpen,
  onClose,
  eventId,
  card,
  disabled,
  onPaid,
}: OrderHistorySheetProps) {
  const t = useTranslations('pos.orderHistory');
  const locale = useLocale();
  const formatPrice = useFormatPrice();
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);

  // Suche erst nach einer kurzen Pause an den Server.
  useEffect(() => {
    const handle = window.setTimeout(
      () => setFilters((f) => (f.q === search ? f : { ...f, q: search })),
      300
    );
    return () => window.clearTimeout(handle);
  }, [search]);
  useEffect(() => {
    if (isOpen) setFrom(startOfLocalDay());
    else setSelectedId(null);
  }, [isOpen, filters.range]);

  const history = useOrderHistory(eventId, filters, from, isOpen);
  const { rows, counts, hasNextPage, isFetchingNextPage, fetchNextPage, isLoading } = history;
  const groups = useMemo(() => groupByDay(rows), [rows]);

  // Endlos-Scroll: lädt nach, sobald das Ende der Liste sichtbar wird.
  const sentinel = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, rows.length]);

  const extraFilters =
    filters.payments.length +
    (filters.scope === 'device' ? 1 : 0) +
    (filters.range === 'today' ? 1 : 0);
  const activeStatus = STATUS_FILTERS.find(
    (f) =>
      f.statuses.length === filters.statuses.length &&
      f.statuses.every((s) => filters.statuses.includes(s))
  )?.id;
  const countOf = (id: string) =>
    counts
      ? STATUS_FILTERS.find((f) => f.id === id)!.statuses.reduce(
          (sum, s) => sum + (counts[s] ?? 0),
          0
        )
      : null;

  const dayLabel = (kind: 'today' | 'yesterday' | 'date', date: Date) =>
    kind === 'date'
      ? date.toLocaleDateString(locale, {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : t(kind === 'today' ? 'today' : 'yesterday');
  const time = (value: string) =>
    new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const placeText = (row: OrderHistoryRow) => {
    const place = orderPlace(row);
    if (place === 'table') return t('placeTable', { table: row.tableNumber ?? '' });
    return t(place === 'togo' ? 'placeTogo' : 'placeCounter');
  };

  const toolbar = (
    <div className="pos-oh-tools">
      <div className="pos-oh-tools__row">
        <SearchInput
          className="pos-oh-search"
          icon={<Icon name="search" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('search')}
          type="search"
        />
        <Button
          variant={showFilters || extraFilters > 0 ? 'secondary' : 'ghost'}
          aria-expanded={showFilters}
          aria-label={extraFilters > 0 ? `${t('filters')} (${extraFilters})` : t('filters')}
          onClick={() => setShowFilters((v) => !v)}
        >
          <Icon name="filter" />
          <span className="pos-oh-hide-sm">{t('filters')}</span>
          {extraFilters > 0 && <span className="pos-oh-count">{extraFilters}</span>}
        </Button>
      </div>
      <Chips className="pos-oh-chips">
        <Chip active={!activeStatus} onClick={() => setFilters((f) => ({ ...f, statuses: [] }))}>
          {t('filterAll')}
          {counts && <span className="pos-oh-count">{counts.all}</span>}
        </Chip>
        {STATUS_FILTERS.map((f) => (
          <Chip
            key={f.id}
            active={activeStatus === f.id}
            onClick={() =>
              setFilters((prev) => ({ ...prev, statuses: activeStatus === f.id ? [] : f.statuses }))
            }
          >
            {t(`status.${f.id}`)}
            {counts && <span className="pos-oh-count">{countOf(f.id)}</span>}
          </Chip>
        ))}
      </Chips>
      {showFilters && (
        <div className="pos-oh-more">
          <div className="pos-oh-more__grp">
            <small>{t('paymentFilter')}</small>
            <Chips>
              {PAYMENT_FILTERS.map((p) => {
                const active = filters.payments.includes(p.id);
                return (
                  <Chip
                    key={p.id}
                    active={active}
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        payments: active
                          ? f.payments.filter((x) => x !== p.id)
                          : [...f.payments, p.id],
                      }))
                    }
                  >
                    <Icon name={p.icon} />
                    {t(`payment.${p.id}`)}
                  </Chip>
                );
              })}
            </Chips>
          </div>
          <div className="pos-oh-more__grp">
            <small>{t('scope')}</small>
            <Segment<'device' | 'all'>
              size="lg"
              aria-label={t('scope')}
              value={filters.scope}
              onChange={(scope) => setFilters((f) => ({ ...f, scope }))}
              options={[
                { id: 'device', label: t('scopeDevice') },
                { id: 'all', label: t('scopeAll') },
              ]}
            />
          </div>
          <div className="pos-oh-more__grp">
            <small>{t('range')}</small>
            <Segment<'today' | 'event'>
              size="lg"
              aria-label={t('range')}
              value={filters.range}
              onChange={(range) => setFilters((f) => ({ ...f, range }))}
              options={[
                { id: 'today', label: t('rangeToday') },
                { id: 'event', label: t('rangeEvent') },
              ]}
            />
          </div>
          {extraFilters > 0 && (
            <Button
              variant="ghost"
              onClick={() =>
                setFilters((f) => ({ ...DEFAULT_FILTERS, q: f.q, statuses: f.statuses }))
              }
            >
              <Icon name="x" />
              {t('resetFilters')}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <PosSheet
        open={isOpen}
        onClose={onClose}
        size="wide"
        icon="history"
        title={t('title')}
        subtitle={
          counts ? t('resultCount', { count: history.data?.pages[0]?.meta.total ?? 0 }) : undefined
        }
        toolbar={toolbar}
      >
        {isLoading ? (
          <div className="pos-center">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Icon name="receipt" />}
            title={t('noOrders')}
            description={
              filters.q || filters.statuses.length || extraFilters
                ? t('noMatches')
                : t('noOrdersDescription')
            }
          />
        ) : (
          <div className="pos-oh-list">
            {groups.map((group) => (
              <section
                key={group.key}
                className="pos-oh-day"
                aria-label={dayLabel(group.kind, group.date)}
              >
                <h3 className="pos-oh-day__hd">
                  <span>{dayLabel(group.kind, group.date)}</span>
                  <small>{t('orderCount', { count: group.rows.length })}</small>
                </h3>
                <ul className="pos-list">
                  {group.rows.map((row) => {
                    const summary = itemsSummary(row.items);
                    const badges = paymentBadges(row);
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          className={
                            row.displayStatus === 'cancelled'
                              ? 'pos-oh-row is-cancelled'
                              : 'pos-oh-row'
                          }
                          onClick={() => setSelectedId(row.id)}
                        >
                          <span className="pos-oh-row__no">
                            <b>#{row.dailyNumber}</b>
                            <small>{time(row.createdAt)}</small>
                          </span>
                          <span className="pos-oh-row__main">
                            <span className="pos-oh-row__place">
                              <Icon
                                name={
                                  orderPlace(row) === 'table'
                                    ? 'table'
                                    : orderPlace(row) === 'togo'
                                      ? 'send'
                                      : 'utensils'
                                }
                              />
                              {placeText(row)}
                              {row.customerName && <em>{row.customerName}</em>}
                            </span>
                            <span className="pos-oh-row__items">
                              {summary.parts.length ? summary.parts.join(', ') : t('noItems')}
                              {summary.more > 0 && ` ${t('moreProducts', { count: summary.more })}`}
                            </span>
                            <span className="pos-oh-row__status">
                              <Badge tone={DISPLAY_STATUS_TONE[row.displayStatus]}>
                                <Icon name={DISPLAY_STATUS_ICON[row.displayStatus]} />
                                {t(`status.${row.displayStatus}`)}
                              </Badge>
                              {row.isTest && <Badge tone="outline">{t('test')}</Badge>}
                            </span>
                          </span>
                          <span className="pos-oh-row__sum">
                            <b>{formatPrice(row.total)}</b>
                            {row.refundedAmount > 0 && (
                              <small className="pos-oh-neg">
                                {formatPrice(-row.refundedAmount)}
                              </small>
                            )}
                            <span className="pos-oh-row__pay">
                              {badges.map((b) => (
                                <span
                                  key={b.key}
                                  title={t(`payment.${b.key}`)}
                                  aria-label={t(`payment.${b.key}`)}
                                >
                                  <Icon name={b.icon} />
                                </span>
                              ))}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {hasNextPage && (
              <div className="pos-oh-more-btn">
                <span ref={sentinel} aria-hidden />
                <Button
                  variant="secondary"
                  loading={isFetchingNextPage}
                  onClick={() => void fetchNextPage()}
                >
                  {t('loadMore')}
                </Button>
              </div>
            )}
          </div>
        )}
      </PosSheet>
      <OrderDetailSheet
        orderId={selectedId}
        onClose={() => setSelectedId(null)}
        card={card}
        disabled={disabled}
        onPaid={(info) => {
          setSelectedId(null);
          onClose();
          onPaid(info);
        }}
      />
    </>
  );
}
