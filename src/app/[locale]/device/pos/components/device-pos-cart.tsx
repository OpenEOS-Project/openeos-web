'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins01, CreditCard01, Tag01, X } from '@untitledui/icons';
import { useCartStore, useCartHydration } from '@/stores/cart-store';
import { notifyCustomerDisplayOrderCompleted } from '@/hooks/use-customer-display-broadcast';
import { useDeviceStore } from '@/stores/device-store';
import { deviceApi } from '@/lib/api-client';
import { formatCurrency } from '@/utils/format';
import { resolveChargePfand } from '@/utils/pfand';
import { CashPaymentModal } from './cash-payment-modal';
import { DiscountVoucherModal } from './discount-voucher-modal';
import { PfandReturnModal } from './pfand-return-modal';
import { SumUpCheckoutModal } from './sumup-checkout-modal';
import type { PaymentMethod } from '@/types/payment';

interface PosCartProps {
  organizationId: string;
  tableNumber?: string;
  orderingMode?: 'immediate' | 'tab';
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
    appliedVouchers,
    applyVoucher,
    removeVoucher,
    getDiscount,
    getNetTotal,
    setItemRefill,
    getPfandTotal,
    getPayableTotal,
  } = useCartStore();

  const tableNumber = sessionTableNumber || cartTableNumber;
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<string | null>(null);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showSumupModal, setShowSumupModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showPfandReturnModal, setShowPfandReturnModal] = useState(false);
  const { settings } = useDeviceStore();
  const hasSumupReader = !!settings?.sumupReaderId;
  const fulfillmentType = settings?.serviceMode === 'table' ? 'table_service' : 'counter_pickup';

  const { data: discountVouchers = [] } = useQuery({
    queryKey: ['device-discount-vouchers'],
    queryFn: async () => (await deviceApi.getDiscountVouchers()).data,
  });

  const { data: pfandTypes = [] } = useQuery({
    queryKey: ['device-pfand-types'],
    queryFn: async () => (await deviceApi.getPfandTypes()).data,
  });

  const { data: deviceOrg } = useQuery({
    queryKey: ['device-organization'],
    queryFn: async () => (await deviceApi.getOrganization()).data,
  });

  // Whether deposits apply for this device's fulfillment type (org policy).
  const chargePfand = resolveChargePfand(deviceOrg?.settings?.pfand, settings?.serviceMode);

  const total = getTotal();
  const discount = getDiscount();
  const netTotal = getNetTotal();
  // Suppress deposits entirely when the fulfillment type is exempt (e.g. table service).
  const pfandTotal = chargePfand ? getPfandTotal() : 0;
  const payableTotal = chargePfand ? getPayableTotal() : netTotal;
  const discountReason = appliedVouchers.map((v) => v.name).join(', ');
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  const buildOrderItems = () =>
    items.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      ...(item.notes ? { notes: item.notes } : {}),
      ...(item.kitchenNotes ? { kitchenNotes: item.kitchenNotes } : {}),
      ...(item.selectedOptions.length > 0 ? { selectedOptions: item.selectedOptions } : {}),
      ...(item.isRefill ? { isRefill: true } : {}),
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
        ...(discount > 0 ? { discountAmount: discount, discountReason } : {}),
      });
      const order = orderResponse.data;
      await deviceApi.createPayment({
        orderId: order.id,
        amount: payableTotal,
        paymentMethod,
      });
      return order;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['device-orders'] });
      queryClient.invalidateQueries({ queryKey: ['device-open-tabs'] });
      setLastOrderNumber(order.orderNumber || order.dailyNumber?.toString());
      notifyCustomerDisplayOrderCompleted('paid', order.orderNumber || order.dailyNumber?.toString() || null);
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
        ...(discount > 0 ? { discountAmount: discount, discountReason } : {}),
      });
      return orderResponse.data;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['device-orders'] });
      queryClient.invalidateQueries({ queryKey: ['device-open-tabs'] });
      setLastOrderNumber(order.orderNumber || order.dailyNumber?.toString());
      notifyCustomerDisplayOrderCompleted('tab', order.orderNumber || order.dailyNumber?.toString() || null);
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
            {tableNumber ? t('cart.tableLabel', { number: tableNumber }) : t('cart.newOrder')}
          </span>
          <span
            style={{ fontSize: 16, fontWeight: 700, color: 'var(--pos-ink)', lineHeight: 1.2 }}
          >
            {t('cart.title')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {pfandTypes.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPfandReturnModal(true)}
              style={{
                padding: '6px 10px',
                background: 'var(--pos-surface)',
                border: '1px solid var(--pos-line)',
                borderRadius: 'var(--pos-r-sm)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--pos-ink-2)',
                cursor: 'pointer',
              }}
            >
              ↩ {t('pfand.returnButton')}
            </button>
          )}
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
              {t('cart.itemCount', { count: itemCount })}
            </span>
          )}
          {onOpenTabs && orderingMode !== 'immediate' && (
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
              {t('cart.tabs')}
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
            {t('cart.emptyTitle')}<br />{t('cart.emptyHint')}
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
                      .map((o) => (o.excluded ? t('cart.without', { option: o.option }) : o.option))
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
                {chargePfand && item.pfandType && (
                  <div style={{ marginLeft: 29, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!item.isRefill && (
                      <span style={{ fontSize: 11, color: 'var(--pos-ink-3)' }}>
                        {item.pfandType.name} +{formatPrice(item.pfandType.amount)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setItemRefill(item.id, !item.isRefill)}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 999,
                        cursor: 'pointer',
                        border: `1px solid ${item.isRefill ? 'var(--pos-accent)' : 'var(--pos-line-strong)'}`,
                        background: item.isRefill ? 'var(--pos-accent-soft)' : 'transparent',
                        color: item.isRefill ? 'var(--pos-accent-ink)' : 'var(--pos-ink-3)',
                      }}
                    >
                      {item.isRefill ? `✓ ${t('pfand.refill')}` : t('pfand.refill')}
                    </button>
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
          <span>{t('cart.subtotal')}</span>
          <span className="pos-mono">{formatPrice(total)}</span>
        </div>

        {/* Discount / voucher section */}
        {items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {appliedVouchers.map((v) => (
              <div
                key={v.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  color: 'var(--pos-accent-ink)',
                  gap: 8,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <Tag01 style={{ width: 13, height: 13, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                  <button
                    type="button"
                    onClick={() => removeVoucher(v.id)}
                    aria-label={t('discount.remove')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--pos-ink-3)',
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    <X style={{ width: 13, height: 13 }} />
                  </button>
                </span>
                <span className="pos-mono">−{formatPrice(v.amount)}</span>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setShowVoucherModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '7px 10px',
                background: 'var(--pos-surface-2)',
                border: '1px dashed var(--pos-line-strong)',
                borderRadius: 'var(--pos-r-sm)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--pos-ink-2)',
                cursor: 'pointer',
              }}
            >
              <Tag01 style={{ width: 14, height: 14 }} />
              {t('discount.addVoucher')}
            </button>
          </div>
        )}

        {discount > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--pos-accent-ink)',
            }}
          >
            <span>{t('discount.label')}</span>
            <span className="pos-mono">−{formatPrice(discount)}</span>
          </div>
        )}

        {/* Pfand (deposit) row */}
        {pfandTotal > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--pos-ink-2)',
            }}
          >
            <span>{t('pfand.label')}</span>
            <span className="pos-mono">+{formatPrice(pfandTotal)}</span>
          </div>
        )}

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
            {formatCurrency(payableTotal)}
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
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Coins01 style={{ width: 18, height: 18, color: 'currentColor', flexShrink: 0 }} />
              <span>{t('cart.payCash')}</span>
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <CreditCard01 style={{ width: 18, height: 18, color: 'currentColor', flexShrink: 0 }} />
                <span>{t('cart.payCard')}</span>
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
        total={payableTotal}
        onConfirm={() => handleCheckout('cash')}
        isProcessing={isProcessing}
      />
      <SumUpCheckoutModal
        isOpen={showSumupModal}
        onClose={() => setShowSumupModal(false)}
        amount={payableTotal}
        onSuccess={() => {
          setShowSumupModal(false);
          handleCheckout('sumup_terminal' as PaymentMethod);
        }}
      />
      <DiscountVoucherModal
        isOpen={showVoucherModal}
        onClose={() => setShowVoucherModal(false)}
        vouchers={discountVouchers}
        appliedIds={appliedVouchers.map((v) => v.id)}
        onApply={applyVoucher}
      />
      <PfandReturnModal
        isOpen={showPfandReturnModal}
        onClose={() => setShowPfandReturnModal(false)}
        pfandTypes={pfandTypes}
        eventId={eventId || undefined}
      />
    </div>
  );
}
