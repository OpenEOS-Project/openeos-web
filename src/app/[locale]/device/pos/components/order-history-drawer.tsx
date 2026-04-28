'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, Printer, XCircle, AlertCircle } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { deviceApi } from '@/lib/api-client';
import { formatCurrency } from '@/utils/format';
import type { Order } from '@/types/order';

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

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const colors: Record<string, string> = {
    open: 'bg-warning-secondary text-warning-primary dark:text-white',
    in_progress: 'bg-brand-secondary text-brand-primary dark:text-white',
    completed: 'bg-success-secondary text-success-primary dark:text-white',
    cancelled: 'bg-error-secondary text-error-primary dark:text-white',
  };

  const labels: Record<string, string> = {
    open: t('statusOpen'),
    in_progress: t('statusInProgress'),
    completed: t('statusCompleted'),
    cancelled: t('statusCancelled'),
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || 'bg-secondary text-tertiary'}`}>
      {labels[status] || status}
    </span>
  );
}

function PaymentBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const colors: Record<string, string> = {
    unpaid: 'bg-secondary text-tertiary',
    partly_paid: 'bg-warning-secondary text-warning-primary dark:text-white',
    paid: 'bg-success-secondary text-success-primary dark:text-white',
    refunded: 'bg-error-secondary text-error-primary dark:text-white',
  };

  const labels: Record<string, string> = {
    unpaid: t('paymentUnpaid'),
    partly_paid: t('paymentPartlyPaid'),
    paid: t('paymentPaid'),
    refunded: t('paymentRefunded'),
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || 'bg-secondary text-tertiary'}`}>
      {labels[status] || status}
    </span>
  );
}

export function OrderHistoryDrawer({ isOpen, onClose }: OrderHistoryDrawerProps) {
  const t = useTranslations('pos.orderHistory');
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
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('filterAll') },
    { key: 'open', label: t('filterOpen') },
    { key: 'completed', label: t('filterCompleted') },
    { key: 'cancelled', label: t('filterCancelled') },
  ];

  return (
    <DialogModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('title')}
      size="lg"
    >
      <div className="p-6">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setStatusFilter(f.key);
                setSelectedOrder(null);
                setShowCancelConfirm(false);
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === f.key
                  ? 'bg-brand-solid text-white'
                  : 'bg-secondary text-tertiary hover:text-primary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Order List */}
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <Receipt className="h-12 w-12 text-tertiary mb-4" />
            <p className="text-lg font-medium text-primary">{t('noOrders')}</p>
            <p className="text-sm text-tertiary">{t('noOrdersDescription')}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {orders.map((order) => {
              const isSelected = selectedOrder?.id === order.id;

              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => {
                    setSelectedOrder(isSelected ? null : order);
                    setShowCancelConfirm(false);
                    setCancelReason('');
                  }}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-brand-primary bg-brand-primary_alt'
                      : 'border-secondary bg-primary hover:bg-secondary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-primary">
                        #{order.dailyNumber || order.orderNumber}
                      </p>
                      <StatusBadge status={order.status} t={t} />
                      <PaymentBadge status={order.paymentStatus} t={t} />
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">
                        {formatCurrency(Number(order.total))}
                      </p>
                      <p className="text-xs text-tertiary">
                        {formatTime(order.createdAt)}
                      </p>
                    </div>
                  </div>

                  {order.tableNumber && (
                    <p className="text-xs text-tertiary mt-1">
                      {t('table')} {order.tableNumber}
                    </p>
                  )}

                  {/* Selected: Show items and actions */}
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-secondary" onClick={(e) => e.stopPropagation()}>
                      {/* Items */}
                      {order.items && order.items.length > 0 && (
                        <div className="space-y-1 mb-3">
                          {order.items.slice(0, 8).map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className={`${item.status === 'cancelled' ? 'text-tertiary line-through' : 'text-tertiary'}`}>
                                {item.quantity}x {item.productName}
                              </span>
                              <span className="text-primary">
                                {formatCurrency(Number(item.totalPrice))}
                              </span>
                            </div>
                          ))}
                          {order.items.length > 8 && (
                            <p className="text-xs text-tertiary">
                              +{order.items.length - 8} {t('moreItems')}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Cancel Confirmation */}
                      {showCancelConfirm ? (
                        <div className="space-y-3 p-3 rounded-lg bg-error-secondary/50 border border-error-secondary">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-5 w-5 text-error-primary dark:text-white shrink-0 mt-0.5" />
                            <p className="text-sm font-medium text-error-primary dark:text-white">
                              {t('cancelConfirm')}
                            </p>
                          </div>
                          <input
                            type="text"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder={t('cancelReason')}
                            className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-quaternary focus:border-brand-primary focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <Button
                              color="primary-destructive"
                              size="sm"
                              className="flex-1"
                              onClick={handleCancel}
                              disabled={cancelMutation.isPending}
                            >
                              {cancelMutation.isPending ? '...' : t('confirmCancel')}
                            </Button>
                            <Button
                              color="tertiary"
                              size="sm"
                              onClick={() => {
                                setShowCancelConfirm(false);
                                setCancelReason('');
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* Action Buttons */
                        <div className="flex flex-wrap gap-2">
                          <Button
                            color="secondary"
                            size="sm"
                            iconLeading={Printer}
                            onClick={() => handleReprint('tickets')}
                            disabled={reprintMutation.isPending}
                          >
                            {t('reprintTickets')}
                          </Button>
                          {order.paymentStatus === 'paid' && (
                            <Button
                              color="secondary"
                              size="sm"
                              iconLeading={Receipt}
                              onClick={() => handleReprint('receipt')}
                              disabled={reprintMutation.isPending}
                            >
                              {t('reprintReceipt')}
                            </Button>
                          )}
                          {canCancel(order) && (
                            <Button
                              color="primary-destructive"
                              size="sm"
                              onClick={() => setShowCancelConfirm(true)}
                            >
                              {t('cancelOrder')}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </DialogModal>
  );
}
