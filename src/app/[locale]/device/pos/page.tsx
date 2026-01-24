'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LogOut01, Tag01, ShoppingCart01, X, Menu01, Settings01, Globe01, Calendar } from '@untitledui/icons';
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
import { SplitPaymentModal } from './components/split-payment-modal';
import { BroadcastToast } from './components/broadcast-toast';
import { cx } from '@/utils/cx';
import type { Event } from '@/types/event';
import type { Product } from '@/types/product';
import type { Order } from '@/types/order';

export default function DevicePosPage() {
  const t = useTranslations('pos');
  const router = useRouter();

  const hasHydrated = useDeviceHydration();

  const {
    deviceId,
    deviceToken,
    status,
    organizationId,
    organizationName,
    deviceName,
    tableNumber,
    checkStatus,
    setTableNumber,
    clearSession,
    logout,
  } = useDeviceStore();

  const { eventId, setEventId, clearCart, items } = useCartStore();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [tableInput, setTableInput] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOpenTabsOpen, setIsOpenTabsOpen] = useState(false);
  const [splitPaymentOrder, setSplitPaymentOrder] = useState<Order | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [broadcastMessages, setBroadcastMessages] = useState<BroadcastMessage[]>([]);

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

  useDeviceSocket({
    onBroadcast: handleBroadcast,
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

  // Device API already returns only active events
  const activeEvents = eventsData?.data || [];

  // Auto-select first active event if none selected
  useEffect(() => {
    if (!eventId && activeEvents.length > 0) {
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

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    if (!selectedCategoryId) return allProducts.filter((p: Product) => p.isActive && p.isAvailable);
    return allProducts.filter(
      (p: Product) => p.categoryId === selectedCategoryId && p.isActive && p.isAvailable
    );
  }, [allProducts, selectedCategoryId]);

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
            {selectedEvent && (
              <span className="text-sm text-tertiary mr-2">{selectedEvent.name}</span>
            )}
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
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-tertiary" />
                    <span className="text-sm text-tertiary">{t('selectEvent')}</span>
                  </div>
                  <PosEventSelector
                    events={activeEvents}
                    selectedEventId={eventId}
                    onSelectEvent={(id) => {
                      setEventId(id);
                      setIsMobileMenuOpen(false);
                    }}
                  />
                </div>

                {/* Theme & Language */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings01 className="h-4 w-4 text-tertiary" />
                    <span className="text-sm text-tertiary">{t('settings')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <LocaleSwitcher />
                    <ThemeToggle />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-secondary">
                  <Button
                    color="tertiary"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <LogOut01 className="h-4 w-4 mr-2" />
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
            <button
              type="button"
              onClick={handleEndSession}
              className="focus:outline-none"
              title={t('tableNumber.changeTable')}
            >
              <Logo width={100} height={25} />
            </button>
            <div className="h-5 w-px bg-secondary" />
            <span className="text-sm font-medium text-primary">
              {t('tableNumber.table')} {tableNumber}
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
          <button
            type="button"
            onClick={handleEndSession}
            className="focus:outline-none"
            title={t('tableNumber.changeTable')}
          >
            <Logo width={120} height={30} />
          </button>
          <div className="h-6 w-px bg-secondary" />
          <div>
            <h1 className="text-lg font-semibold text-primary">
              {t('tableNumber.table')} {tableNumber}
            </h1>
            <p className="text-xs text-tertiary">
              {deviceName} - {organizationName}
            </p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2">
          {selectedEvent && (
            <span className="text-sm text-tertiary mr-1">{selectedEvent.name}</span>
          )}
          <PosEventSelector
            events={activeEvents}
            selectedEventId={eventId}
            onSelectEvent={setEventId}
          />
          <div className="h-6 w-px bg-secondary mx-1" />
          <LocaleSwitcher />
          <ThemeToggle />
          <div className="h-6 w-px bg-secondary mx-1" />
          <Button color="secondary" size="sm" onClick={handleEndSession}>
            {t('tableNumber.endSession')}
          </Button>
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
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-tertiary" />
                  <span className="text-sm text-tertiary">{t('selectEvent')}</span>
                </div>
                <PosEventSelector
                  events={activeEvents}
                  selectedEventId={eventId}
                  onSelectEvent={(id) => {
                    setEventId(id);
                    setIsMobileMenuOpen(false);
                  }}
                />
              </div>

              {/* Theme & Language */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings01 className="h-4 w-4 text-tertiary" />
                  <span className="text-sm text-tertiary">{t('settings')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <LocaleSwitcher />
                  <ThemeToggle />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-secondary">
                <Button
                  color="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    handleEndSession();
                    setIsMobileMenuOpen(false);
                  }}
                >
                  {t('tableNumber.endSession')}
                </Button>
                <Button
                  color="tertiary"
                  size="sm"
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <LogOut01 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
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
        className="fixed bottom-6 right-6 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary text-white shadow-lg hover:bg-brand-primary/90 lg:hidden"
      >
        <ShoppingCart01 className="h-7 w-7" />
        {cartItemCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-error-primary text-xs font-bold text-white">
            {cartItemCount > 99 ? '99+' : cartItemCount}
          </span>
        )}
      </button>

      {/* Open Tabs Drawer */}
      <OpenTabsDrawer
        isOpen={isOpenTabsOpen}
        onClose={() => setIsOpenTabsOpen(false)}
        onSplitPayment={(order) => setSplitPaymentOrder(order)}
      />

      {/* Split Payment Modal */}
      {splitPaymentOrder && (
        <SplitPaymentModal
          isOpen={!!splitPaymentOrder}
          onClose={() => setSplitPaymentOrder(null)}
          order={splitPaymentOrder}
        />
      )}
    </div>
  );
}
