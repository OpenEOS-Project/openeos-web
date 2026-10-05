'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, Printer, XCircle, AlertCircle } from '@untitledui/icons';
import { deviceApi } from '@/lib/api-client';
import { useFormatPrice } from '@/hooks/use-format-price';
import type { Order } from '@/types/order';
import { PosSheet, usePosSheetClose } from './pos-sheet';

type StatusFilter = 'all' | 'open' | 'completed' | 'cancelled';

interface OrderHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const statusToQuery: Record<StatusFilter, string | undefined> = {
  all: undefined,
  open: 'open',
  completed: 'completed',
  cancelled: 'cancelled',
};

const statusTone: Record<string, string> = {
  open: 'warn',
  in_progress: 'accent',
  completed: 'ok',
  cancelled: 'danger',
};

const paymentTone: Record<string, string> = {
  unpaid: 'neutral',
  partly_paid: 'warn',
  paid: 'ok',
  refunded: 'danger',
};

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const labels: Record<string, string> = {
    open: t('statusOpen'),
    in_progress: t('statusInProgress'),
    completed: t('statusCompleted'),
    cancelled: t('statusCancelled'),
  };

  return (
    <span className="pos-badge" data-tone={statusTone[status]}>
      {labels[status] || status}
    </span>
  );
}

function PaymentBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const labels: Record<string, string> = {
    unpaid: t('paymentUnpaid'),
    partly_paid: t('paymentPartlyPaid'),
    paid: t('paymentPaid'),
    refunded: t('paymentRefunded'),
  };

  return (
    <span className="pos-badge" data-tone={paymentTone[status]}>
      {labels[status] || status}
    </span>
  );
}

export function OrderHistoryDrawer({ isOpen, onClose }: OrderHistoryDrawerProps) {
  const t = useTranslations('pos.orderHistory');
  // "Abbrechen" — der Text steht schon beim Kartenzahlungs-Dialog.
  const tCancel = useTranslations('pos.sumupCheckout');
  const formatCurrency = useFormatPrice();
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['device-order-history', statusFilter],
    queryFn: () => deviceApi.getAllOrders({
      status: statusToQuery[statusFilter],
      limit: 50,
    }),
    enabled: isOpen,
    refetchInterval: 15000,
  });

  const orders = ordersData?.data || [];

  const cancelMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason?: string }) => {
      return deviceApi.cancelOrder(orderId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-order-history'] });
      queryClient.invalidateQueries({ queryKey: ['device-open-tabs'] });
      setSelectedOrder(null);
      setShowCancelConfirm(false);
      setCancelReason('');
    },
  });

  const reprintMutation = useMutation({
    mutationFn: async ({ orderId, type }: { orderId: string; type: 'tickets' | 'receipt' }) => {
      return deviceApi.reprintOrder(orderId, type);
    },
  });

  const { closing, close } = usePosSheetClose(isOpen, onClose);

  const handleCancel = () => {
    if (!selectedOrder) return;
    cancelMutation.mutate({
      orderId: selectedOrder.id,
      reason: cancelReason || undefined,
    });
  };

  const handleReprint = (type: 'tickets' | 'receipt') => {
    if (!selectedOrder) return;
    reprintMutation.mutate({ orderId: selectedOrder.id, type });
  };

  const canCancel = (order: Order) =>
    order.status !== 'completed' && order.status !== 'cancelled';

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('filterAll') },
    { key: 'open', label: t('filterOpen') },
    { key: 'completed', label: t('filterCompleted') },
    { key: 'cancelled', label: t('filterCancelled') },
  ];

  if (!isOpen) return null;

  return (
    <PosSheet
      closing={closing}
      onClose={close}
      title={t('title')}
      toolbar={
        <div className="pos-chips pos-scroll">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              className="pos-chip"
              aria-pressed={statusFilter === f.key}
              onClick={() => {
                setStatusFilter(f.key);
                setSelectedOrder(null);
                setShowCancelConfirm(false);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      }
      bodyStyle={{ gap: 8 }}
    >
      {isLoading ? (
        <div className="pos-sheet-empty">
          <div className="pos-spinner" />
        </div>
      ) : orders.length === 0 ? (
        <div className="pos-sheet-empty">
          <Receipt />
          <strong>{t('noOrders')}</strong>
          <span>{t('noOrdersDescription')}</span>
        </div>
      ) : (
        orders.map((order) => {
          const isSelected = selectedOrder?.id === order.id;

          return (
            <div key={order.id} className="pos-card" data-selected={isSelected || undefined}>
              {/* Kopf der Karte klappt die Details auf. Die Aktionen liegen
                  daneben, nicht darin — Knoepfe in Knoepfen gehen nicht. */}
              <button
                type="button"
                aria-expanded={isSelected}
                onClick={() => {
                  setSelectedOrder(isSelected ? null : order);
                  setShowCancelConfirm(false);
                  setCancelReason('');
                }}
                style={{
                  width: '100%',
                  minHeight: 56,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--pos-r-md)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--pos-ink)',
                }}
              >
                <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                    <span className="pos-mono" style={{ fontSize: 15, fontWeight: 700, marginRight: 2 }}>
                      #{order.dailyNumber || order.orderNumber}
                    </span>
                    <StatusBadge status={order.status} t={t} />
                    <PaymentBadge status={order.paymentStatus} t={t} />
                  </span>
                  {order.tableNumber && (
                    <span style={{ fontSize: 12, color: 'var(--pos-ink-3)' }}>
                      {t('table')} {order.tableNumber}
                    </span>
                  )}
                </span>
                <span style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span className="pos-mono" style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>
                    {formatCurrency(Number(order.total))}
                  </span>
                  <span className="pos-mono" style={{ display: 'block', fontSize: 12, color: 'var(--pos-ink-3)' }}>
                    {formatTime(order.createdAt)}
                  </span>
                </span>
              </button>

              {isSelected && (
                <div style={{ margin: '0 14px', padding: '12px 0 14px', borderTop: '1px solid var(--pos-line)' }}>
                  {order.items && order.items.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
                      {order.items.slice(0, 8).map((item, idx) => (
                        <div
                          key={idx}
                          style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}
                        >
                          <span
                            style={{
                              minWidth: 0,
                              color: item.status === 'cancelled' ? 'var(--pos-ink-3)' : 'var(--pos-ink-2)',
                              textDecoration: item.status === 'cancelled' ? 'line-through' : undefined,
                            }}
                          >
                            {item.quantity}× {item.productName}
                          </span>
                          <span className="pos-mono" style={{ flexShrink: 0, color: 'var(--pos-ink)' }}>
                            {formatCurrency(Number(item.totalPrice))}
                          </span>
                        </div>
                      ))}
                      {order.items.length > 8 && (
                        <span style={{ fontSize: 12, color: 'var(--pos-ink-3)' }}>
                          +{order.items.length - 8} {t('moreItems')}
                        </span>
                      )}
                    </div>
                  )}

                  {showCancelConfirm ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        padding: 12,
                        borderRadius: 'var(--pos-r-sm)',
                        border: '1px solid var(--pos-danger)',
                        background: 'var(--pos-surface-2)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, fontWeight: 600 }}>
                        <AlertCircle style={{ width: 20, height: 20, flexShrink: 0, color: 'var(--pos-danger)' }} />
                        {t('cancelConfirm')}
                      </div>
                      <input
                        type="text"
                        className="pos-input"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder={t('cancelReason')}
                        aria-label={t('cancelReason')}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="pos-btn pos-btn--sm pos-btn--danger"
                          style={{ flex: 1 }}
                          onClick={handleCancel}
                          disabled={cancelMutation.isPending}
                        >
                          {cancelMutation.isPending ? '…' : t('confirmCancel')}
                        </button>
                        <button
                          type="button"
                          className="pos-btn pos-btn--sm pos-btn--secondary"
                          onClick={() => {
                            setShowCancelConfirm(false);
                            setCancelReason('');
                          }}
                        >
                          {tCancel('cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button
                        type="button"
                        className="pos-btn pos-btn--sm pos-btn--secondary"
                        onClick={() => handleReprint('tickets')}
                        disabled={reprintMutation.isPending}
                      >
                        <Printer />
                        {t('reprintTickets')}
                      </button>
                      {order.paymentStatus === 'paid' && (
                        <button
                          type="button"
                          className="pos-btn pos-btn--sm pos-btn--secondary"
                          onClick={() => handleReprint('receipt')}
                          disabled={reprintMutation.isPending}
                        >
                          <Receipt />
                          {t('reprintReceipt')}
                        </button>
                      )}
                      {canCancel(order) && (
                        <button
                          type="button"
                          className="pos-btn pos-btn--sm pos-btn--danger-outline"
                          onClick={() => setShowCancelConfirm(true)}
                        >
                          <XCircle />
                          {t('cancelOrder')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </PosSheet>
  );
}
