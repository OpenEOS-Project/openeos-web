'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  useProductionStationsLive,
  useMarkStationItemReady,
} from '@/hooks/use-production-stations';
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

function getTimerColor(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = diff / 60000;
  if (minutes > 15) return '#d24545';
  if (minutes > 5) return '#d97706';
  return 'var(--green-ink)';
}

function getPriorityBadge(priority: string) {
  if (priority === 'rush') {
    return (
      <span className="badge badge--error" style={{ fontSize: 10, padding: '2px 6px', textTransform: 'uppercase', fontWeight: 700 }}>RUSH</span>
    );
  }
  if (priority === 'high') {
    return (
      <span className="badge badge--warning" style={{ fontSize: 10, padding: '2px 6px', textTransform: 'uppercase', fontWeight: 700 }}>HIGH</span>
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
    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: getTimerColor(createdAt) }}>
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

// ── Mini Order Row ────────────────────────────────────────────────────

function MiniOrderRow({ entry }: { entry: StationOrder }) {
  const t = useTranslations('productionStations.live');
  const { order, items } = entry;
  const summary = items.map((i) => `${i.quantity}x ${i.productName}`).join(', ');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', fontSize: 12 }}>
      <span style={{ fontWeight: 700, color: 'var(--ink)' }}>#{order.dailyNumber}</span>
      {order.tableNumber && (
        <>
          <span style={{ color: 'color-mix(in oklab, var(--ink) 35%, transparent)' }}>·</span>
          <span style={{ color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
            {t('table')} {order.tableNumber}
          </span>
        </>
      )}
      <span style={{ color: 'color-mix(in oklab, var(--ink) 35%, transparent)' }}>·</span>
      <LiveTimer createdAt={order.createdAt} />
      <span style={{ marginLeft: 'auto', color: 'color-mix(in oklab, var(--ink) 55%, transparent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {summary}
      </span>
    </div>
  );
}

// ── Full Order Card ───────────────────────────────────────────────────

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
    <div className="app-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Order header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
        padding: '10px 16px',
      }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>#{order.dailyNumber}</span>
        {order.tableNumber && (
          <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
            {t('table')} {order.tableNumber}
          </span>
        )}
        {order.customerName && (
          <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 65%, transparent)' }}>{order.customerName}</span>
        )}
        {getPriorityBadge(order.priority)}
        <div style={{ marginLeft: 'auto' }}>
          <LiveTimer createdAt={order.createdAt} />
        </div>
      </div>

      {/* Items */}
      <div>
        {items.map((item) => {
          const isReady = item.status === 'ready' || item.status === 'delivered';
          return (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)',
                opacity: isReady ? 0.5 : 1,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{item.quantity}x</span>
                  <span style={{
                    fontSize: 13,
                    textDecoration: isReady ? 'line-through' : 'none',
                    color: isReady ? 'color-mix(in oklab, var(--ink) 45%, transparent)' : 'var(--ink)',
                  }}>
                    {item.productName}
                  </span>
                </div>
              </div>
              {!isReady ? (
                <button
                  type="button"
                  onClick={() => markReady.mutate({ organizationId, orderId: order.id, itemId: item.id })}
                  disabled={markReady.isPending}
                  style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
                    padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: 'color-mix(in oklab, var(--green-ink) 10%, transparent)',
                    color: 'var(--green-ink)', border: 'none',
                    opacity: markReady.isPending ? 0.5 : 1,
                  }}
                >
                  ✓ {t('ready')}
                </button>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--green-ink)' }}>✓ {t('ready')}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Fullscreen Modal ──────────────────────────────────────────────────

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
    <div
      className="modal__overlay"
      style={{ alignItems: 'flex-start', padding: '5vh 20px' }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 1200, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--paper)', borderRadius: 16,
          border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
          boxShadow: '0 24px 64px color-mix(in oklab, var(--ink) 18%, transparent)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
          padding: '16px 24px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {station.color && (
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: station.color }} />
            )}
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{station.name}</h2>
            <span className="badge badge--info">
              {station.orders.length} {t('orders')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8,
              color: 'color-mix(in oklab, var(--ink) 45%, transparent)',
            }}
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {station.orders.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
              <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>{t('noOrders')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
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
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export function StationLivePreview({ eventId, organizationId }: StationLivePreviewProps) {
  const t = useTranslations('productionStations.live');
  const { data: stations, isLoading } = useProductionStationsLive(eventId);
  const [openStationId, setOpenStationId] = useState<string | null>(null);

  const openStation = stations?.find((s) => s.id === openStationId) ?? null;

  if (isLoading) {
    return (
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', marginBottom: 12 }}>
          {t('title')}
        </p>
        <div className="app-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            border: '2px solid var(--green-ink)', borderTopColor: 'transparent',
            animation: 'spin 0.75s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!stations || stations.length === 0) return null;

  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', marginBottom: 12 }}>
        {t('title')}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {stations.map((station) => {
          const orderCount = station.orders.length;
          const previewOrders = station.orders.slice(0, MAX_PREVIEW_ORDERS);
          const remaining = orderCount - MAX_PREVIEW_ORDERS;

          return (
            <div
              key={station.id}
              className="app-card"
              style={{ padding: 0, overflow: 'hidden' }}
            >
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {station.color && (
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: station.color, flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{station.name}</span>
                  {orderCount > 0 && (
                    <span className="badge badge--info" style={{ fontSize: 11 }}>{orderCount}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpenStationId(station.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                    color: 'color-mix(in oklab, var(--ink) 45%, transparent)', padding: '4px 6px', borderRadius: 6,
                  }}
                >
                  ⤢ {t('openFullView')}
                </button>
              </div>

              {/* Compact order list */}
              <div style={{ borderTop: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)' }}>
                {orderCount === 0 ? (
                  <div style={{ padding: '10px 14px' }}>
                    <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 40%, transparent)', margin: 0 }}>{t('noOrders')}</p>
                  </div>
                ) : (
                  <>
                    {previewOrders.map((entry) => (
                      <div key={entry.order.id} style={{ borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
                        <MiniOrderRow entry={entry} />
                      </div>
                    ))}
                    {remaining > 0 && (
                      <div style={{ padding: '6px 12px', fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>
                        {t('moreOrders', { count: remaining })}
                      </div>
                    )}
                  </>
                )}
              </div>
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
