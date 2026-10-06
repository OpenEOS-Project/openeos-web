'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Banner, Icon, Spinner } from '@openeos/ui';
import { isIntegrationEnabled } from '@/config/integrations';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useCustomerDisplayBroadcast } from '@/hooks/use-customer-display-broadcast';
import { useDeviceSocket, type BroadcastMessage } from '@/hooks/use-device-socket';
import { useDeviceTables } from '@/hooks/use-device-tables';
import { usePosConnection } from '@/hooks/use-pos-connection';
import { useTableStatus } from '@/hooks/use-table-status';
import { deviceApi } from '@/lib/api-client';
import { deviceTablesApi } from '@/lib/device-tables-api';
import { useCartStore } from '@/stores/cart-store';
import { useDeviceHydration, useDeviceStore } from '@/stores/device-store';
import type { PosTableContext } from '@/types/table';
import { resolveChargePfand } from '@/utils/pfand';
import { BroadcastToast } from './components/broadcast-toast';
import { DoneSheet, type DoneInfo } from './components/done-sheet';
import { LogoutSheet } from './components/logout-sheet';
import { OpenOrdersSheet } from './components/open-orders-sheet';
import { OrderHistoryDrawer } from './components/order-history-drawer';
import { PaySheet } from './components/pay-sheet';
import { PfandReturnModal } from './components/pfand-return-modal';
import { PinEntryScreen } from './components/pin-entry-screen';
import { PosTestModeBanner } from './components/pos-event-selector';
import { PosHeader, type PosMenuAction } from './components/pos-header';
import { PosOrderView } from './components/pos-order-view';
import { PosLayerProvider } from './components/pos-sheet';
import { PosStartView } from './components/pos-start-view';
import { PosToastProvider, usePosToast } from './components/pos-toast';
import { SplitPaymentModal } from './components/split-payment-modal';
import { TableSwitchSheet } from './components/table-switch-sheet';
import { useOpenOrders, type OpenOrdersScope } from './hooks/use-open-orders';
import { checkoutTotals, usePosCheckout } from './hooks/use-pos-checkout';
import { usePosData } from './hooks/use-pos-data';
import { PosLiveProvider, usePosDeviceStatus, usePosSocketEvents } from './hooks/use-pos-live';
import { effectiveTableMode, mergeOpenTables, sameContext, sortAreas } from './utils/tables';

type SheetId = 'pay' | 'history' | 'openOrders' | 'split' | 'pfand' | 'logout' | 'table' | null;

/** Kartenzahlung ohne gespeicherte Bestellung (Kassieren-Blatt der Bestellansicht). */
const UNSAVED_KEY = 'openeos-pos-unsaved-card';
const COUNTER: PosTableContext = { kind: 'counter' };

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
  const queryClient = useQueryClient();
  const apiErrorMessage = useApiErrorMessage();
  const { deviceName, settings, table: storedTable, session, setSession, setTable, startView, setStartView, logout } =
    useDeviceStore();
  const serviceMode = (settings?.serviceMode as string) || 'table';
  const deviceAreaId = (settings?.tableAreaId as string | undefined) ?? null;
  const requirePin = !!settings?.requirePin;
  const cart = useCartStore();
  const { eventId, setEventId } = cart;

  const [sheet, setSheet] = useState<SheetId>(null);
  const [carryDefault, setCarryDefault] = useState(false);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [printing, setPrinting] = useState(false);
  const [serving, setServing] = useState(false);
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [testDismissed, setTestDismissed] = useState(false);

  const handleBroadcast = useCallback((message: BroadcastMessage) => {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setBroadcasts((prev) => [...prev, message]);
  }, []);
  const dismissBroadcast = useCallback((id: string) => {
    setBroadcasts((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const socketOptions = usePosSocketEvents(eventId, handleBroadcast);
  const { socket, isConnected } = useDeviceSocket(socketOptions);
  const connection = usePosConnection(isConnected);
  const offline = connection === 'offline';

  // Produkte laden schon auf der Startansicht: der Tisch öffnet dann sofort.
  const { orgName, orgSettings, activeEvent, eventsLoading, categories, products, productsLoading, vouchers, pfandTypes } =
    usePosData(eventId, true);
  const isTest = activeEvent?.status === 'test';

  useEffect(() => {
    if (activeEvent && eventId !== activeEvent.id) setEventId(activeEvent.id);
  }, [activeEvent, eventId, setEventId]);

  // ── Tischbetrieb (§2.3): Gerät `table` + Event `free`/`predefined` ──
  const tableDevice = serviceMode === 'table';
  const tablesQuery = useDeviceTables(activeEvent?.id ?? null, tableDevice);
  const tableMode = !tableDevice
    ? 'none'
    : !activeEvent
      ? eventsLoading
        ? null
        : 'none'
      : (tablesQuery.data?.mode ?? (tablesQuery.isError ? effectiveTableMode(activeEvent.settings?.tables) : null));
  const modeLoading = tableMode === null;
  const tablesEnabled = tableMode === 'free' || tableMode === 'predefined';
  /** Wofür gerade gebucht wird; `null` = Startansicht. Theke ohne Tischbetrieb. */
  const context: PosTableContext | null = tablesEnabled ? storedTable : COUNTER;
  const inOrderView = !modeLoading && !!context;

  const chargePfand = resolveChargePfand(orgSettings?.pfand, context?.kind === 'table' ? 'table' : 'counter');
  useCustomerDisplayBroadcast(socket, isConnected, chargePfand);

  const orderingMode = activeEvent?.settings?.orderingMode || orgSettings?.pos?.orderingMode || 'immediate';
  const isTab = orderingMode === 'tab';

  const areas = useMemo(() => sortAreas(tablesQuery.data?.areas ?? [], deviceAreaId), [tablesQuery.data, deviceAreaId]);
  // Kopf „Kasse 03 · Zelt A“: Standardbereich des Geräts, wenn freigegeben.
  const deviceAreaName = tablesEnabled ? (areas.find((a) => a.id === deviceAreaId)?.name ?? null) : null;
  const tableStatus = useTableStatus(eventId, { enabled: tablesEnabled, live: isConnected });
  const openTables = useMemo(
    () => (tablesEnabled ? mergeOpenTables(tableStatus.status, cart.parked, eventId, chargePfand) : []),
    [tablesEnabled, tableStatus.status, cart.parked, eventId, chargePfand],
  );

  // Offene Bestellungen des Kontexts: Tisch → Abschnitt „Gesendet“;
  // Theke + `tab` → Zähler „Offene Bestellungen“.
  const scope: OpenOrdersScope | null =
    context?.kind === 'table' ? { kind: 'table', tableKey: context.key } : isTab ? { kind: 'counter' } : null;
  const { orders: scopeOrders, refetch: refetchScope } = useOpenOrders(eventId, scope, inOrderView);
  const sentOrders = useMemo(() => (context?.kind === 'table' ? scopeOrders : []), [context, scopeOrders]);
  const counterOrderCount = context?.kind === 'table' ? 0 : scopeOrders.length;
  const printer = usePosDeviceStatus();

  const card = settings?.sumupReaderId && isIntegrationEnabled(orgSettings, 'sumup') ? 'sumup' : null;
  const contextLabel = !context
    ? ''
    : context.kind === 'table'
      ? t('cartV2.contextTable', { label: context.label })
      : context.kind === 'togo'
        ? t('tables.togo')
        : t('cartV2.contextCounter');

  const checkout = usePosCheckout({
    eventId,
    context: context ?? COUNTER,
    chargePfand,
    sentOrders,
    contextLabel,
    onTableInvalid: () => {
      if (!tablesEnabled) return;
      setCarryDefault(true);
      setSheet('table');
    },
  });

  // Nach Neuladen: eine erfolgreiche, nicht gespeicherte Kartenzahlung
  // wieder anzeigen („Erneut speichern“) statt erneut zu kassieren.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(UNSAVED_KEY)) setSheet('pay');
    } catch {
      // ohne sessionStorage gibt es nichts wiederherzustellen
    }
  }, []);

  const receipt = orgSettings?.orderFlow?.receiptPrinting;
  const canPrint = !!(settings?.defaultPrinterId || receipt?.printerId);
  const autoPrinted = !!receipt?.enabled && receipt.trigger === 'payment_received';

  /** Kontextwechsel: Warenkorb parken/laden, Gastbestellungen quittieren. */
  const openContext = useCallback(
    (next: PosTableContext | null, carry = false) => {
      const current = useDeviceStore.getState().table;
      setSheet(null);
      setCarryDefault(false);
      if (next && sameContext(current, next)) return;
      useCartStore.getState().switchContext(eventId, current, next, carry);
      setTable(next);
      if (next?.kind === 'table' && eventId) {
        const entry = openTables.find((e) => e.context.kind === 'table' && e.context.key === next.key);
        if (entry?.state === 'wait') {
          deviceTablesApi
            .acknowledge({ tableKey: next.key, eventId })
            .then(() => queryClient.invalidateQueries({ queryKey: ['device-table-status'] }))
            .catch(() => {});
        }
      }
    },
    [eventId, openTables, queryClient, setTable],
  );

  const serve = async (itemIds: string[]) => {
    setServing(true);
    try {
      const result = (await deviceTablesApi.deliverItems(itemIds)).data;
      toast(t('tables.served', { count: result.delivered.length + result.skipped.length }));
      await refetchScope();
      queryClient.invalidateQueries({ queryKey: ['device-table-status'] });
    } catch (error) {
      toast(apiErrorMessage(error), 'danger');
    } finally {
      setServing(false);
    }
  };

  const lock = () => {
    setSheet(null);
    setSession(null);
    toast(t('header.locked'), 'danger');
  };

  const handleLogout = async () => {
    await logout();
    router.push('/device/register');
  };

  // Nach dem Kassieren (F10): Tischbetrieb zurück zur Tischwahl, Theke bleibt.
  const nextReceipt = useCallback(() => {
    setDone(null);
    if (tablesEnabled) openContext(null);
  }, [tablesEnabled, openContext]);

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

  const totals = checkoutTotals(cart, chargePfand, sentOrders);
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
  const startMode = tableMode === 'predefined' ? 'predefined' : 'free';
  // „Rechnung teilen“ am Tisch; ungesendete Zeilen werden vorher gesendet.
  // An der Theke läuft Teilen über „Offene Bestellungen“.
  const canSplit = context?.kind === 'table' && (totals.openOrderIds.length > 0 || cart.items.length > 0);
  const openSplit = async () => {
    if (useCartStore.getState().items.length > 0) await checkout.send();
    if (useCartStore.getState().items.length === 0) setSheet('split');
  };

  let body: ReactNode;
  if (modeLoading) {
    body = (
      <div className="pos-center pos-grow">
        <Spinner />
      </div>
    );
  } else if (inOrderView) {
    body = (
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
        openOrders={
          isTab && context?.kind !== 'table'
            ? { count: counterOrderCount, onOpen: () => setSheet('openOrders') }
            : undefined
        }
        notices={testBanner}
        sent={
          context?.kind === 'table'
            ? { orders: sentOrders, openAmount: totals.sentOpen, onServe: serve, serving }
            : null
        }
      />
    );
  } else {
    body = (
      <PosStartView
        mode={startMode}
        areas={areas}
        view={startView}
        onViewChange={setStartView}
        openTables={openTables}
        openTablesLoading={tableStatus.isLoading}
        staleSince={connection === 'online' ? null : tableStatus.updatedAt}
        onOpen={(next) => openContext(next)}
        notices={testBanner}
      />
    );
  }

  return (
    <PosLiveProvider value={isConnected}>
      <div className={isTest ? 'pos-shell is-test' : 'pos-shell'}>
        <BroadcastToast messages={broadcasts} onDismiss={dismissBroadcast} />
        <PosHeader
          deviceName={deviceAreaName ? `${deviceName || 'POS'} · ${deviceAreaName}` : deviceName || 'POS'}
          eventName={activeEvent?.name ?? null}
          isTestEvent={isTest}
          table={
            tablesEnabled && inOrderView && context
              ? {
                  kind: context.kind,
                  label: context.kind === 'table' ? context.label : contextLabel,
                  onSwitch: () => setSheet('table'),
                }
              : null
          }
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

        {body}

        {tablesEnabled && (
          <TableSwitchSheet
            open={sheet === 'table'}
            onClose={() => {
              setSheet(null);
              setCarryDefault(false);
            }}
            mode={startMode}
            areas={areas}
            openTables={openTables}
            current={context}
            itemCount={cart.getItemCount()}
            carryDefault={carryDefault}
            onSelect={(next, carry) => openContext(next, carry)}
            onStart={() => openContext(null)}
          />
        )}
        <PaySheet
          open={sheet === 'pay'}
          onClose={() => setSheet(null)}
          title={t('pay.title', { context: contextLabel })}
          subtitle={t('order.itemCount', { count: cart.getItemCount() })}
          amount={totals.due}
          pfandIncluded={totals.pfand}
          card={card}
          discount={{ vouchers, applied: cart.appliedVouchers, onApply: cart.applyVoucher, onRemove: cart.removeVoucher }}
          onSplit={canSplit ? () => void openSplit() : undefined}
          onPay={async (result) => {
            const info = await checkout.pay(result);
            setSheet(null);
            setDone(info);
          }}
          disabled={offline}
          persistKey={UNSAVED_KEY}
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
          scope={context?.kind === 'table' ? { kind: 'table', tableKey: context.key } : { kind: 'counter' }}
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
    </PosLiveProvider>
  );
}
