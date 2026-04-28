'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Expand06, XClose, Check } from '@untitledui/icons';
import {
  useProductionStationsLive,
  useMarkStationItemReady,
} from '@/hooks/use-production-stations';
import { ModalOverlay, Modal, Dialog } from '@/components/ui/modal/modal';
import { cx } from '@/utils/cx';

interface StationLivePreviewProps {
  eventId: string;
  organizationId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatElapsed(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function getTimerColorClass(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = diff / 60000;
  if (minutes > 15) return 'text-error-primary';
  if (minutes > 5) return 'text-warning-primary';
  return 'text-success-primary';
}

function getPriorityBadge(priority: string) {
  if (priority === 'rush') {
    return (
      <span className="rounded-full bg-error-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase text-error-primary">
        RUSH
      </span>
    );
  }
  if (priority === 'high') {
    return (
      <span className="rounded-full bg-warning-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase text-warning-primary">
        HIGH
      </span>
    );
  }
  return null;
}

/** Live timer that ticks every second */
function LiveTimer({ createdAt }: { createdAt: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className={cx('font-mono text-xs', getTimerColorClass(createdAt))}>
      {formatElapsed(createdAt)}
    </span>
  );
}

// Inferred type from the API response
type StationLiveData = Awaited<
  ReturnType<typeof import('@/lib/api-client').productionStationsApi.getLive>
>['data'][number];

type StationOrder = StationLiveData['orders'][number];

const MAX_PREVIEW_ORDERS = 3;

// ── Mini Order Row (compact, for the sidebar card) ──────────────────

function MiniOrderRow({ entry }: { entry: StationOrder }) {
  const t = useTranslations('productionStations.live');
  const { order, items } = entry;
  const summary = items.map((i) => `${i.quantity}x ${i.productName}`).join(', ');

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
      <span className="font-semibold text-primary">#{order.dailyNumber}</span>
      {order.tableNumber && (
        <>
          <span className="text-quaternary">&middot;</span>
          <span className="text-tertiary">
            {t('table')} {order.tableNumber}
          </span>
        </>
      )}
      <span className="text-quaternary">&middot;</span>
      <LiveTimer createdAt={order.createdAt} />
      <span className="ml-auto truncate text-secondary">{summary}</span>
    </div>
  );
}

// ── Full Order Card (for the fullscreen modal) ──────────────────────

function FullOrderCard({
  entry,
  organizationId,
  eventId,
}: {
  entry: StationOrder;
  organizationId: string;
  eventId: string;
}) {
  const t = useTranslations('productionStations.live');
  const markReady = useMarkStationItemReady(eventId);
  const { order, items } = entry;

  return (
    <div className="flex flex-col rounded-xl border border-secondary bg-primary shadow-xs">
      {/* Order header */}
      <div className="flex items-center gap-2 border-b border-secondary px-4 py-3">
        <span className="text-base font-bold text-primary">#{order.dailyNumber}</span>
        {order.tableNumber && (
          <span className="text-sm text-tertiary">
            {t('table')} {order.tableNumber}
          </span>
        )}
        {order.customerName && (
          <span className="text-sm text-secondary">{order.customerName}</span>
        )}
        {getPriorityBadge(order.priority)}
        <div className="ml-auto">
          <LiveTimer createdAt={order.createdAt} />
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-secondary">
        {items.map((item) => {
          const isReady = item.status === 'ready' || item.status === 'delivered';
          return (
            <div
              key={item.id}
              className={cx(
                'flex items-center gap-3 px-4 py-2.5',
                isReady && 'opacity-50',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-primary">
                    {item.quantity}x
                  </span>
                  <span className={cx('text-sm', isReady ? 'text-tertiary line-through' : 'text-primary')}>
                    {item.productName}
                  </span>
                </div>
              </div>
              {!isReady && (
                <button
                  type="button"
                  onClick={() =>
                    markReady.mutate({
                      organizationId,
                      orderId: order.id,
                      itemId: item.id,
                    })
                  }
                  disabled={markReady.isPending}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-success-secondary px-2.5 py-1.5 text-xs font-semibold text-success-primary transition-colors hover:bg-success-primary hover:text-white disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {t('ready')}
                </button>
              )}
              {isReady && (
                <span className="text-xs font-medium text-success-primary">
                  <Check className="inline h-3.5 w-3.5" /> {t('ready')}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Fullscreen Modal ────────────────────────────────────────────────

function StationFullscreenModal({
  station,
  organizationId,
  eventId,
  onClose,
}: {
  station: StationLiveData;
  organizationId: string;
  eventId: string;
  onClose: () => void;
}) {
  const t = useTranslations('productionStations.live');

  return (
    <ModalOverlay isOpen onOpenChange={(open) => !open && onClose()} isDismissable>
      <Modal className="sm:max-w-7xl">
        <Dialog>
          <div className="flex max-h-[90vh] w-full flex-col rounded-xl border border-secondary bg-primary shadow-xl">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-secondary px-6 py-4">
              <div className="flex items-center gap-3">
                {station.color && (
                  <div
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ backgroundColor: station.color }}
                  />
                )}
                <h2 className="text-lg font-semibold text-primary">{station.name}</h2>
                <span className="rounded-full bg-brand-secondary px-2 py-0.5 text-xs font-semibold text-brand-primary">
                  {station.orders.length} {t('orders')}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-tertiary transition-colors hover:bg-secondary hover:text-secondary"
                aria-label="Close"
              >
                <XClose className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {station.orders.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-tertiary">{t('noOrders')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {station.orders.map((entry) => (
                    <FullOrderCard
                      key={entry.order.id}
                      entry={entry}
                      organizationId={organizationId}
                      eventId={eventId}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export function StationLivePreview({ eventId, organizationId }: StationLivePreviewProps) {
  const t = useTranslations('productionStations.live');
  const { data: stations, isLoading } = useProductionStationsLive(eventId);
  const [openStationId, setOpenStationId] = useState<string | null>(null);

  const openStation = stations?.find((s) => s.id === openStationId) ?? null;

  if (isLoading) {
    return (
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-secondary">{t('title')}</h3>
        <div className="flex items-center justify-center rounded-xl border border-secondary bg-primary py-8 shadow-xs">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!stations || stations.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="mb-3 text-sm font-semibold text-secondary">{t('title')}</h3>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {stations.map((station) => {
          const orderCount = station.orders.length;
          const previewOrders = station.orders.slice(0, MAX_PREVIEW_ORDERS);
          const remaining = orderCount - MAX_PREVIEW_ORDERS;

          return (
            <div
              key={station.id}
              className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  {station.color && (
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: station.color }}
                    />
                  )}
                  <span className="text-sm font-semibold text-primary">{station.name}</span>
                  {orderCount > 0 && (
                    <span className="rounded-full bg-brand-secondary px-2 py-0.5 text-xs font-semibold text-brand-primary">
                      {orderCount}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpenStationId(station.id)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-tertiary transition-colors hover:bg-secondary hover:text-primary"
                >
                  <Expand06 className="h-3.5 w-3.5" />
                  {t('openFullView')}
                </button>
              </div>

              {/* Compact order list */}
              {orderCount === 0 ? (
                <div className="border-t border-secondary px-4 py-3">
                  <p className="text-xs text-tertiary">{t('noOrders')}</p>
                </div>
              ) : (
                <div className="border-t border-secondary divide-y divide-secondary">
                  {previewOrders.map((entry) => (
                    <MiniOrderRow key={entry.order.id} entry={entry} />
                  ))}
                  {remaining > 0 && (
                    <div className="px-3 py-1.5 text-xs text-tertiary">
                      {t('moreOrders', { count: remaining })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fullscreen modal */}
      {openStation && (
        <StationFullscreenModal
          station={openStation}
          organizationId={organizationId}
          eventId={eventId}
          onClose={() => setOpenStationId(null)}
        />
      )}
    </div>
  );
}
