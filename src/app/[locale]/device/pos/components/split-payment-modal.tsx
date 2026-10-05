'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, BankNote01, CreditCard01 } from '@untitledui/icons';
import { useDeviceStore } from '@/stores/device-store';
import { amountReceivedFor } from '@/utils/cash-tender';
import { deviceApi } from '@/lib/api-client';
import { useFormatPrice } from '@/hooks/use-format-price';
import { CashPaymentModal } from './cash-payment-modal';
import { PosPortal } from './pos-portal';
import { PosSheet, usePosSheetClose } from './pos-sheet';
import { SumUpCheckoutModal } from './sumup-checkout-modal';
import { useDeviceIntegrationEnabled } from '@/hooks/use-device-integration';
import type { Order, OrderItem } from '@/types/order';
import type { PaymentMethod } from '@/types/payment';

interface SplitPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UnpaidItem {
  orderId: string;
  orderNumber: string;
  dailyNumber?: number;
  tableNumber?: string | null;
  item: OrderItem;
  unpaidQuantity: number;
}

type GroupBy = 'order' | 'category';

export function SplitPaymentModal({ isOpen, onClose }: SplitPaymentModalProps) {
  const t = useTranslations('pos.splitPayment');
  const tUi = useTranslations('deviceUi.common');
  const tTabs = useTranslations('pos.openTabs');
  const formatCurrency = useFormatPrice();
  const queryClient = useQueryClient();

  const [selections, setSelections] = useState<Record<string, number>>({});
  const [showCashModal, setShowCashModal] = useState(false);
  const [showSumupModal, setShowSumupModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('order');
  const { settings } = useDeviceStore();
  const hasSumupReader = !!settings?.sumupReaderId;
  // Der SumUp-Leser wird nur angesprochen, solange die Integration an ist.
  // Ohne sie bleibt die Kartenzahlung als manuelle Buchung (externes
  // Terminal) — die gab es hier schon immer, und sie hat mit SumUp nichts
  // zu tun.
  const sumupEnabled = useDeviceIntegrationEnabled('sumup');
  const useSumupReader = hasSumupReader && sumupEnabled;

  // Fetch all open orders
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['device-open-tabs'],
    queryFn: () => deviceApi.getOpenOrders(),
    enabled: isOpen,
  });

  const orders = ordersData?.data || [];

  // Build flat list of unpaid items from all orders
  const unpaidItems: UnpaidItem[] = useMemo(() => {
    const result: UnpaidItem[] = [];

    for (const order of orders) {
      if (!order.items) continue;

      for (const item of order.items) {
        const unpaidQty = item.quantity - (item.paidQuantity || 0);
        if (unpaidQty <= 0) continue;
        if (item.status === 'cancelled') continue;

        result.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          dailyNumber: order.dailyNumber,
          tableNumber: order.tableNumber,
          item,
          unpaidQuantity: unpaidQty,
        });
      }
    }

    return result;
  }, [orders]);

  // Group unpaid items by order for display
  const groupedByOrder = useMemo(() => {
    const groups: Record<string, { order: Order; items: UnpaidItem[] }> = {};
    for (const ui of unpaidItems) {
      if (!groups[ui.orderId]) {
        const order = orders.find((o) => o.id === ui.orderId)!;
        groups[ui.orderId] = { order, items: [] };
      }
      groups[ui.orderId].items.push(ui);
    }
    return Object.values(groups);
  }, [unpaidItems, orders]);

  // Group unpaid items by category for display
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, { categoryName: string; items: UnpaidItem[] }> = {};
    for (const ui of unpaidItems) {
      const catName = ui.item.categoryName || t('uncategorized');
      if (!groups[catName]) {
        groups[catName] = { categoryName: catName, items: [] };
      }
      groups[catName].items.push(ui);
    }
    return Object.values(groups).sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }, [unpaidItems, t]);

  // Calculate selected total
  const selectedTotal = useMemo(() => {
    return unpaidItems.reduce((total, ui) => {
      const selectedQty = selections[ui.item.id] || 0;
      const itemPrice = Number(ui.item.unitPrice) + Number(ui.item.optionsPrice || 0);
      return total + itemPrice * selectedQty;
    }, 0);
  }, [unpaidItems, selections]);

  // Calculate total remaining across all orders
  const totalRemaining = useMemo(() => {
    return orders.reduce((total, order) => {
      return total + (Number(order.total) - Number(order.paidAmount || 0));
    }, 0);
  }, [orders]);

  const hasSelection = selectedTotal > 0;

  const handleQuantityChange = (itemId: string, delta: number) => {
    setSelections((prev) => {
      const ui = unpaidItems.find((u) => u.item.id === itemId);
      if (!ui) return prev;

      const current = prev[itemId] || 0;
      const newQty = Math.max(0, Math.min(ui.unpaidQuantity, current + delta));

      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [itemId]: newQty };
    });
  };

  const handleSelectAll = () => {
    const allSelections: Record<string, number> = {};
    unpaidItems.forEach((ui) => {
      allSelections[ui.item.id] = ui.unpaidQuantity;
    });
    setSelections(allSelections);
  };

  const handleSelectAllCategory = (categoryItems: UnpaidItem[]) => {
    setSelections((prev) => {
      const next = { ...prev };
      for (const ui of categoryItems) {
        next[ui.item.id] = ui.unpaidQuantity;
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelections({});
  };

  // Group selected items by orderId for payment
  const getSelectedByOrder = () => {
    const byOrder: Record<string, { orderId: string; items: { orderItemId: string; quantity: number }[]; amount: number }> = {};

    for (const ui of unpaidItems) {
      const selectedQty = selections[ui.item.id] || 0;
      if (selectedQty <= 0) continue;

      if (!byOrder[ui.orderId]) {
        byOrder[ui.orderId] = { orderId: ui.orderId, items: [], amount: 0 };
      }

      const itemPrice = Number(ui.item.unitPrice) + Number(ui.item.optionsPrice || 0);
      byOrder[ui.orderId].items.push({
        orderItemId: ui.item.id,
        quantity: selectedQty,
      });
      byOrder[ui.orderId].amount += itemPrice * selectedQty;
    }

    return Object.values(byOrder);
  };

  const paySelectedItems = useMutation({
    mutationFn: async ({
      paymentMethod,
      amountReceived,
    }: { paymentMethod: PaymentMethod; amountReceived?: number }) => {
      const orderPayments = getSelectedByOrder();

      // Create split payment for each order
      const amounts = orderPayments.map((op) => op.amount);
      for (const [index, op] of orderPayments.entries()) {
        const received =
          paymentMethod === 'cash' ? amountReceivedFor(index, amounts, amountReceived) : undefined;
        await deviceApi.createSplitPayment({
          orderId: op.orderId,
          amount: op.amount,
          paymentMethod,
          items: op.items,
          ...(received !== undefined ? { amountReceived: received } : {}),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-open-tabs'] });
      queryClient.invalidateQueries({ queryKey: ['device-orders'] });
      queryClient.invalidateQueries({ queryKey: ['device-order-history'] });
      setSelections({});
      setShowCashModal(false);
      onClose();
    },
  });

  const handlePay = async (paymentMethod: PaymentMethod, amountReceived?: number) => {
    if (!hasSelection) return;

    setIsProcessing(true);
    try {
      await paySelectedItems.mutateAsync({ paymentMethod, amountReceived });
    } catch (error) {
      console.error('Split payment failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const { closing, close } = usePosSheetClose(isOpen, onClose);

  const handleCashClick = () => {
    if (!hasSelection) return;
    setShowCashModal(true);
  };

  const handleCashConfirm = (amountReceived: number) => {
    handlePay('cash', amountReceived);
  };

  const renderItemRow = (ui: UnpaidItem) => {
    const selectedQty = selections[ui.item.id] || 0;
    const isSelected = selectedQty > 0;
    const itemPrice = Number(ui.item.unitPrice) + Number(ui.item.optionsPrice || 0);

    return (
      <div
        key={ui.item.id}
        className="pos-card"
        data-selected={isSelected || undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 8px 8px 14px' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--pos-ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {ui.item.productName}
          </div>
          <div className="pos-mono" style={{ fontSize: 12, color: 'var(--pos-ink-3)' }}>
            {formatCurrency(itemPrice)} × {ui.unpaidQuantity} {t('open')}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            className="pos-qty-btn"
            onClick={() => handleQuantityChange(ui.item.id, -1)}
            disabled={selectedQty === 0}
            aria-label={tUi('decrease')}
          >
            <Minus />
          </button>
          <span
            className="pos-mono"
            style={{ minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: 700, color: 'var(--pos-ink)' }}
          >
            {selectedQty}
          </span>
          <button
            type="button"
            className="pos-qty-btn"
            onClick={() => handleQuantityChange(ui.item.id, 1)}
            disabled={selectedQty >= ui.unpaidQuantity}
            aria-label={tUi('increase')}
          >
            <Plus />
          </button>
        </div>
      </div>
    );
  };

  const groupLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--pos-ink-3)',
  };

  const hasItems = !isLoading && unpaidItems.length > 0;

  return (
    <>
      {isOpen && (
        <PosSheet
          closing={closing}
          onClose={close}
          title={t('title')}
          subtitle={
            hasItems ? (
              <>
                {orders.length} {tTabs('orders', { count: orders.length })} · {t('remaining')}{' '}
                <strong className="pos-mono">{formatCurrency(totalRemaining)}</strong>
              </>
            ) : undefined
          }
          toolbar={
            hasItems ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="pos-seg" role="group" aria-label={t('selectItems')}>
                  <button type="button" aria-pressed={groupBy === 'order'} onClick={() => setGroupBy('order')}>
                    {t('groupByOrder')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={groupBy === 'category'}
                    onClick={() => setGroupBy('category')}
                  >
                    {t('groupByCategory')}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pos-ink-2)' }}>{t('selectItems')}</span>
                  <span style={{ display: 'flex', margin: '-10px -8px' }}>
                    <button
                      type="button"
                      className="pos-link pos-link--muted"
                      onClick={handleClearSelection}
                      disabled={!hasSelection}
                    >
                      {t('clearSelection')}
                    </button>
                    <button type="button" className="pos-link" onClick={handleSelectAll}>
                      {t('selectAll')}
                    </button>
                  </span>
                </div>
              </div>
            ) : undefined
          }
          footer={
            hasItems ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pos-ink)' }}>{t('selectedAmount')}</span>
                  <span
                    className="pos-mono"
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: hasSelection ? 'var(--pos-accent-ink)' : 'var(--pos-ink-3)',
                    }}
                  >
                    {formatCurrency(selectedTotal)}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    className="pos-btn pos-btn--secondary"
                    onClick={handleCashClick}
                    disabled={!hasSelection || isProcessing}
                  >
                    <BankNote01 />
                    {t('payCash')}
                  </button>
                  <button
                    type="button"
                    className="pos-btn pos-btn--primary"
                    onClick={() => {
                      if (useSumupReader) {
                        setShowSumupModal(true);
                      } else {
                        handlePay('card');
                      }
                    }}
                    disabled={!hasSelection || isProcessing}
                  >
                    <CreditCard01 />
                    {t('payCard')}
                  </button>
                </div>
              </div>
            ) : undefined
          }
          bodyStyle={{ gap: 16 }}
        >
          {isLoading ? (
            <div className="pos-sheet-empty">
              <div className="pos-spinner" />
            </div>
          ) : unpaidItems.length === 0 ? (
            <div className="pos-sheet-empty">
              {t('remaining')}: {formatCurrency(0)}
            </div>
          ) : groupBy === 'order' ? (
            groupedByOrder.map(({ order, items }) => (
              <section key={order.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="pos-mono" style={groupLabel}>
                    #{order.dailyNumber || order.orderNumber}
                  </span>
                  {order.tableNumber && (
                    <span style={{ fontSize: 12, color: 'var(--pos-ink-3)' }}>
                      {t('table')} {order.tableNumber}
                    </span>
                  )}
                </div>
                {items.map(renderItemRow)}
              </section>
            ))
          ) : (
            groupedByCategory.map(({ categoryName, items }) => (
              <section key={categoryName} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={groupLabel}>{categoryName}</span>
                  <button
                    type="button"
                    className="pos-link"
                    style={{ margin: '-10px -8px -10px 0' }}
                    onClick={() => handleSelectAllCategory(items)}
                  >
                    {t('selectAllCategory')}
                  </button>
                </div>
                {items.map(renderItemRow)}
              </section>
            ))
          )}
        </PosSheet>
      )}

      {/* Bar und Karte liegen ueber der Auswahl */}
      <CashPaymentModal
        isOpen={showCashModal}
        onClose={() => setShowCashModal(false)}
        total={selectedTotal}
        onConfirm={handleCashConfirm}
        isProcessing={isProcessing}
      />
      <PosPortal>
        <SumUpCheckoutModal
          isOpen={showSumupModal}
          onClose={() => setShowSumupModal(false)}
          amount={selectedTotal}
          onSuccess={() => {
            setShowSumupModal(false);
            handlePay('sumup_terminal' as PaymentMethod);
          }}
        />
      </PosPortal>
    </>
  );
}

