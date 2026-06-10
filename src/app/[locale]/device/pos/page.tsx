'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Coins01, LogOut01, Power01 } from '@untitledui/icons';
import { useDeviceStore, useDeviceHydration } from '@/stores/device-store';
import { useCartStore } from '@/stores/cart-store';
import { useDeviceSocket, type BroadcastMessage } from '@/hooks/use-device-socket';
import { useCustomerDisplayBroadcast } from '@/hooks/use-customer-display-broadcast';
import { resolveChargePfand } from '@/utils/pfand';
import { deviceApi } from '@/lib/api-client';
import { PosProductGrid } from './components/pos-product-grid';
import { PosCart } from './components/device-pos-cart';
import { PosCategoryRail } from './components/pos-category-rail';
import { PosActiveEventBadge } from './components/pos-event-selector';
import { NumPad } from './components/num-pad';
import { OpenTabsDrawer } from './components/open-tabs-drawer';
import { OrderHistoryDrawer } from './components/order-history-drawer';
import { SplitPaymentModal } from './components/split-payment-modal';
import { BroadcastToast } from './components/broadcast-toast';
import { PinEntryScreen } from './components/pin-entry-screen';
import type { Event } from '@/types/event';
import type { Product } from '@/types/product';

interface ProductUpdatedPayload {
  product: {
    id: string;
    name: string;
    categoryId: string | null;
    price: number;
    isAvailable: boolean;
    isActive: boolean;
    stockQuantity?: number;
    trackInventory: boolean;
  };
  eventId: string;
}

interface ProductDeletedPayload {
  productId: string;
  eventId: string;
}

interface MenuRefreshPayload {
  eventId: string;
  reason: string;
}

// ─── Spinner ───────────────────────────────────────────────────────────────
function PosSpinner({ label }: { label?: string }) {
  return (
    <div className="pos-root" style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 32, height: 32, borderRadius: 999, border: '3px solid var(--pos-accent)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
      {label && <p style={{ fontSize: 13, color: 'var(--pos-ink-3)' }}>{label}</p>}
    </div>
  );
}

// ─── Table-number entry screen ──────────────────────────────────────────────
function TableEntryScreen({
  deviceName,
  organizationName,
  activeEvent,
  tableInput,
  setTableInput,
  onStart,
  broadcastMessages,
  onDismissBroadcast,
}: {
  deviceName: string;
  organizationName: string;
  activeEvent: Event | null;
  tableInput: string;
  setTableInput: (v: string) => void;
  onStart: () => void;
  broadcastMessages: BroadcastMessage[];
  onDismissBroadcast: (id: string) => void;
}) {
  const t = useTranslations('pos');
  return (
    <div className="pos-root" style={{ display: 'flex', height: '100dvh', flexDirection: 'column' }}>
      <BroadcastToast messages={broadcastMessages} onDismiss={onDismissBroadcast} />

      {/* Top bar */}
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', background: 'var(--pos-surface)', borderBottom: '1px solid var(--pos-line)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: 'var(--pos-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--pos-accent-contrast)', fontWeight: 700, fontSize: 12,
          }}>
            {(organizationName || 'POS').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--pos-ink)' }}>{deviceName}</div>
            <div style={{ fontSize: 11, color: 'var(--pos-ink-3)' }}>{organizationName}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PosActiveEventBadge event={activeEvent} />
        </div>
      </div>

      {/* Entry card */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px' }}>
        <div style={{
          width: '100%', maxWidth: 380,
          background: 'var(--pos-surface)', borderRadius: 'var(--pos-r-lg)',
          border: '1px solid var(--pos-line)', boxShadow: 'var(--pos-sh-2)',
          padding: 28, textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 999,
            background: 'var(--pos-accent-soft)', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          }}>
            🏷️
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--pos-ink)', marginBottom: 6 }}>
            {t('tableNumber.title')}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--pos-ink-3)', marginBottom: 20 }}>
            {t('tableNumber.description')}
          </p>

          {/* Display */}
          <div style={{
            marginBottom: 18,
            padding: '14px 20px',
            background: 'var(--pos-surface-2)',
            border: '1px solid var(--pos-line)',
            borderRadius: 'var(--pos-r-sm)',
          }}>
            <span className="pos-mono" style={{ fontSize: 36, fontWeight: 700, color: 'var(--pos-ink)' }}>
              {tableInput || '—'}
            </span>
          </div>

          <NumPad value={tableInput} onChange={setTableInput} maxLength={5} className="mb-4" />

          <button
            type="button"
            onClick={onStart}
            disabled={!tableInput.trim()}
            style={{
              width: '100%', padding: '14px',
              background: tableInput.trim() ? 'var(--pos-accent)' : 'var(--pos-line)',
              color: tableInput.trim() ? 'var(--pos-accent-contrast)' : 'var(--pos-ink-3)',
              border: 'none', borderRadius: 'var(--pos-r-sm)',
              fontSize: 15, fontWeight: 700, cursor: tableInput.trim() ? 'pointer' : 'not-allowed',
              marginTop: 12,
            }}
          >
            {t('tableNumber.start')}
          </button>
        </div>
      </div>
    </div>
  );
}

const topBtnStyle: React.CSSProperties = {
  padding: '7px 13px',
  background: 'var(--pos-surface)',
  border: '1px solid var(--pos-line)',
  borderRadius: 'var(--pos-r-sm)',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--pos-ink)',
  cursor: 'pointer',
};

// ─── Main POS layout ────────────────────────────────────────────────────────
export default function DevicePosPage() {
  const t = useTranslations('pos');
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasHydrated = useDeviceHydration();

  const {
    deviceId,
    deviceToken,
    status,
    organizationId,
    organizationName,
    deviceName,
    settings: deviceSettings,
    tableNumber,
    checkStatus,
    setTableNumber,
    clearSession,
    logout,
  } = useDeviceStore();

  const serviceMode = (deviceSettings?.serviceMode as string) || 'table';
  const { eventId, setEventId, clearCart, items } = useCartStore();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [tableInput, setTableInput] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOpenTabsOpen, setIsOpenTabsOpen] = useState(false);
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);
  const [isSplitPaymentOpen, setIsSplitPaymentOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [cartClosing, setCartClosing] = useState(false);
  const [cartDragY, setCartDragY] = useState(0);
  const [isCartDragging, setIsCartDragging] = useState(false);
  const cartDragRef = useRef<{ y: number; t: number; lastY: number; lastT: number } | null>(null);
  const [broadcastMessages, setBroadcastMessages] = useState<BroadcastMessage[]>([]);
  const [authenticatedUser, setAuthenticatedUser] = useState<{
    userId: string; firstName: string; lastName: string;
  } | null>(null);
  const [sentBanner, setSentBanner] = useState(false);

  const handleBroadcast = useCallback((message: BroadcastMessage) => {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setBroadcastMessages((prev) => [...prev, message]);
  }, []);

  const handleDismissBroadcast = useCallback((id: string) => {
    setBroadcastMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleProductUpdated = useCallback((data: unknown) => {
    const payload = data as ProductUpdatedPayload;
    if (!payload?.product?.id || payload.eventId !== eventId) return;
    queryClient.setQueryData(
      ['device-products', eventId],
      (old: { data: Product[] } | undefined) => {
        if (!old?.data) return old;
        const idx = old.data.findIndex((p) => p.id === payload.product.id);
        if (idx === -1) return old;
        const updated = [...old.data];
        updated[idx] = {
          ...updated[idx],
          name: payload.product.name,
          categoryId: payload.product.categoryId ?? updated[idx].categoryId,
          price: payload.product.price,
          isAvailable: payload.product.isAvailable,
          isActive: payload.product.isActive,
          stockQuantity: payload.product.stockQuantity ?? updated[idx].stockQuantity,
          trackInventory: payload.product.trackInventory,
        };
        return { ...old, data: updated };
      },
    );
  }, [eventId, queryClient]);

  const handleProductDeleted = useCallback((data: unknown) => {
    const payload = data as ProductDeletedPayload;
    if (!payload?.productId || payload.eventId !== eventId) return;
    queryClient.setQueryData(
      ['device-products', eventId],
      (old: { data: Product[] } | undefined) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((p) => p.id !== payload.productId) };
      },
    );
  }, [eventId, queryClient]);

  const handleMenuRefresh = useCallback((data: unknown) => {
    const payload = data as MenuRefreshPayload;
    if (payload?.eventId && payload.eventId !== eventId) return;
    queryClient.invalidateQueries({ queryKey: ['device-products', eventId] });
    queryClient.invalidateQueries({ queryKey: ['device-categories', eventId] });
  }, [eventId, queryClient]);

  const refreshDeviceStatus = useCallback(() => {
    useDeviceStore.getState().checkStatus();
  }, []);

  const handleDeviceStatusChanged = useCallback((data: unknown) => {
    const payload = data as { status?: string };
    if (payload?.status === 'blocked') {
      router.replace('/device/register');
      return;
    }
    refreshDeviceStatus();
  }, [router, refreshDeviceStatus]);

  const socketEvents = useMemo(() => ({
    productUpdated: handleProductUpdated,
    productDeleted: handleProductDeleted,
    menuRefresh: handleMenuRefresh,
    deviceConfigUpdated: refreshDeviceStatus,
    deviceSettingsUpdated: refreshDeviceStatus,
    deviceStatusChanged: handleDeviceStatusChanged,
  }), [
    handleProductUpdated,
    handleProductDeleted,
    handleMenuRefresh,
    refreshDeviceStatus,
    handleDeviceStatusChanged,
  ]);

  // Events emitted while the socket was down are lost — refetch everything
  // relevant on every (re)connect so menu, orders and settings are fresh.
  const handleSocketConnect = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['device-products'] });
    queryClient.invalidateQueries({ queryKey: ['device-categories'] });
    queryClient.invalidateQueries({ queryKey: ['device-orders'] });
    queryClient.invalidateQueries({ queryKey: ['device-open-tabs'] });
    refreshDeviceStatus();
  }, [queryClient, refreshDeviceStatus]);

  const { socket, isConnected: isSocketConnected } = useDeviceSocket({
    onBroadcast: handleBroadcast,
    onConnect: handleSocketConnect,
    on: socketEvents,
  });

  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!deviceId || !deviceToken) {
      router.replace('/device/register');
      return;
    }
    if (status === 'verified') {
      checkStatus().then((currentStatus) => {
        if (currentStatus !== 'verified') router.replace('/device/register');
      });
    } else {
      router.replace('/device/register');
    }
  }, [hasHydrated, deviceId, deviceToken, status, checkStatus, router]);

  useEffect(() => {
    if (serviceMode === 'counter' && !tableNumber) {
      setTableNumber(deviceName || 'Kasse');
    }
  }, [serviceMode, tableNumber, deviceName, setTableNumber]);

  const { data: orgData } = useQuery({
    queryKey: ['device-organization'],
    queryFn: () => deviceApi.getOrganization(),
    enabled: hasHydrated && status === 'verified',
  });

  const orderingMode = orgData?.data?.settings?.pos?.orderingMode || 'immediate';

  // Mirror the live cart to paired customer displays. Shared helper keeps the
  // Pfand policy in sync with the checkout logic in PosCart.
  const chargePfand = resolveChargePfand(orgData?.data?.settings?.pfand, serviceMode);
  useCustomerDisplayBroadcast(socket, isSocketConnected, chargePfand);

  const { data: eventsData } = useQuery({
    queryKey: ['device-events'],
    queryFn: () => deviceApi.getEvents(),
    enabled: hasHydrated && status === 'verified',
  });

  // The device-api returns events with status active|test (at most one).
  // Defensive .find prevents drift if older API versions ever return inactive events.
  const activeEvent: Event | null =
    (eventsData?.data || []).find((e: Event) => e.status === 'active' || e.status === 'test') ?? null;

  useEffect(() => {
    if (!activeEvent) return;
    if (eventId !== activeEvent.id) setEventId(activeEvent.id);
  }, [eventId, activeEvent, setEventId]);

  const { data: categoriesData } = useQuery({
    queryKey: ['device-categories', eventId],
    queryFn: () => deviceApi.getCategories(eventId!),
    enabled: !!eventId && !!tableNumber,
  });

  const categories = categoriesData?.data || [];

  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['device-products', eventId],
    queryFn: () => deviceApi.getProducts(eventId!),
    enabled: !!eventId && !!tableNumber,
  });

  const allProducts = productsData?.data || [];

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  useEffect(() => {
    if (activeCategories.length > 0 && !activeCategories.some((c) => c.id === selectedCategoryId)) {
      setSelectedCategoryId(activeCategories[0].id);
    }
  }, [activeCategories, selectedCategoryId]);

  const filteredProducts = useMemo(() => {
    const categoryId = selectedCategoryId || activeCategories[0]?.id;
    if (!categoryId) return allProducts.filter((p: Product) => p.isActive);
    return allProducts.filter((p: Product) => p.categoryId === categoryId && p.isActive);
  }, [allProducts, selectedCategoryId, activeCategories]);

  const selectedEvent = activeEvent && activeEvent.id === eventId ? activeEvent : null;
  const activeCategoryObj = activeCategories.find((c) => c.id === selectedCategoryId);

  const handleLogout = async () => {
    await logout();
    router.push('/device/register');
  };

  const handleStartSession = () => {
    if (!tableInput.trim()) return;
    setTableNumber(tableInput.trim());
    clearCart();
  };

  const handleEndSession = () => {
    clearSession();
    clearCart();
    setTableInput('');
    setAuthenticatedUser(null);
  };

  const cashDrawerPrinterId = deviceSettings?.cashDrawerPrinterId as string | undefined;

  const handleOpenCashDrawer = () => {
    deviceApi.openCashDrawer().catch(() => {});
  };

  // ── Cart sheet close + drag-to-close ───────────────────────────────────
  const closeCart = useCallback(() => {
    setCartClosing((current) => {
      if (current) return current;
      window.setTimeout(() => {
        setIsCartOpen(false);
        setCartClosing(false);
        setCartDragY(0);
        setIsCartDragging(false);
      }, 220);
      return true;
    });
  }, []);

  const handleCartHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = performance.now();
    cartDragRef.current = { y: e.clientY, t, lastY: e.clientY, lastT: t };
    setIsCartDragging(true);
  };

  const handleCartHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cartDragRef.current) return;
    const dy = Math.max(0, e.clientY - cartDragRef.current.y);
    setCartDragY(dy);
    cartDragRef.current.lastY = e.clientY;
    cartDragRef.current.lastT = performance.now();
  };

  const handleCartHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cartDragRef.current) return;
    const start = cartDragRef.current;
    const dy = Math.max(0, start.lastY - start.y);
    const dt = Math.max(1, start.lastT - start.t);
    const velocity = dy / dt; // px per ms
    cartDragRef.current = null;
    setIsCartDragging(false);
    if (dy > 120 || velocity > 0.6) {
      closeCart();
    } else {
      setCartDragY(0);
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore — capture may have been released by browser already
    }
  };

  // ── Loading states ──────────────────────────────────────────────────────
  if (!hasHydrated) return <PosSpinner />;
  if (!deviceId || status !== 'verified') return <PosSpinner label="Weiterleitung..." />;

  // ── PIN screen ──────────────────────────────────────────────────────────
  const requirePin = !!deviceSettings?.requirePin;
  if (requirePin && !authenticatedUser) {
    return (
      <PinEntryScreen
        deviceName={deviceName || 'POS'}
        onSuccess={setAuthenticatedUser}
        onLogout={handleLogout}
      />
    );
  }

  // ── Table entry screen ──────────────────────────────────────────────────
  if (!tableNumber) {
    return (
      <TableEntryScreen
        deviceName={deviceName || 'POS'}
        organizationName={organizationName || ''}
        activeEvent={activeEvent}
        tableInput={tableInput}
        setTableInput={setTableInput}
        onStart={handleStartSession}
        broadcastMessages={broadcastMessages}
        onDismissBroadcast={handleDismissBroadcast}
      />
    );
  }

  // ── Main POS ────────────────────────────────────────────────────────────
  return (
    <div
      className="pos-root"
      style={{
        display: 'grid',
        gridTemplateRows: '56px 1fr',
        height: '100dvh',
        overflow: 'hidden',
      }}
    >
      <BroadcastToast messages={broadcastMessages} onDismiss={handleDismissBroadcast} />

      {/* ══ Top bar ══════════════════════════════════════════════════════ */}
      <header
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          gap: 16,
          padding: '0 20px',
          background: 'var(--pos-surface)',
          borderBottom: '1px solid var(--pos-line)',
          zIndex: 10,
          position: 'relative',
        }}
      >
        {/* Brand + table */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'var(--pos-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--pos-accent-contrast)',
              fontWeight: 700,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {(organizationName || 'POS').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ lineHeight: 1.2, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--pos-ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 180,
              }}
              title={(serviceMode === 'table' ? organizationName : deviceName) || ''}
            >
              {serviceMode === 'table' ? (organizationName || 'OpenEOS') : deviceName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--pos-ink-3)' }}>
              {serviceMode === 'table' ? deviceName : organizationName}
            </div>
          </div>
        </div>

        {/* Centre: test mode warning (desktop full label, mobile compact icon) */}
        <div style={{ minWidth: 0, textAlign: 'center' }}>
          {selectedEvent?.status === 'test' && (
            <div
              title={t('testMode')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'oklch(0.97 0.05 85)',
                border: '1px solid oklch(0.85 0.08 85)',
                borderRadius: 999,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: 'oklch(0.45 0.1 75)',
                maxWidth: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <span aria-hidden style={{ flexShrink: 0 }}>⚠</span>
              <span className="pos-mobile-hide">{t('testMode')}</span>
            </div>
          )}
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {serviceMode === 'table' && (
            <button
              type="button"
              onClick={handleEndSession}
              title={t('tableNumber.changeTable')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                border: '1px solid var(--pos-line)',
                borderRadius: 'var(--pos-r-sm)',
                background: 'var(--pos-surface)',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--pos-ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Tisch
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--pos-ink)' }}>
                {tableNumber}
              </span>
              <span style={{ color: 'var(--pos-ink-3)', fontSize: 11 }}>▾</span>
            </button>
          )}
          <span className="pos-mobile-hide" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <PosActiveEventBadge event={activeEvent} />
          </span>
          {cashDrawerPrinterId && (
            <button type="button" onClick={handleOpenCashDrawer} className="pos-mobile-hide" style={topBtnStyle}>
              💵 {t('cashDrawer.open')}
            </button>
          )}
          <div className="pos-mobile-hide" style={{ width: 1, height: 24, background: 'var(--pos-line)' }} />
          <button
            type="button"
            onClick={() => setIsOrderHistoryOpen(true)}
            className="pos-mobile-hide"
            style={topBtnStyle}
            title={t('orderHistory.title')}
          >
            🕐
          </button>
          {authenticatedUser && (
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                background: 'var(--pos-accent-soft)',
                color: 'var(--pos-accent-ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 11,
                flexShrink: 0,
              }}
              title={`${authenticatedUser.firstName} ${authenticatedUser.lastName}`}
            >
              {authenticatedUser.firstName[0]}{authenticatedUser.lastName[0]}
            </div>
          )}
          {serviceMode === 'table' && (
            <button type="button" onClick={handleEndSession} className="pos-mobile-hide" style={topBtnStyle}>
              {t('tableNumber.endSession')}
            </button>
          )}
          <button type="button" onClick={handleLogout} className="pos-mobile-hide" style={{ ...topBtnStyle, color: 'var(--pos-ink-3)' }}>
            {t('logout')}
          </button>

          {/* Mobile-only overflow menu trigger */}
          <button
            type="button"
            className="pos-mobile-only"
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            style={{ ...topBtnStyle, padding: '6px 12px', fontSize: 18, lineHeight: 1, fontWeight: 700 }}
            aria-label={t('menu.more')}
            aria-expanded={isMobileMenuOpen}
          >
            ⋯
          </button>
        </div>

        {isMobileMenuOpen && (
          <>
            <div
              onClick={() => setIsMobileMenuOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 25 }}
            />
            <div className="pos-overflow-menu pos-mobile-only" role="menu">
              <button
                type="button"
                onClick={() => { setIsMobileMenuOpen(false); setIsOrderHistoryOpen(true); }}
                role="menuitem"
              >
                <Clock style={{ width: 18, height: 18, color: 'var(--pos-ink-2)', flexShrink: 0 }} />
                <span>{t('orderHistory.title')}</span>
              </button>
              {cashDrawerPrinterId && (
                <button
                  type="button"
                  onClick={() => { setIsMobileMenuOpen(false); handleOpenCashDrawer(); }}
                  role="menuitem"
                >
                  <Coins01 style={{ width: 18, height: 18, color: 'var(--pos-ink-2)', flexShrink: 0 }} />
                  <span>{t('cashDrawer.open')}</span>
                </button>
              )}
              {serviceMode === 'table' && (
                <button
                  type="button"
                  onClick={() => { setIsMobileMenuOpen(false); handleEndSession(); }}
                  role="menuitem"
                >
                  <Power01 style={{ width: 18, height: 18, color: 'var(--pos-ink-2)', flexShrink: 0 }} />
                  <span>{t('tableNumber.endSession')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                role="menuitem"
                style={{ color: 'var(--pos-danger)' }}
              >
                <LogOut01 style={{ width: 18, height: 18, color: 'var(--pos-danger)', flexShrink: 0 }} />
                <span>{t('logout')}</span>
              </button>
            </div>
          </>
        )}
      </header>

      {/* ══ Body ══════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: 'grid',
          /* grid-template-columns is set responsively in pos.css for desktop / tablet / mobile */
          minHeight: 0,
          overflow: 'hidden',
        }}
        className="pos-body"
      >
        {/* ── Category sidebar (hidden on mobile) ── */}
        <PosCategoryRail
          categories={activeCategories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          orientation="vertical"
        />

        {/* ── Products ── */}
        <main
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            background: 'var(--pos-bg)',
            overflow: 'hidden',
          }}
        >
          {/* Horizontal pills (mobile only via CSS) */}
          {activeCategories.length > 0 && (
            <div className="pos-pills-row">
              <PosCategoryRail
                categories={activeCategories}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={setSelectedCategoryId}
                orientation="horizontal"
              />
            </div>
          )}

          {/* Products header (desktop/tablet only) */}
          <div
            className="pos-product-head"
            style={{
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--pos-line)',
              background: 'var(--pos-surface)',
              flexShrink: 0,
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--pos-ink)', letterSpacing: '-0.01em' }}>
                {activeCategoryObj?.name || 'Alle Artikel'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--pos-ink-3)' }}>
                {filteredProducts.length} Artikel
              </div>
            </div>
          </div>

          {/* Product grid */}
          <div
            className="pos-scroll pos-product-scroll"
            style={{ flex: 1, overflowY: 'auto', padding: 16 }}
          >
            {/* Mobile-only inline category header */}
            <div className="pos-mobile-head" style={{ display: 'none', justifyContent: 'space-between', alignItems: 'baseline', padding: '2px 2px 10px' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--pos-ink)' }}>
                {activeCategoryObj?.name || 'Alle Artikel'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--pos-ink-3)' }}>
                {filteredProducts.length} Artikel
              </span>
            </div>
            {!eventId ? (
              <EmptyState>{t('selectEventFirst')}</EmptyState>
            ) : isLoadingProducts ? (
              <EmptyState>
                <div style={{ width: 22, height: 22, borderRadius: 999, border: '2px solid var(--pos-accent)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite', margin: '0 auto 8px' }} />
                {t('loading')}
              </EmptyState>
            ) : filteredProducts.length === 0 ? (
              <EmptyState>{t('noProducts')}</EmptyState>
            ) : (
              <PosProductGrid products={filteredProducts} />
            )}
          </div>
        </main>

        {/* ── Cart sidebar (hidden on mobile) ── */}
        <div style={{ minHeight: 0, overflow: 'hidden' }} className="pos-cart-col">
          <PosCart
            organizationId={organizationId!}
            tableNumber={tableNumber}
            orderingMode={orderingMode}
            onOpenTabs={() => setIsOpenTabsOpen(true)}
          />
        </div>
      </div>

      {/* ── Mobile bottom bar ── */}
      <div className="pos-mobile-bar">
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            background: cartItemCount > 0 ? 'var(--pos-accent)' : 'var(--pos-surface-2)',
            color: cartItemCount > 0 ? 'var(--pos-accent-contrast)' : 'var(--pos-ink-3)',
            border: cartItemCount > 0 ? 'none' : '1px solid var(--pos-line)',
            borderRadius: 'var(--pos-r-md)',
            cursor: cartItemCount > 0 ? 'pointer' : 'default',
            fontSize: 14,
            fontWeight: 700,
            margin: '10px 14px',
          }}
        >
          <span
            style={{
              width: 28, height: 28, borderRadius: 999,
              background: cartItemCount > 0 ? 'rgba(255,255,255,.22)' : 'var(--pos-line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12,
            }}
          >
            {cartItemCount}
          </span>
          <span>{cartItemCount === 0 ? 'Warenkorb leer' : 'Warenkorb öffnen'}</span>
          <span className="pos-mono" style={{ fontSize: 15 }}>
            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
              items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
            )}
          </span>
        </button>
      </div>

      {/* ── Mobile cart sheet ── */}
      {isCartOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }}>
          <div
            onClick={closeCart}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(20,18,12,.45)',
              opacity: cartClosing ? 0 : 1,
              transition: 'opacity .22s ease',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0, right: 0, bottom: 0,
              height: '75%',
              background: 'var(--pos-surface)',
              borderTopLeftRadius: 'var(--pos-r-lg)',
              borderTopRightRadius: 'var(--pos-r-lg)',
              boxShadow: 'var(--pos-sh-3)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              transform: cartClosing
                ? 'translateY(100%)'
                : cartDragY > 0
                  ? `translateY(${cartDragY}px)`
                  : undefined,
              transition: isCartDragging ? 'none' : 'transform .22s ease',
              animation: cartClosing || cartDragY > 0 ? undefined : 'pos-slide-up-sheet .22s ease',
              willChange: 'transform',
            }}
          >
            {/* Drag handle (touch / pointer) — large hit area for easy grabbing */}
            <div
              onPointerDown={handleCartHandlePointerDown}
              onPointerMove={handleCartHandlePointerMove}
              onPointerUp={handleCartHandlePointerUp}
              onPointerCancel={handleCartHandlePointerUp}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 36,
                flexShrink: 0,
                cursor: 'grab',
                touchAction: 'none',
              }}
            >
              <div style={{ width: 48, height: 5, background: 'var(--pos-line-strong)', borderRadius: 999 }} />
            </div>
            <PosCart
              organizationId={organizationId!}
              tableNumber={tableNumber}
              orderingMode={orderingMode}
              onOpenTabs={() => {
                closeCart();
                setIsOpenTabsOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* ── "Sent" toast ── */}
      {sentBanner && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--pos-accent)',
            color: 'var(--pos-accent-contrast)',
            padding: '12px 22px',
            borderRadius: 999,
            boxShadow: 'var(--pos-sh-3)',
            fontSize: 14,
            fontWeight: 600,
            zIndex: 50,
            animation: 'pos-slide-up .2s ease',
          }}
        >
          ✓ An Küche & Bar gesendet
        </div>
      )}

      {/* ── Drawers / Modals ── */}
      <OpenTabsDrawer
        isOpen={isOpenTabsOpen}
        onClose={() => setIsOpenTabsOpen(false)}
        onSplitPayment={() => setIsSplitPaymentOpen(true)}
      />
      <OrderHistoryDrawer
        isOpen={isOrderHistoryOpen}
        onClose={() => setIsOrderHistoryOpen(false)}
      />
      <SplitPaymentModal
        isOpen={isSplitPaymentOpen}
        onClose={() => setIsSplitPaymentOpen(false)}
      />
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: '100%',
        minHeight: 180,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--pos-ink-3)',
        fontSize: 13,
        textAlign: 'center',
        gap: 6,
      }}
    >
      {children}
    </div>
  );
}
