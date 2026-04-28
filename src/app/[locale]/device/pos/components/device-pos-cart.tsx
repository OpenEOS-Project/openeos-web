'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCartStore, useCartHydration } from '@/stores/cart-store';
import { useDeviceStore } from '@/stores/device-store';
import { deviceApi } from '@/lib/api-client';
import { formatCurrency } from '@/utils/format';
import { CashPaymentModal } from './cash-payment-modal';
import { SumUpCheckoutModal } from './sumup-checkout-modal';
import type { PaymentMethod } from '@/types/payment';

interface PosCartProps {
  organizationId: string;
  tableNumber?: string;
  orderingMode?: 'immediate' | 'tab';
  onClose?: () => void;
  onOpenTabs?: () => void;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
}

export function PosCart({
  organizationId: _organizationId,
  tableNumber: sessionTableNumber,
  orderingMode = 'immediate',
  onClose,
  onOpenTabs,
}: PosCartProps) {
  const t = useTranslations('pos');
  const queryClient = useQueryClient();
  const cartHydrated = useCartHydration();
  const {
    items,
    eventId,
    tableNumber: cartTableNumber,
    updateItemQuantity,
    removeItem,
    clearCart,
    getTotal,
  } = useCartStore();

  const tableNumber = sessionTableNumber || cartTableNumber;
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<string | null>(null);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showSumupModal, setShowSumupModal] = useState(false);
  const { settings } = useDeviceStore();
  const hasSumupReader = !!settings?.sumupReaderId;
  const fulfillmentType = settings?.serviceMode === 'table' ? 'table_service' : 'counter_pickup';

  const total = getTotal();
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  const buildOrderItems = () =>
    items.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      ...(item.notes ? { notes: item.notes } : {}),
      ...(item.kitchenNotes ? { kitchenNotes: item.kitchenNotes } : {}),
      ...(item.selectedOptions.length > 0 ? { selectedOptions: item.selectedOptions } : {}),
    }));

  const createOrderWithPayment = useMutation({
    mutationFn: async (paymentMethod: PaymentMethod) => {
      if (!eventId) throw new Error('No event selected');
      const orderResponse = await deviceApi.createOrder({
        eventId,
        tableNumber: tableNumber || undefined,
        source: 'pos',
        fulfillmentType,
        items: buildOrderItems(),
      });
      const order = orderResponse.data;
      await deviceApi.createPayment({
        orderId: order.id,
        amount: total,
        paymentMethod,
      });
      return order;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['device-orders'] });
      queryClient.invalidateQueries({ queryKey: ['device-open-tabs'] });
      setLastOrderNumber(order.orderNumber || order.dailyNumber?.toString());
      clearCart();
      setTimeout(() => setLastOrderNumber(null), 5000);
    },
  });

  const createOrderOnly = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('No event selected');
      const orderResponse = await deviceApi.createOrder({
        eventId,
        tableNumber: tableNumber || undefined,
        source: 'pos',
        fulfillmentType,
        items: buildOrderItems(),
      });
      return orderResponse.data;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['device-orders'] });
      queryClient.invalidateQueries({ queryKey: ['device-open-tabs'] });
      setLastOrderNumber(order.orderNumber || order.dailyNumber?.toString());
      clearCart();
      setTimeout(() => setLastOrderNumber(null), 5000);
    },
  });

  const handleCheckout = async (paymentMethod: PaymentMethod) => {
    if (items.length === 0) return;
    setIsProcessing(true);
    try {
      await createOrderWithPayment.mutateAsync(paymentMethod);
      setShowCashModal(false);
    } catch (error) {
      console.error('Order failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTabOrder = async () => {
    if (items.length === 0) return;
    setIsProcessing(true);
    try {
      await createOrderOnly.mutateAsync();
    } catch (error) {
      console.error('Order failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--pos-surface)',
        borderLeft: '1px solid var(--pos-line)',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--pos-line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span
            style={{
              fontSize: 10,
              color: 'var(--pos-ink-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 600,
            }}
          >
            {tableNumber ? `Tisch ${tableNumber}` : 'Neue Bestellung'}
          </span>
          <span
            style={{ fontSize: 16, fontWeight: 700, color: 'var(--pos-ink)', lineHeight: 1.2 }}
          >
            {t('cart.title')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {itemCount > 0 && (
            <span
              className="pos-mono"
              style={{
                background: 'var(--pos-accent-soft)',
                color: 'var(--pos-accent-ink)',
                padding: '3px 9px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {itemCount} {itemCount === 1 ? 'Artikel' : 'Artikel'}
            </span>
          )}
          {onOpenTabs && (
            <button
              type="button"
              onClick={onOpenTabs}
              style={{
                padding: '6px 10px',
                background: 'var(--pos-surface)',
                border: '1px solid var(--pos-line)',
                borderRadius: 'var(--pos-r-sm)',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--pos-ink-2)',
                cursor: 'pointer',
              }}
            >
              Tabs
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--pos-surface)',
                border: '1px solid var(--pos-line)',
                borderRadius: 'var(--pos-r-sm)',
                cursor: 'pointer',
                color: 'var(--pos-ink-2)',
                fontSize: 14,
              }}
              aria-label="Schließen"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Success banner ── */}
      {lastOrderNumber && (
        <div
          style={{
            padding: '10px 18px',
            background: 'var(--pos-accent-soft)',
            borderBottom: '1px solid var(--pos-line)',
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--pos-accent-ink)',
            animation: 'pos-slide-up .2s ease',
          }}
        >
          ✓ {t('cart.orderCreated', { number: lastOrderNumber })}
        </div>
      )}

      {/* ── Items ── */}
      <div
        className="pos-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '6px 18px' }}
      >
        {!cartHydrated ? (
          <div
            style={{
              height: '100%',
              minHeight: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                border: '2px solid var(--pos-accent)',
                borderTopColor: 'transparent',
                animation: 'spin 0.7s linear infinite',
              }}
            />
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              height: '100%',
              minHeight: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--pos-ink-3)',
              fontSize: 13,
              textAlign: 'center',
              padding: 20,
            }}
          >
            Noch nichts bestellt.<br />Artikel antippen zum Hinzufügen.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 8,
                padding: '9px 0',
                borderBottom: '1px solid var(--pos-line)',
              }}
            >
              {/* Left: name + options */}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span
                    className="pos-mono"
                    style={{
                      fontSize: 12,
                      color: 'var(--pos-accent-ink)',
                      fontWeight: 600,
                      minWidth: 22,
                    }}
                  >
                    {item.quantity}×
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--pos-ink)',
                      lineHeight: 1.25,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.product.name}
                  </span>
                </div>
                {item.selectedOptions.length > 0 && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--pos-ink-3)',
                      marginLeft: 29,
                      lineHeight: 1.35,
                    }}
                  >
                    {item.selectedOptions
                      .map((o) => (o.excluded ? `ohne ${o.option}` : o.option))
                      .join(' · ')}
                  </div>
                )}
                {item.notes && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--pos-accent-ink)',
                      marginLeft: 29,
                      fontStyle: 'italic',
                      lineHeight: 1.35,
                    }}
                  >
                    „{item.notes}"
                  </div>
                )}
              </div>

              {/* Right: qty controls + price */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--pos-surface-2)',
                    border: '1px solid var(--pos-line)',
                    borderRadius: 'var(--pos-r-sm)',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      item.quantity === 1
                        ? removeItem(item.id)
                        : updateItemQuantity(item.id, item.quantity - 1)
                    }
                    style={{
                      width: 28,
                      height: 28,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: 'var(--pos-ink-2)',
                      fontSize: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                    style={{
                      width: 28,
                      height: 28,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: 'var(--pos-ink-2)',
                      fontSize: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    +
                  </button>
                </div>
                <span
                  className="pos-mono"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    minWidth: 62,
                    textAlign: 'right',
                    color: 'var(--pos-ink)',
                    paddingTop: 5,
                  }}
                >
                  {formatPrice(item.unitPrice * item.quantity)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          padding: '14px 18px',
          borderTop: '1px solid var(--pos-line)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Subtotal row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--pos-ink-2)',
          }}
        >
          <span>Zwischensumme</span>
          <span className="pos-mono">{formatPrice(total)}</span>
        </div>

        {/* Total row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pos-ink)' }}>
            {t('cart.total')}
          </span>
          <span
            className="pos-mono"
            style={{ fontSize: 26, fontWeight: 700, color: 'var(--pos-ink)', letterSpacing: '-0.02em' }}
          >
            {formatCurrency(total)}
          </span>
        </div>

        {/* Action buttons */}
        {orderingMode === 'immediate' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: hasSumupReader ? '1fr 1fr' : '1fr',
              gap: 8,
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={() => setShowCashModal(true)}
              disabled={items.length === 0 || isProcessing}
              style={{
                padding: '13px 10px',
                background: 'var(--pos-surface)',
                color: 'var(--pos-ink)',
                border: '1px solid var(--pos-line-strong)',
                borderRadius: 'var(--pos-r-sm)',
                fontSize: 14,
                fontWeight: 600,
                cursor: items.length > 0 && !isProcessing ? 'pointer' : 'not-allowed',
                opacity: items.length > 0 && !isProcessing ? 1 : 0.5,
                transition: 'opacity .12s',
              }}
            >
              💶 {t('cart.payCash')}
            </button>
            {hasSumupReader && (
              <button
                type="button"
                onClick={() => setShowSumupModal(true)}
                disabled={items.length === 0 || isProcessing}
                style={{
                  padding: '13px 10px',
                  background: 'var(--pos-accent)',
                  color: 'var(--pos-accent-contrast)',
                  border: 'none',
                  borderRadius: 'var(--pos-r-sm)',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: items.length > 0 && !isProcessing ? 'pointer' : 'not-allowed',
                  opacity: items.length > 0 && !isProcessing ? 1 : 0.5,
                  transition: 'opacity .12s',
                }}
              >
                💳 {t('cart.payCard')}
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleTabOrder}
            disabled={items.length === 0 || isProcessing}
            style={{
              padding: '14px',
              background: 'var(--pos-accent)',
              color: 'var(--pos-accent-contrast)',
              border: 'none',
              borderRadius: 'var(--pos-r-sm)',
              fontSize: 15,
              fontWeight: 700,
              cursor: items.length > 0 && !isProcessing ? 'pointer' : 'not-allowed',
              opacity: items.length > 0 && !isProcessing ? 1 : 0.5,
              marginTop: 4,
            }}
          >
            {t('cart.placeOrder')} →
          </button>
        )}

        {items.length > 0 && (
          <button
            type="button"
            onClick={clearCart}
            disabled={isProcessing}
            style={{
              background: 'none',
              border: 'none',
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--pos-ink-3)',
              cursor: 'pointer',
              padding: '2px 0',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--pos-danger)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--pos-ink-3)'; }}
          >
            {t('cart.clear')}
          </button>
        )}
      </div>

      {/* Modals */}
      <CashPaymentModal
        isOpen={showCashModal}
        onClose={() => setShowCashModal(false)}
        total={total}
        onConfirm={() => handleCheckout('cash')}
        isProcessing={isProcessing}
      />
      <SumUpCheckoutModal
        isOpen={showSumupModal}
        onClose={() => setShowSumupModal(false)}
        amount={total}
        onSuccess={() => {
          setShowSumupModal(false);
          handleCheckout('sumup_terminal' as PaymentMethod);
        }}
      />
    </div>
  );
}
