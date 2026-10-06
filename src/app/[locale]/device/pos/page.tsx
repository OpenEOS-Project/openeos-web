'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Banner, Icon, Spinner } from '@openeos/ui';
import { useCustomerDisplayBroadcast } from '@/hooks/use-customer-display-broadcast';
import { useDeviceSocket, type BroadcastMessage } from '@/hooks/use-device-socket';
import { usePosConnection } from '@/hooks/use-pos-connection';
import { isIntegrationEnabled } from '@/config/integrations';
import { deviceApi } from '@/lib/api-client';
import { useCartStore } from '@/stores/cart-store';
import { useDeviceHydration, useDeviceStore } from '@/stores/device-store';
import { resolveChargePfand } from '@/utils/pfand';
import { BroadcastToast } from './components/broadcast-toast';
import { DoneSheet, type DoneInfo } from './components/done-sheet';
import { OpenOrdersSheet, useOpenOrders } from './components/open-orders-sheet';
import { OrderHistoryDrawer } from './components/order-history-drawer';
import { PaySheet } from './components/pay-sheet';
import { PfandReturnModal } from './components/pfand-return-modal';
import { PinEntryScreen } from './components/pin-entry-screen';
import { PosHeader, type PosMenuAction } from './components/pos-header';
import { PosOrderView } from './components/pos-order-view';
import { PosLayerProvider } from './components/pos-sheet';
import { LogoutSheet } from './components/logout-sheet';
import { PosStartView } from './components/pos-start-view';
import { PosTestModeBanner } from './components/pos-event-selector';
import { PosToastProvider, usePosToast } from './components/pos-toast';
import { SplitPaymentModal } from './components/split-payment-modal';
import { usePosCheckout } from './hooks/use-pos-checkout';
import { usePosData } from './hooks/use-pos-data';
import { usePosDeviceStatus, usePosSocketEvents } from './hooks/use-pos-live';

type SheetId = 'pay' | 'history' | 'openOrders' | 'split' | 'pfand' | 'logout' | null;

export default function DevicePosPage() {
  const tUi = useTranslations('deviceUi');
  const router = useRouter();
  const hydrated = useDeviceHydration();
  const { deviceId, deviceToken, status, checkStatus } = useDeviceStore();
  const [layer, setLayer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!deviceId || !deviceToken || status !== 'verified') {
      router.replace('/device/register');
      return;
    }
    checkStatus().then((current) => {
      if (current !== 'verified') router.replace('/device/register');
    });
  }, [hydrated, deviceId, deviceToken, status, checkStatus, router]);

  if (!hydrated || !deviceId || status !== 'verified') {
    return (
      <div className="pos-app oe-root pos-loading">
        <Spinner />
        {hydrated && <span>{tUi('common.redirecting')}</span>}
      </div>
    );
  }

  return (
    <div className="pos-app oe-root">
      <PosLayerProvider value={layer}>
        <PosToastProvider>
          <PosApp />
        </PosToastProvider>
      </PosLayerProvider>
      <div ref={setLayer} className="pos-layer" />
    </div>
  );
}

function PosApp() {
  const t = useTranslations('pos');
  const router = useRouter();
  const toast = usePosToast();
  const device = useDeviceStore();
  const { deviceName, settings, tableNumber, session, setSession, setTableNumber, clearSession, logout } = device;
  const serviceMode = (settings?.serviceMode as string) || 'table';
  const requirePin = !!settings?.requirePin;
  const cart = useCartStore();
  const { eventId, setEventId } = cart;

  const [sheet, setSheet] = useState<SheetId>(null);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [printing, setPrinting] = useState(false);
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [testDismissed, setTestDismissed] = useState(false);

  const handleBroadcast = useCallback((message: BroadcastMessage) => {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setBroadcasts((prev) => [...prev, message]);
  }, []);
  const dismissBroadcast = useCallback((id: string) => {
    setBroadcasts((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const inOrderView = !!tableNumber;
  const { orgName, orgSettings, activeEvent, categories, products, productsLoading, vouchers, pfandTypes } =
    usePosData(eventId, inOrderView);
  const isTest = activeEvent?.status === 'test';
  const socketOptions = usePosSocketEvents(eventId, handleBroadcast);
  const { socket, isConnected } = useDeviceSocket(socketOptions);
  const connection = usePosConnection(isConnected);
  const offline = connection === 'offline';

  useEffect(() => {
    if (activeEvent && eventId !== activeEvent.id) setEventId(activeEvent.id);
  }, [activeEvent, eventId, setEventId]);

  useEffect(() => {
    if (serviceMode === 'counter' && !tableNumber) setTableNumber(deviceName || 'Kasse');
  }, [serviceMode, tableNumber, deviceName, setTableNumber]);

  const chargePfand = resolveChargePfand(orgSettings?.pfand, serviceMode);
  useCustomerDisplayBroadcast(socket, isConnected, chargePfand);

  const orderingMode = activeEvent?.settings?.orderingMode || orgSettings?.pos?.orderingMode || 'immediate';
  const isTab = orderingMode === 'tab';

  const { orders: openOrders } = useOpenOrders(eventId, isTab, false);
  const printer = usePosDeviceStatus();

  const card = settings?.sumupReaderId && isIntegrationEnabled(orgSettings, 'sumup') ? 'sumup' : null;
  const contextLabel =
    serviceMode === 'table' && tableNumber ? t('cartV2.contextTable', { label: tableNumber }) : t('cartV2.contextCounter');
  const checkout = usePosCheckout({
    eventId,
    tableNumber,
    fulfillmentType: serviceMode === 'table' ? 'table_service' : 'counter_pickup',
    chargePfand,
  });

  const receipt = orgSettings?.orderFlow?.receiptPrinting;
  const canPrint = !!(settings?.defaultPrinterId || receipt?.printerId);
  const autoPrinted = !!receipt?.enabled && receipt.trigger === 'payment_received';

  const lock = () => {
    setSheet(null);
    setSession(null);
    toast(t('header.locked'), 'danger');
  };

  const handleLogout = async () => {
    await logout();
    router.push('/device/register');
  };

  const nextReceipt = useCallback(() => {
    setDone(null);
    if (useDeviceStore.getState().settings?.serviceMode !== 'counter') clearSession();
  }, [clearSession]);

  const print = async (orderIds: string[]) => {
    setPrinting(true);
    try {
      for (const id of orderIds) await deviceApi.reprintOrder(id, 'receipt');
      toast(t('done.printed'));
    } catch {
      toast(t('done.printFailed'), 'danger');
    } finally {
      setPrinting(false);
    }
  };

  if (requirePin && !session) {
    return <PinEntryScreen deviceName={deviceName || 'POS'} onSuccess={setSession} onLogout={handleLogout} />;
  }

  const payable = chargePfand ? cart.getPayableTotal() : cart.getNetTotal();
  const menu: PosMenuAction[] = [
    { id: 'history', icon: 'clock', label: t('menu.history'), onSelect: () => setSheet('history') },
    ...(isTab ? [{ id: 'open', icon: 'orders' as const, label: t('menu.openOrders'), onSelect: () => setSheet('openOrders') }] : []),
    ...(pfandTypes.length > 0 ? [{ id: 'pfand', icon: 'deposit' as const, label: t('menu.pfandReturn'), onSelect: () => setSheet('pfand') }] : []),
    ...(settings?.cashDrawerPrinterId
      ? [{
          id: 'drawer',
          icon: 'drawer' as const,
          label: t('menu.cashDrawer'),
          disabled: offline,
          onSelect: () => deviceApi.openCashDrawer().then(() => toast(t('menu.cashDrawerOpened')), () => toast(t('menu.cashDrawerFailed'), 'danger')),
        }]
      : []),
  ];

  const testBanner = isTest && !testDismissed ? <PosTestModeBanner onDismiss={() => setTestDismissed(true)} /> : null;

  return (
    <div className={isTest ? 'pos-shell is-test' : 'pos-shell'}>
      <BroadcastToast messages={broadcasts} onDismiss={dismissBroadcast} />
      <PosHeader
        deviceName={deviceName || 'POS'}
        eventName={activeEvent?.name ?? null}
        isTestEvent={isTest}
        table={serviceMode === 'table' && tableNumber ? { label: tableNumber, onSwitch: clearSession } : null}
        connection={connection}
        printer={printer}
        user={requirePin ? session : null}
        onLock={lock}
        menu={menu}
        onLogout={() => setSheet('logout')}
      />
      {isTest && <div className="pos-testband">{t('header.testMode')}</div>}
      {offline && (
        <Banner tone="danger" icon={<Icon name="wifi-off" />} className="pos-offline">
          {t('offline.banner')}
        </Banner>
      )}

      {inOrderView ? (
        <PosOrderView
          eventId={eventId}
          products={products}
          categories={categories}
          isLoading={productsLoading}
          chargePfand={chargePfand}
          contextLabel={contextLabel}
          canSend={isTab}
          actionsDisabled={offline || checkout.isSending || !eventId}
          isSending={checkout.isSending}
          onSend={checkout.send}
          onCheckout={() => setSheet('pay')}
          onPfandReturn={pfandTypes.length > 0 ? () => setSheet('pfand') : undefined}
          openOrders={isTab ? { count: openOrders.length, onOpen: () => setSheet('openOrders') } : undefined}
          notices={testBanner}
        />
      ) : (
        <PosStartView onOpenTable={(label) => setTableNumber(label)} notices={testBanner} />
      )}

      <PaySheet
        open={sheet === 'pay'}
        onClose={() => setSheet(null)}
        title={t('pay.title', { context: contextLabel })}
        subtitle={t('order.itemCount', { count: cart.getItemCount() })}
        amount={payable}
        pfandIncluded={chargePfand ? cart.getNetPfandTotal() : 0}
        card={card}
        discount={{ vouchers, applied: cart.appliedVouchers, onApply: cart.applyVoucher, onRemove: cart.removeVoucher }}
        onPay={async (result) => {
          const info = await checkout.pay(result);
          setSheet(null);
          setDone(info);
        }}
        disabled={offline}
      />
      <DoneSheet
        info={done}
        title={orgName || 'OpenEOS'}
        eventName={activeEvent?.name ?? null}
        deviceName={deviceName || 'POS'}
        isTest={isTest}
        canPrint={canPrint}
        autoPrinted={autoPrinted}
        onPrint={print}
        printing={printing}
        onNext={nextReceipt}
      />
      <OrderHistoryDrawer isOpen={sheet === 'history'} onClose={() => setSheet(null)} eventId={eventId} />
      <OpenOrdersSheet
        isOpen={sheet === 'openOrders'}
        onClose={() => setSheet(null)}
        eventId={eventId}
        card={card ?? 'manual'}
        disabled={offline}
        onSplit={() => setSheet('split')}
        onPaid={setDone}
      />
      <SplitPaymentModal
        isOpen={sheet === 'split'}
        onClose={() => setSheet(null)}
        eventId={eventId}
        card={card ?? 'manual'}
        disabled={offline}
      />
      <PfandReturnModal
        isOpen={sheet === 'pfand'}
        onClose={() => setSheet(null)}
        pfandTypes={pfandTypes}
        eventId={eventId || undefined}
        allowOffset={inOrderView && cart.items.length > 0}
        initialCounts={Object.fromEntries(cart.pfandReturns.map((l) => [l.pfandTypeId, l.quantity]))}
        onOffset={(lines) => {
          cart.setPfandReturns(lines);
          setSheet(null);
        }}
        payoutDisabled={offline}
      />
      <LogoutSheet open={sheet === 'logout'} onClose={() => setSheet(null)} onConfirm={handleLogout} />
    </div>
  );
}
