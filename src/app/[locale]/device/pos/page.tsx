'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut01, Tag01, ShoppingCart01, Menu01, BankNote01, ClockRewind } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Logo } from '@/components/foundations/logo/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LocaleSwitcher } from '@/components/ui/locale-switcher';
import { useDeviceStore, useDeviceHydration } from '@/stores/device-store';
import { useCartStore } from '@/stores/cart-store';
import { useDeviceSocket, type BroadcastMessage } from '@/hooks/use-device-socket';
import { deviceApi } from '@/lib/api-client';
import { PosProductGrid } from './components/pos-product-grid';
import { PosCart } from './components/device-pos-cart';
import { PosCategoryTabs } from './components/pos-category-tabs';
import { PosEventSelector } from './components/pos-event-selector';
import { NumPad } from './components/num-pad';
import { OpenTabsDrawer } from './components/open-tabs-drawer';
import { OrderHistoryDrawer } from './components/order-history-drawer';
import { SplitPaymentModal } from './components/split-payment-modal';
import { BroadcastToast } from './components/broadcast-toast';
import { PinEntryScreen } from './components/pin-entry-screen';
import { cx } from '@/utils/cx';
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
  const [broadcastMessages, setBroadcastMessages] = useState<BroadcastMessage[]>([]);
  const [authenticatedUser, setAuthenticatedUser] = useState<{
    userId: string;
    firstName: string;
    lastName: string;
  } | null>(null);

  // Socket connection for real-time updates
  const handleBroadcast = useCallback((message: BroadcastMessage) => {
    // Haptic feedback for notifications
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    setBroadcastMessages((prev) => [...prev, message]);
  }, []);

  const handleDismissBroadcast = useCallback((id: string) => {
    setBroadcastMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Real-time product update handlers
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

  const socketEvents = useMemo(() => ({
    productUpdated: handleProductUpdated,
    productDeleted: handleProductDeleted,
    menuRefresh: handleMenuRefresh,
  }), [handleProductUpdated, handleProductDeleted, handleMenuRefresh]);

  useDeviceSocket({
    onBroadcast: handleBroadcast,
    on: socketEvents,
  });

  // Count total items in cart
  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Check auth after hydration
  useEffect(() => {
    if (!hasHydrated) return;

    if (!deviceId || !deviceToken) {
      router.replace('/device/register');
      return;
    }

    // If already verified, just verify with backend
    if (status === 'verified') {
      checkStatus().then((currentStatus) => {
        if (currentStatus !== 'verified') {
          router.replace('/device/register');
        }
      });
    } else {
      // Not verified yet, go to register
      router.replace('/device/register');
    }
  }, [hasHydrated, deviceId, deviceToken, status, checkStatus, router]);

  // Counter mode: auto-set table number to device name
  useEffect(() => {
    if (serviceMode === 'counter' && !tableNumber) {
      setTableNumber(deviceName || 'Kasse');
    }
  }, [serviceMode, tableNumber, deviceName, setTableNumber]);

  // Fetch organization settings
  const { data: orgData } = useQuery({
    queryKey: ['device-organization'],
    queryFn: () => deviceApi.getOrganization(),
    enabled: hasHydrated && status === 'verified',
  });

  const orderingMode = orgData?.data?.settings?.pos?.orderingMode || 'immediate';

  // Fetch active events (device API returns only active events for device's org)
  const { data: eventsData } = useQuery({
    queryKey: ['device-events'],
    queryFn: () => deviceApi.getEvents(),
    enabled: hasHydrated && status === 'verified',
  });

  // Device API returns active and draft events
  const activeEvents = eventsData?.data || [];

  // Auto-select first active event if none selected or current event no longer available
  useEffect(() => {
    if (activeEvents.length === 0) return;
    const currentEventValid = eventId && activeEvents.some((e: Event) => e.id === eventId);
    if (!currentEventValid) {
      setEventId(activeEvents[0].id);
    }
  }, [eventId, activeEvents, setEventId]);

  // Fetch categories for selected event
  const { data: categoriesData } = useQuery({
    queryKey: ['device-categories', eventId],
    queryFn: () => deviceApi.getCategories(eventId!),
    enabled: !!eventId && !!tableNumber,
  });

  const categories = categoriesData?.data || [];

  // Fetch products for selected event
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['device-products', eventId],
    queryFn: () => deviceApi.getProducts(eventId!),
    enabled: !!eventId && !!tableNumber,
  });

  const allProducts = productsData?.data || [];

  // Auto-select first category
  const activeCategories = useMemo(() =>
    categories.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );

  useEffect(() => {
    if (activeCategories.length > 0 && !activeCategories.some((c) => c.id === selectedCategoryId)) {
      setSelectedCategoryId(activeCategories[0].id);
    }
  }, [activeCategories, selectedCategoryId]);

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    const categoryId = selectedCategoryId || activeCategories[0]?.id;
    if (!categoryId) return allProducts.filter((p: Product) => p.isActive);
    return allProducts.filter(
      (p: Product) => p.categoryId === categoryId && p.isActive
    );
  }, [allProducts, selectedCategoryId, activeCategories]);

  const selectedEvent = activeEvents.find((e: Event) => e.id === eventId);

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
    deviceApi.openCashDrawer().catch(() => {
      // fire-and-forget
    });
  };

  // Show loading only while hydrating
  if (!hasHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-secondary">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  // After hydration, if not authenticated, useEffect will redirect
  // Show brief loading while redirect happens
  if (!deviceId || status !== 'verified') {
    return (
      <div className="flex h-screen items-center justify-center bg-secondary">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
          <p className="mt-4 text-sm text-tertiary">Weiterleitung...</p>
        </div>
      </div>
    );
  }

  // PIN entry screen (when requirePin is enabled and no user authenticated)
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

  // Table number input screen
  if (!tableNumber) {
    return (
      <div className="flex h-screen flex-col bg-secondary bg-grid">
        {/* Broadcast Messages */}
        <BroadcastToast messages={broadcastMessages} onDismiss={handleDismissBroadcast} />

        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-secondary bg-primary px-4">
          {/* Mobile Header */}
          <div className="flex lg:hidden items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Logo width={100} height={25} />
              <div className="h-5 w-px bg-secondary" />
              <span className="text-sm font-medium text-primary">{deviceName}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-tertiary hover:bg-secondary"
            >
              <Menu01 className="h-5 w-5" />
            </button>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:flex items-center gap-4">
            <Logo width={120} height={30} />
            <div className="h-6 w-px bg-secondary" />
            <div>
              <p className="text-sm font-medium text-primary">{deviceName}</p>
              <p className="text-xs text-tertiary">{organizationName}</p>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-1">
            <PosEventSelector
              events={activeEvents}
              selectedEventId={eventId}
              onSelectEvent={setEventId}
            />
            <div className="h-6 w-px bg-secondary mx-1" />
            <LocaleSwitcher />
            <ThemeToggle />
            <div className="h-6 w-px bg-secondary mx-1" />
            <Button color="tertiary" size="sm" onClick={handleLogout}>
              <LogOut01 className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="absolute top-14 right-0 left-0 z-50 border-b border-secondary bg-primary shadow-lg lg:hidden">
              <div className="p-4 space-y-4">
                {/* Organization Info */}
                <div className="pb-3 border-b border-secondary">
                  <p className="text-xs text-tertiary">{organizationName}</p>
                </div>

                {/* Event Selector */}
                <div className="flex items-center justify-between">
                  <PosEventSelector
                    events={activeEvents}
                    selectedEventId={eventId}
                    onSelectEvent={(id) => {
                      setEventId(id);
                      setIsMobileMenuOpen(false);
                    }}
                  />
                </div>

                {/* Theme & Language + Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-secondary">
                  <LocaleSwitcher />
                  <ThemeToggle />
                  <div className="flex-1" />
                  <Button
                    color="tertiary"
                    size="sm"
                    iconLeading={LogOut01}
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    {t('logout')}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Table Number Input */}
        <div className="flex flex-1 items-start justify-center p-4 pt-8 sm:pt-16">
          <div className="w-full max-w-sm">
            <div className="rounded-xl border border-secondary bg-primary p-6 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-secondary">
                <Tag01 className="h-7 w-7 text-brand-primary" />
              </div>
              <h2 className="mb-1 text-lg font-semibold text-primary">
                {t('tableNumber.title')}
              </h2>
              <p className="mb-4 text-sm text-tertiary">
                {t('tableNumber.description')}
              </p>

              {/* Display */}
              <div className="mb-4 rounded-lg border border-secondary bg-secondary py-4">
                <span className="text-4xl font-bold text-primary tabular-nums">
                  {tableInput || '—'}
                </span>
              </div>

              {/* NumPad */}
              <NumPad
                value={tableInput}
                onChange={setTableInput}
                maxLength={5}
                className="mb-4"
              />

              <Button
                onClick={handleStartSession}
                className="w-full"
                size="lg"
                disabled={!tableInput.trim()}
              >
                {t('tableNumber.start')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-secondary bg-grid">
      {/* Broadcast Messages */}
      <BroadcastToast messages={broadcastMessages} onDismiss={handleDismissBroadcast} />

      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-secondary bg-primary px-4">
        {/* Mobile Header */}
        <div className="flex lg:hidden items-center justify-between w-full">
          <div className="flex items-center gap-3">
            {serviceMode === 'table' ? (
              <button
                type="button"
                onClick={handleEndSession}
                className="focus:outline-none"
                title={t('tableNumber.changeTable')}
              >
                <Logo width={100} height={25} />
              </button>
            ) : (
              <Logo width={100} height={25} />
            )}
            <div className="h-5 w-px bg-secondary" />
            <span className="text-sm font-medium text-primary">
              {serviceMode === 'table' ? `${t('tableNumber.table')} ${tableNumber}` : deviceName}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-tertiary hover:bg-secondary"
          >
            <Menu01 className="h-5 w-5" />
          </button>
        </div>

        {/* Desktop Header */}
        <div className="hidden lg:flex items-center gap-4">
          {serviceMode === 'table' ? (
            <button
              type="button"
              onClick={handleEndSession}
              className="focus:outline-none"
              title={t('tableNumber.changeTable')}
            >
              <Logo width={120} height={30} />
            </button>
          ) : (
            <Logo width={120} height={30} />
          )}
          <div className="h-6 w-px bg-secondary" />
          <div>
            <h1 className="text-lg font-semibold text-primary">
              {serviceMode === 'table' ? `${t('tableNumber.table')} ${tableNumber}` : deviceName}
            </h1>
            <p className="text-xs text-tertiary">
              {serviceMode === 'table' ? `${deviceName} - ${organizationName}` : organizationName}
            </p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2">
          <PosEventSelector
            events={activeEvents}
            selectedEventId={eventId}
            onSelectEvent={setEventId}
          />
          {cashDrawerPrinterId && (
            <>
              <div className="h-6 w-px bg-secondary mx-1" />
              <Button
                color="secondary"
                size="sm"
                iconLeading={BankNote01}
                onClick={handleOpenCashDrawer}
              >
                {t('cashDrawer.open')}
              </Button>
            </>
          )}
          <div className="h-6 w-px bg-secondary mx-1" />
          <Button
            color="tertiary"
            size="sm"
            onClick={() => setIsOrderHistoryOpen(true)}
            title={t('orderHistory.title')}
          >
            <ClockRewind className="h-4 w-4" />
          </Button>
          <div className="h-6 w-px bg-secondary mx-1" />
          <LocaleSwitcher />
          <ThemeToggle />
          <div className="h-6 w-px bg-secondary mx-1" />
          {serviceMode === 'table' && (
            <Button color="secondary" size="sm" onClick={handleEndSession}>
              {t('tableNumber.endSession')}
            </Button>
          )}
          <Button color="tertiary" size="sm" onClick={handleLogout}>
            <LogOut01 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute top-14 right-0 left-0 z-50 border-b border-secondary bg-primary shadow-lg lg:hidden">
            <div className="p-4 space-y-4">
              {/* Device Info */}
              <div className="pb-3 border-b border-secondary">
                <p className="text-sm font-medium text-primary">{deviceName}</p>
                <p className="text-xs text-tertiary">{organizationName}</p>
              </div>

              {/* Event Selector */}
              <div className="flex items-center justify-between">
                <PosEventSelector
                  events={activeEvents}
                  selectedEventId={eventId}
                  onSelectEvent={(id) => {
                    setEventId(id);
                    setIsMobileMenuOpen(false);
                  }}
                />
              </div>

              {/* Order History */}
              <Button
                color="secondary"
                size="sm"
                iconLeading={ClockRewind}
                className="w-full"
                onClick={() => {
                  setIsOrderHistoryOpen(true);
                  setIsMobileMenuOpen(false);
                }}
              >
                {t('orderHistory.title')}
              </Button>

              {/* Theme & Language + Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-secondary">
                <LocaleSwitcher />
                <ThemeToggle />
                <div className="flex-1" />
                {serviceMode === 'table' && (
                  <Button
                    color="secondary"
                    size="sm"
                    onClick={() => {
                      handleEndSession();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    {t('tableNumber.endSession')}
                  </Button>
                )}
                <Button
                  color="tertiary"
                  size="sm"
                  iconLeading={LogOut01}
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                >
                  {t('logout')}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Test Mode Banner */}
      {selectedEvent?.status === 'test' && (
        <div className="flex items-center justify-center gap-2 border-b border-warning-secondary bg-warning-secondary px-4 py-2 text-sm font-medium text-warning-primary dark:text-white">
          {t('testMode')}
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Products Section */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Category Tabs */}
          {categories.length > 0 && (
            <PosCategoryTabs
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={setSelectedCategoryId}
            />
          )}

          {/* Product Grid */}
          <div className="flex-1 overflow-auto p-4">
            {!eventId ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-tertiary">{t('selectEventFirst')}</p>
              </div>
            ) : isLoadingProducts ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-tertiary">{t('loading')}</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-tertiary">{t('noProducts')}</p>
              </div>
            ) : (
              <PosProductGrid products={filteredProducts} />
            )}
          </div>
        </div>

        {/* Cart Sidebar - Desktop */}
        <aside className="hidden lg:block w-96 border-l border-secondary bg-primary">
          <PosCart
            organizationId={organizationId!}
            tableNumber={tableNumber}
            orderingMode={orderingMode}
            onOpenTabs={() => setIsOpenTabsOpen(true)}
          />
        </aside>

        {/* Mobile Cart Overlay */}
        {isCartOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsCartOpen(false)}
          />
        )}

        {/* Mobile Cart Slide-over */}
        <div
          className={cx(
            'fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-primary shadow-xl transition-transform duration-300 ease-in-out lg:hidden',
            isCartOpen ? 'translate-x-0' : 'translate-x-full'
          )}
        >
          <PosCart
            organizationId={organizationId!}
            tableNumber={tableNumber}
            orderingMode={orderingMode}
            onClose={() => setIsCartOpen(false)}
            onOpenTabs={() => {
              setIsCartOpen(false);
              setIsOpenTabsOpen(true);
            }}
          />
        </div>
      </div>

      {/* Mobile Cart FAB */}
      <button
        type="button"
        onClick={() => setIsCartOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-brand-solid text-white shadow-lg hover:bg-brand-solid_hover lg:hidden"
      >
        <ShoppingCart01 className="h-7 w-7" />
        {cartItemCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-error-solid text-xs font-bold text-white">
            {cartItemCount > 99 ? '99+' : cartItemCount}
          </span>
        )}
      </button>

      {/* Open Tabs Drawer */}
      <OpenTabsDrawer
        isOpen={isOpenTabsOpen}
        onClose={() => setIsOpenTabsOpen(false)}
        onSplitPayment={() => setIsSplitPaymentOpen(true)}
      />

      {/* Order History Drawer */}
      <OrderHistoryDrawer
        isOpen={isOrderHistoryOpen}
        onClose={() => setIsOrderHistoryOpen(false)}
      />

      {/* Split Payment Modal */}
      <SplitPaymentModal
        isOpen={isSplitPaymentOpen}
        onClose={() => setIsSplitPaymentOpen(false)}
      />
    </div>
  );
}
