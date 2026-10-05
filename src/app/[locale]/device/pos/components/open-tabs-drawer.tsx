'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt, BankNote01, CreditCard01, Scissors01 } from '@untitledui/icons';
import { useDeviceStore } from '@/stores/device-store';
import { amountReceivedFor } from '@/utils/cash-tender';
import { deviceApi } from '@/lib/api-client';
import { useFormatPrice } from '@/hooks/use-format-price';
import { CashPaymentModal } from './cash-payment-modal';
import { PosPortal } from './pos-portal';
import { PosSheet, usePosSheetClose } from './pos-sheet';
import { SumUpCheckoutModal } from './sumup-checkout-modal';
import { useDeviceIntegrationEnabled } from '@/hooks/use-device-integration';
import type { Order } from '@/types/order';
import type { PaymentMethod } from '@/types/payment';

interface OpenTabsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSplitPayment: () => void;
}

export function OpenTabsDrawer({ isOpen, onClose, onSplitPayment }: OpenTabsDrawerProps) {
  const t = useTranslations('pos.openTabs');
  const formatCurrency = useFormatPrice();
  const queryClient = useQueryClient();

  const [showCashModal, setShowCashModal] = useState(false);
  const [showSumupModal, setShowSumupModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { settings } = useDeviceStore();
  const hasSumupReader = !!settings?.sumupReaderId;
  // Der SumUp-Leser wird nur angesprochen, solange die Integration an ist.
  // Ohne sie bleibt die Kartenzahlung als manuelle Buchung (externes
  // Terminal) — die gab es hier schon immer, und sie hat mit SumUp nichts
  // zu tun.
  const sumupEnabled = useDeviceIntegrationEnabled('sumup');
  const useSumupReader = hasSumupReader && sumupEnabled;

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['device-open-tabs'],
    queryFn: () => deviceApi.getOpenOrders(),
    enabled: isOpen,
    refetchInterval: 10000,
  });

  const orders = ordersData?.data || [];

  const getRemainingAmount = (order: Order): number => {
    return Number(order.total) - Number(order.paidAmount || 0);
  };

  const totalRemaining = orders.reduce((sum, order) => sum + getRemainingAmount(order), 0);

  const payAllOrders = async (paymentMethod: PaymentMethod, amountReceived?: number) => {
    setIsProcessing(true);
    try {
      const payable = orders
        .map((order) => ({ order, amount: getRemainingAmount(order) }))
        .filter(({ amount }) => amount > 0);
      const amounts = payable.map(({ amount }) => amount);

      for (const [index, { order, amount }] of payable.entries()) {
        const received =
          paymentMethod === 'cash' ? amountReceivedFor(index, amounts, amountReceived) : undefined;
        await deviceApi.createPayment({
          orderId: order.id,
          amount,
          paymentMethod,
          ...(received !== undefined ? { amountReceived: received } : {}),
        });
      }

      queryClient.invalidateQueries({ queryKey: ['device-open-tabs'] });
      queryClient.invalidateQueries({ queryKey: ['device-orders'] });
      queryClient.invalidateQueries({ queryKey: ['device-order-history'] });
      setShowCashModal(false);
      setShowSumupModal(false);
      onClose();
    } catch (error) {
      console.error('Payment failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCashPayment = () => {
    setShowCashModal(true);
  };

  const handleCashConfirm = (amountReceived: number) => {
    payAllOrders('cash', amountReceived);
  };

  const handleCardPayment = () => {
    if (useSumupReader) {
      setShowSumupModal(true);
    } else {
      payAllOrders('card');
    }
  };

  const { closing, close } = usePosSheetClose(isOpen, onClose);

  const handleSplit = () => {
    onSplitPayment();
    onClose();
  };

  return (
    <>
      {isOpen && (
        <PosSheet
          closing={closing}
          onClose={close}
          title={t('title')}
          subtitle={
            orders.length > 0 ? `${orders.length} ${t('orders', { count: orders.length })}` : undefined
          }
          footer={
            orders.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pos-ink)' }}>{t('totalOpen')}</span>
                  <span className="pos-mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--pos-ink)' }}>
                    {formatCurrency(totalRemaining)}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    className="pos-btn pos-btn--secondary"
                    onClick={handleCashPayment}
                    disabled={isProcessing}
                  >
                    <BankNote01 />
                    {t('payCash')}
                  </button>
                  <button
                    type="button"
                    className="pos-btn pos-btn--primary"
                    onClick={handleCardPayment}
                    disabled={isProcessing}
                  >
                    <CreditCard01 />
                    {t('payCard')}
                  </button>
                </div>
                <button type="button" className="pos-btn pos-btn--ghost" onClick={handleSplit}>
                  <Scissors01 />
                  {t('splitBill')}
                </button>
              </div>
            ) : undefined
          }
        >
          {isLoading ? (
            <div className="pos-sheet-empty">
              <div className="pos-spinner" />
            </div>
          ) : orders.length === 0 ? (
            <div className="pos-sheet-empty">
              <Receipt />
              <strong>{t('noOpenTabs')}</strong>
              <span>{t('noOpenTabsDescription')}</span>
            </div>
          ) : (
            orders.map((order) => {
              const remaining = getRemainingAmount(order);
              const items = (order.items ?? []).filter((item) => item.status !== 'cancelled');

              return (
                <div key={order.id} className="pos-card" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 8px' }}>
                      <span className="pos-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--pos-ink)' }}>
                        #{order.dailyNumber || order.orderNumber}
                      </span>
                      {order.tableNumber && (
                        <span style={{ fontSize: 13, color: 'var(--pos-ink-2)' }}>
                          {t('table')} {order.tableNumber}
                        </span>
                      )}
                      {order.customerName && (
                        <span style={{ fontSize: 13, color: 'var(--pos-ink-2)' }}>{order.customerName}</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="pos-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--pos-accent-ink)' }}>
                        {formatCurrency(remaining)}
                      </div>
                      {Number(order.paidAmount) > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--pos-ink-3)' }}>
                          {t('partlyPaid', { amount: formatCurrency(Number(order.paidAmount)) })}
                        </div>
                      )}
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {items.map((item, idx) => {
                        // Schon bezahlte Positionen bleiben sichtbar, aber durchgestrichen.
                        const isFullyPaid = (item.paidQuantity || 0) >= item.quantity;
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 12,
                              fontSize: 13,
                              color: isFullyPaid ? 'var(--pos-ink-3)' : 'var(--pos-ink-2)',
                              textDecoration: isFullyPaid ? 'line-through' : undefined,
                            }}
                          >
                            <span style={{ minWidth: 0 }}>
                              {item.quantity}× {item.productName}
                            </span>
                            <span className="pos-mono" style={{ flexShrink: 0 }}>
                              {formatCurrency(Number(item.totalPrice))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </PosSheet>
      )}

      {/* Bar und Karte liegen ueber der Liste */}
      <CashPaymentModal
        isOpen={showCashModal}
        onClose={() => setShowCashModal(false)}
        total={totalRemaining}
        onConfirm={handleCashConfirm}
        isProcessing={isProcessing}
      />
      <PosPortal>
        <SumUpCheckoutModal
          isOpen={showSumupModal}
          onClose={() => setShowSumupModal(false)}
          amount={totalRemaining}
          onSuccess={() => {
            setShowSumupModal(false);
            payAllOrders('sumup_terminal' as PaymentMethod);
          }}
        />
      </PosPortal>
    </>
  );
}
