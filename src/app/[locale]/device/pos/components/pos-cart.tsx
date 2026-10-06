'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { Button, EmptyState, Icon, IconBox, Spinner } from '@openeos/ui';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useCartHydration, useCartStore, type CartItem } from '@/stores/cart-store';
import { PosCartLine } from './pos-cart-line';
import { PosSheet } from './pos-sheet';

/** Ab dieser Zahl an Positionen fragt „Warenkorb leeren“ nach. */
const CONFIRM_CLEAR_FROM = 3;
/** Wischweg in px, ab dem das Warenkorb-Blatt (kompakt) schließt. */
const SWIPE_CLOSE = 80;

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
}

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
}: PosCartProps) {
  const t = useTranslations('pos.cartV2');
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
  const [drag, setDrag] = useState<{ start: number; dy: number } | null>(null);

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

  const handleClear = () => {
    if (items.length >= CONFIRM_CLEAR_FROM) setConfirmClear(true);
    else clearCart();
  };

  const style = drag ? ({ '--cart-drag': `${drag.dy}px` } as CSSProperties) : undefined;

  return (
    <>
      <aside
        className={['pos-cart', sheetOpen && 'is-open', drag && 'is-dragging'].filter(Boolean).join(' ')}
        aria-label={t('title')}
        style={style}
      >
        <div
          className="pos-cart__handle"
          aria-hidden
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag({ start: e.clientY, dy: 0 });
          }}
          onPointerMove={(e) => {
            if (drag) setDrag({ start: drag.start, dy: Math.max(0, e.clientY - drag.start) });
          }}
          onPointerUp={() => {
            if (drag && drag.dy > SWIPE_CLOSE) onCloseSheet();
            setDrag(null);
          }}
          onPointerCancel={() => setDrag(null)}
        />
        <div className="pos-cart__hd">
          <IconBox
            icon="cart"
            tone="accent"
            badge={count}
            className={bump ? 'pos-cart__ico oe-bump' : 'pos-cart__ico'}
          />
          <div className="pos-cart__title">
            <b>{t('title')}</b>
            <span>{t('meta', { context: contextLabel, count })}</span>
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
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Icon name="cart" />}
              title={t('empty')}
              description={t('emptyHint', { context: contextLabel })}
            />
          ) : (
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
        </div>

        <div className="pos-cart__ft">
          <dl className="pos-sums">
            <div>
              <dt>{t('subtotal')}</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
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
              <dd>{formatPrice(payable)}</dd>
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
              disabled={items.length === 0 || actionsDisabled}
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
        className="pos-cartscrim"
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
