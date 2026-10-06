'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, EmptyState, Icon, Segment, Spinner, type BadgeTone } from '@openeos/ui';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useFormatPrice } from '@/hooks/use-format-price';
import { deviceApi } from '@/lib/api-client';
import type { Order } from '@/types/order';
import { PosSheet } from './pos-sheet';
import { usePosToast } from './pos-toast';

type StatusFilter = 'all' | 'open' | 'completed' | 'cancelled';

interface OrderHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string | null;
}

const STATUS_TONE: Record<string, BadgeTone | undefined> = {
  open: 'warn',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'danger',
};

const PAYMENT_TONE: Record<string, BadgeTone | undefined> = {
  unpaid: 'outline',
  partly_paid: 'warn',
  paid: 'success',
  refunded: 'danger',
};

const STATUS_KEY: Record<string, string> = {
  open: 'statusOpen',
  in_progress: 'statusInProgress',
  completed: 'statusCompleted',
  cancelled: 'statusCancelled',
};

const PAYMENT_KEY: Record<string, string> = {
  unpaid: 'paymentUnpaid',
  partly_paid: 'paymentPartlyPaid',
  paid: 'paymentPaid',
  refunded: 'paymentRefunded',
};

/**
 * Bestellverlauf der aktiven Veranstaltung: Filter, Nachdruck von Küchen-
 * und Kassenbon, Storno mit Grund. Jede Aktion meldet sich mit einem Hinweis.
 */
export function OrderHistoryDrawer({ isOpen, onClose, eventId }: OrderHistoryDrawerProps) {
  const t = useTranslations('pos.orderHistory');
  const tCancel = useTranslations('pos.sumupCheckout');
  const formatPrice = useFormatPrice();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const toast = usePosToast();
  const apiErrorMessage = useApiErrorMessage();

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['device-order-history', eventId, filter],
    queryFn: () =>
      deviceApi.getAllOrders({
        status: filter === 'all' ? undefined : filter,
        eventId: eventId ?? undefined,
        limit: 50,
      }),
    enabled: isOpen,
    refetchInterval: isOpen ? 15000 : false,
  });
  const orders: Order[] = data?.data || [];

  const cancelMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) =>
      deviceApi.cancelOrder(orderId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-order-history'] });
      queryClient.invalidateQueries({ queryKey: ['device-open-tabs'] });
      setConfirmCancel(false);
      setReason('');
      toast(t('cancelSuccess'));
    },
    onError: (error) => toast(apiErrorMessage(error), 'danger'),
  });

  const reprintMutation = useMutation({
    mutationFn: ({ orderId, type }: { orderId: string; type: 'tickets' | 'receipt' }) =>
      deviceApi.reprintOrder(orderId, type),
    onSuccess: () => toast(t('reprintSuccess')),
    onError: (error) => toast(apiErrorMessage(error), 'danger'),
  });

  const time = (value: string) =>
    new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const select = (id: string | null) => {
    setSelectedId(id);
    setConfirmCancel(false);
    setReason('');
  };

  return (
    <PosSheet
      open={isOpen}
      onClose={onClose}
      size="wide"
      icon="clock"
      title={t('title')}
      toolbar={
        <Segment<StatusFilter>
          aria-label={t('title')}
          size="lg"
          value={filter}
          onChange={(id) => {
            setFilter(id);
            select(null);
          }}
          options={[
            { id: 'all', label: t('filterAll') },
            { id: 'open', label: t('filterOpen') },
            { id: 'completed', label: t('filterCompleted') },
            { id: 'cancelled', label: t('filterCancelled') },
          ]}
        />
      }
    >
      {isLoading ? (
        <div className="pos-center">
          <Spinner />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState icon={<Icon name="receipt" />} title={t('noOrders')} description={t('noOrdersDescription')} />
      ) : (
        <ul className="pos-list">
          {orders.map((order) => {
            const open = selectedId === order.id;
            const canCancel = order.status !== 'completed' && order.status !== 'cancelled';
            return (
              <li key={order.id} className={open ? 'pos-hist is-open' : 'pos-hist'}>
                <button
                  type="button"
                  className="pos-hist__hd"
                  aria-expanded={open}
                  onClick={() => select(open ? null : order.id)}
                >
                  <span className="pos-hist__main">
                    <span className="pos-hist__badges">
                      <b>#{order.dailyNumber || order.orderNumber}</b>
                      <Badge tone={STATUS_TONE[order.status]}>
                        {STATUS_KEY[order.status] ? t(STATUS_KEY[order.status]) : order.status}
                      </Badge>
                      <Badge tone={PAYMENT_TONE[order.paymentStatus]}>
                        {PAYMENT_KEY[order.paymentStatus] ? t(PAYMENT_KEY[order.paymentStatus]) : order.paymentStatus}
                      </Badge>
                    </span>
                    {order.tableNumber && (
                      <small>
                        {t('table')} {order.tableNumber}
                      </small>
                    )}
                  </span>
                  <span className="pos-hist__sum">
                    <b>{formatPrice(Number(order.total))}</b>
                    <small>{time(order.createdAt)}</small>
                  </span>
                  <Icon name={open ? 'chevron-up' : 'chevron-down'} />
                </button>

                {open && (
                  <div className="pos-hist__body">
                    {order.items?.length > 0 && (
                      <ul className="pos-hist__items">
                        {order.items.slice(0, 8).map((item, index) => (
                          <li key={index} className={item.status === 'cancelled' ? 'is-cancelled' : undefined}>
                            <span>
                              {item.quantity}x {item.productName}
                            </span>
                            <span>{formatPrice(Number(item.totalPrice))}</span>
                          </li>
                        ))}
                        {order.items.length > 8 && (
                          <li className="is-more">
                            +{order.items.length - 8} {t('moreItems')}
                          </li>
                        )}
                      </ul>
                    )}

                    {confirmCancel ? (
                      <div className="pos-confirm">
                        <p>
                          <Icon name="alert" />
                          {t('cancelConfirm')}
                        </p>
                        <input
                          className="oe-input"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder={t('cancelReason')}
                          aria-label={t('cancelReason')}
                        />
                        <div className="pos-row">
                          <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
                            {tCancel('cancel')}
                          </Button>
                          <Button
                            variant="danger"
                            className="oe-grow"
                            loading={cancelMutation.isPending}
                            onClick={() =>
                              cancelMutation.mutate({ orderId: order.id, reason: reason || undefined })
                            }
                          >
                            {!cancelMutation.isPending && <Icon name="undo" />}
                            {t('confirmCancel')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="pos-row pos-row--wrap">
                        <Button
                          variant="secondary"
                          disabled={reprintMutation.isPending}
                          onClick={() => reprintMutation.mutate({ orderId: order.id, type: 'tickets' })}
                        >
                          <Icon name="printer" />
                          {t('reprintTickets')}
                        </Button>
                        {order.paymentStatus === 'paid' && (
                          <Button
                            variant="secondary"
                            disabled={reprintMutation.isPending}
                            onClick={() => reprintMutation.mutate({ orderId: order.id, type: 'receipt' })}
                          >
                            <Icon name="receipt" />
                            {t('reprintReceipt')}
                          </Button>
                        )}
                        {canCancel && (
                          <Button variant="danger-quiet" onClick={() => setConfirmCancel(true)}>
                            <Icon name="undo" />
                            {t('cancelOrder')}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PosSheet>
  );
}
