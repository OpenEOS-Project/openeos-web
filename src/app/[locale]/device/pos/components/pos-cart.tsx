'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Button, CartLine, EmptyState, Icon, IconBox, Spinner, useSwipeToClose } from '@openeos/ui';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useCartHydration, useCartStore, type CartItem } from '@/stores/cart-store';
import type { Order, OrderItem } from '@/types/order';
import { PosCartLine } from './pos-cart-line';
import { PosSheet } from './pos-sheet';

/** Ab dieser Zahl an Positionen fragt „Warenkorb leeren“ nach. */
const CONFIRM_CLEAR_FROM = 3;

interface PosCartProps {
  /** „Tisch 12“ oder „Theke“ — Kopfzeile und Leerzustand. */
  contextLabel: string;
  chargePfand: boolean;
  /** „Senden“ nur im Modus Offene Rechnungen (`tab`). */
  canSend: boolean;
  /** Offline, oder eine Anfrage läuft: Senden/Kassieren gesperrt. */
  actionsDisabled: boolean;
  isSending: boolean;
  onSend: () => void;
  onCheckout: () => void;
  onEditLine: (item: CartItem) => void;
  /** Pfand-Rückgabe (nur wenn Pfandarten existieren). */
  onPfandReturn?: () => void;
  /** Offene Bestellungen (Modus `tab`) mit Zähler. */
  openOrders?: { count: number; onOpen: () => void };
  /** Kompakt: als Blatt von unten geöffnet. */
  sheetOpen: boolean;
  onCloseSheet: () => void;
  /** Tischbetrieb: gesendete, noch offene Bestellungen des Tisches. */
  sent?: SentOrders | null;
}

export interface SentOrders {
  orders: Order[];
  /** Offener Betrag laut Server. */
  openAmount: number;
  /** Fertige Positionen als serviert markieren. */
  onServe: (itemIds: string[]) => void;
  serving: boolean;
}

const isGuestOrder = (order: Order) => order.source === 'online' || order.source === 'qr_order';
const liveItems = (order: Order) => (order.items ?? []).filter((item) => item.status !== 'cancelled');

/** Spielt `oe-bump`, wenn sich der Schlüssel ändert (nicht beim ersten Rendern). */
function useBump(key: number) {
  const [bump, setBump] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setBump(false);
    const frame = requestAnimationFrame(() => setBump(true));
    const timer = window.setTimeout(() => setBump(false), 400);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [key]);
  return bump;
}

export function PosCart({
  contextLabel,
  chargePfand,
  canSend,
  actionsDisabled,
  isSending,
  onSend,
  onCheckout,
  onEditLine,
  onPfandReturn,
  openOrders,
  sheetOpen,
  onCloseSheet,
  sent,
}: PosCartProps) {
  const t = useTranslations('pos.cartV2');
  const tTables = useTranslations('pos.tables');
  const formatPrice = useFormatPrice();
  const hydrated = useCartHydration();
  const {
    items,
    updateItemQuantity,
    removeItem,
    clearCart,
    getTotal,
    getDiscount,
    getPayableTotal,
    getNetTotal,
    getPfandOffset,
    getNetPfandUnits,
    getNewPfandUnits,
    getReturnedPfandUnits,
  } = useCartStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const cartRef = useRef<HTMLElement>(null);
  // Telefon: Herunterziehen am Griff/Kopf oder in der Liste (oben) schließt.
  useSwipeToClose(cartRef, {
    enabled: sheetOpen,
    onClose: onCloseSheet,
    grip: '.pos-cart__handle, .pos-cart__hd',
    scroller: '.pos-cart__lines',
    property: '--cart-drag',
  });

  // Summen ausschließlich aus dem Warenkorb-Speicher (unveränderte Logik).
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = getTotal();
  const discount = getDiscount();
  const payable = chargePfand ? getPayableTotal() : getNetTotal();
  const credited = chargePfand ? getPfandOffset().convertedSum : 0;
  const tokensShown = chargePfand && (getNewPfandUnits() > 0 || getReturnedPfandUnits() > 0);
  const netTokens = chargePfand ? getNetPfandUnits() : 0;

  // Pfand je Art: „Becher (3 à 2,00 €)“
  const pfandRows = chargePfand
    ? Object.values(
        items.reduce<Record<string, { name: string; amount: number; units: number }>>((acc, item) => {
          if (!item.pfandType) return acc;
          const units = Math.max(item.quantity - item.refillCount, 0);
          if (units <= 0) return acc;
          const row = acc[item.pfandType.id] ?? {
            name: item.pfandType.name,
            amount: item.pfandType.amount,
            units: 0,
          };
          row.units += units;
          acc[item.pfandType.id] = row;
          return acc;
        }, {}),
      )
    : [];

  const bump = useBump(count);

  // Gesendet: eigene Runden und Gastbestellungen getrennt; fertige Positionen
  // (Station „fertig“) warten auf „Serviert“.
  const sentOrders = sent?.orders ?? [];
  const staffOrders = sentOrders.filter((o) => !isGuestOrder(o));
  const guestOrders = sentOrders.filter(isGuestOrder);
  const sentCount = sentOrders.reduce((sum, o) => sum + liveItems(o).reduce((n, i) => n + i.quantity, 0), 0);
  const readyItems = sentOrders.flatMap((o) =>
    o.fulfillmentType === 'table_service' ? liveItems(o).filter((i) => i.status === 'ready') : [],
  );
  const readyCount = readyItems.reduce((sum, i) => sum + i.quantity, 0);
  const sentOpen = sent?.openAmount ?? 0;
  const total = sentOpen + payable;
  const canCheckout = items.length > 0 || sentOpen > 0.0001;
  const meta = t('meta', { context: contextLabel, count });

  const sentLine = (item: OrderItem) => {
    const paid = Math.min(item.paidQuantity || 0, item.quantity);
    const options = (item.options?.selected ?? []).map((o) =>
      o.excluded ? t('without', { option: o.option }) : o.option,
    );
    const notes = [item.notes, item.kitchenNotes].filter(Boolean).map((n) => t('note', { note: n as string }));
    const paidText = paid > 0 ? [tTables('paidPart', { count: paid })] : [];
    const lineMeta = [...options, ...notes, ...paidText].join(' · ');
    const status =
      item.status === 'ready'
        ? { icon: 'bell' as const, label: tTables('statusReady') }
        : item.status === 'delivered'
          ? { icon: 'check' as const, label: tTables('statusDelivered') }
          : { icon: 'chef' as const, label: tTables('statusSent') };
    return (
      <CartLine
        key={item.id}
        className={paid >= item.quantity ? 'is-paid' : undefined}
        name={item.productName}
        meta={lineMeta || undefined}
        sent={
          <>
            <Icon name={status.icon} />
            {status.label}
          </>
        }
        qtyText={tTables('qtyText', { count: item.quantity })}
        total={formatPrice(Number(item.totalPrice))}
      />
    );
  };

  const handleClear = () => {
    if (items.length >= CONFIRM_CLEAR_FROM) setConfirmClear(true);
    else clearCart();
  };

  return (
    <>
      <aside
        ref={cartRef}
        className={sheetOpen ? 'pos-cart is-open' : 'pos-cart'}
        aria-label={t('title')}
      >
        <div className="pos-cart__handle" aria-hidden />
        <div className="pos-cart__hd">
          <IconBox
            icon="cart"
            tone="accent"
            badge={count}
            className={bump ? 'pos-cart__ico oe-bump' : 'pos-cart__ico'}
          />
          <div className="pos-cart__title">
            <b>{t('title')}</b>
            <span>{sentCount > 0 ? `${meta} · ${tTables('metaSent', { count: sentCount })}` : meta}</span>
          </div>
          {openOrders && (
            <Button
              variant="quiet"
              iconOnly
              className="pos-cart__orders"
              aria-label={t('openOrders', { count: openOrders.count })}
              title={t('openOrders', { count: openOrders.count })}
              onClick={openOrders.onOpen}
            >
              <Icon name="orders" />
              {openOrders.count > 0 && <i className="oe-icobox__badge">{openOrders.count}</i>}
            </Button>
          )}
          {onPfandReturn && (
            <Button
              variant="quiet"
              iconOnly
              aria-label={t('pfandReturn')}
              title={t('pfandReturn')}
              onClick={onPfandReturn}
            >
              <Icon name="deposit" />
            </Button>
          )}
          <Button
            variant="quiet"
            iconOnly
            aria-label={t('clear')}
            title={t('clear')}
            disabled={items.length === 0 || isSending}
            onClick={handleClear}
          >
            <Icon name="trash" />
          </Button>
          <Button
            variant="ghost"
            iconOnly
            className="pos-cart__close"
            aria-label={t('close')}
            onClick={onCloseSheet}
          >
            <Icon name="chevron-down" />
          </Button>
        </div>

        <div className="pos-cart__lines oe-scroll">
          {!hydrated ? (
            <div className="pos-center">
              <Spinner />
            </div>
          ) : items.length === 0 && sentOrders.length === 0 ? (
            <EmptyState
              icon={<Icon name="cart" />}
              title={t('empty')}
              description={t('emptyHint', { context: contextLabel })}
            />
          ) : (
            <>
              {readyCount > 0 && sent && (
                <Banner tone="warn" icon={<Icon name="bell" />} className="pos-ready">
                  <span>{tTables('readyBanner', { count: readyCount })}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={sent.serving}
                    onClick={() => sent.onServe(readyItems.map((i) => i.id))}
                  >
                    {!sent.serving && <Icon name="check" />}
                    {tTables('serve')}
                  </Button>
                </Banner>
              )}
              {staffOrders.length > 0 && (
                <section aria-label={tTables('sentTitle')}>
                  <span className="oe-label pos-cart__sec">{tTables('sentTitle')}</span>
                  <ul className="oe-cartlines">{staffOrders.flatMap((o) => liveItems(o).map(sentLine))}</ul>
                </section>
              )}
              {guestOrders.length > 0 && (
                <section aria-label={tTables('guestTitle')}>
                  <span className="oe-label pos-cart__sec">{tTables('guestTitle')}</span>
                  <ul className="oe-cartlines">{guestOrders.flatMap((o) => liveItems(o).map(sentLine))}</ul>
                </section>
              )}
              {sentOrders.length > 0 && items.length > 0 && (
                <span className="oe-label pos-cart__sec">{tTables('newTitle')}</span>
              )}
              {items.length > 0 && (
            <ul className="oe-cartlines" aria-label={t('linesLabel')}>
              {items.map((item) => (
                <PosCartLine
                  key={item.id}
                  item={item}
                  chargePfand={chargePfand}
                  onIncrement={() => updateItemQuantity(item.id, item.quantity + 1)}
                  onDecrement={() =>
                    item.quantity <= 1
                      ? removeItem(item.id)
                      : updateItemQuantity(item.id, item.quantity - 1)
                  }
                  onEdit={() => onEditLine(item)}
                />
              ))}
            </ul>
              )}
            </>
          )}
        </div>

        <div className="pos-cart__ft">
          <dl className="pos-sums">
            {sentOpen > 0.0001 && (
              <div>
                <dt>{tTables('sentOpen')}</dt>
                <dd>{formatPrice(sentOpen)}</dd>
              </div>
            )}
            {(sentOpen <= 0.0001 || items.length > 0) && (
              <div>
                <dt>{sentOpen > 0.0001 ? tTables('newSubtotal') : t('subtotal')}</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
            )}
            {pfandRows.map((row) => (
              <div key={row.name}>
                <dt>{t('pfandLine', { name: row.name, count: row.units, amount: formatPrice(row.amount) })}</dt>
                <dd>{formatPrice(row.amount * row.units)}</dd>
              </div>
            ))}
            {credited > 0 && (
              <div>
                <dt>{t('pfandReturnLine')}</dt>
                <dd>{`-${formatPrice(credited)}`}</dd>
              </div>
            )}
            {discount > 0 && (
              <div>
                <dt>{t('discount')}</dt>
                <dd>{`-${formatPrice(discount)}`}</dd>
              </div>
            )}
            <div className="pos-sums__total">
              <dt>{t('total')}</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>
          {tokensShown && (
            <div className="pos-tokens" role="status">
              <Icon name="deposit" />
              <span>{netTokens >= 0 ? t('tokensOut') : t('tokensIn')}</span>
              <b>{Math.abs(netTokens)}</b>
            </div>
          )}
          <div className={canSend ? 'pos-cart__acts' : 'pos-cart__acts pos-cart__acts--single'}>
            {canSend && (
              <Button
                variant="secondary"
                disabled={items.length === 0 || actionsDisabled}
                loading={isSending}
                onClick={onSend}
              >
                {!isSending && <Icon name="chef" />}
                {t('send')}
              </Button>
            )}
            <Button
              variant="primary"
              size="lg"
              disabled={!canCheckout || actionsDisabled}
              onClick={onCheckout}
            >
              <Icon name="receipt" />
              {t('checkout')}
            </Button>
          </div>
        </div>
      </aside>
      <button
        type="button"
        className="oe-scrim pos-cartscrim"
        tabIndex={-1}
        aria-label={t('close')}
        onClick={onCloseSheet}
      />

      <PosSheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        icon="trash"
        iconTone="default"
        title={t('clearConfirmTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="danger"
              className="oe-grow"
              onClick={() => {
                clearCart();
                setConfirmClear(false);
              }}
            >
              <Icon name="trash" />
              {t('clearConfirm')}
            </Button>
          </>
        }
      >
        <p className="pos-hint">{t('clearConfirmText', { count: items.length })}</p>
      </PosSheet>
    </>
  );
}
