'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banner, Icon, Spinner } from '@openeos/ui';
import { isIntegrationEnabled } from '@/config/integrations';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useCustomerDisplayBroadcast } from '@/hooks/use-customer-display-broadcast';
import { useDeviceSocket, type BroadcastMessage } from '@/hooks/use-device-socket';
import { useDeviceTables } from '@/hooks/use-device-tables';
import { usePosConnection } from '@/hooks/use-pos-connection';
import { useTableStatus } from '@/hooks/use-table-status';
import { deviceApi } from '@/lib/api-client';
import { effectiveOrderingMode, resolveOperatingMode, tableCloseState } from '@/lib/operating-mode';
import { deviceTablesApi } from '@/lib/device-tables-api';
import { useCartStore } from '@/stores/cart-store';
import { useDeviceHydration, useDeviceStore } from '@/stores/device-store';
import { useWaiterSessionStore } from '@/stores/waiter-session-store';
import type { PosTableContext } from '@/types/table';
import { cashDrawerAvailable } from '@/utils/cash-drawer';
import { resolveChargePfand } from '@/utils/pfand';
import { resolvePosCardMode } from '@/utils/pos-card-mode';
import { BroadcastToast } from './components/broadcast-toast';
import { CashbookSheet } from './components/cashbook-sheet';
import { DoneSheet, type DoneInfo } from './components/done-sheet';
import { EmergencySupportSheet } from './components/emergency-support-sheet';
import { LogoutSheet } from './components/logout-sheet';
import { OpenOrdersSheet } from './components/open-orders-sheet';
import { OrderHistorySheet } from './components/order-history-sheet';
import { PaySheet } from './components/pay-sheet';
import { PfandReturnModal } from './components/pfand-return-modal';
import { PinEntryScreen } from './components/pin-entry-screen';
import { PosEndedBanner, PosTestModeBanner } from './components/pos-event-selector';
import { useEventPhase } from '@/lib/event-phase';
import { useDeviceEmergencySupport } from '@/hooks/use-support';
import { showEmergencyAtPos } from '@/lib/emergency-support';
import { PosHeader, type PosMenuAction } from './components/pos-header';
import { PosFooter } from './components/pos-footer';
import { PosOrderView } from './components/pos-order-view';
import { PosLayerProvider } from './components/pos-sheet';
import { PosStartView } from './components/pos-start-view';
import { PosToastProvider, usePosToast } from './components/pos-toast';
import { SplitPaymentModal } from './components/split-payment-modal';
import { TableSwitchSheet } from './components/table-switch-sheet';
import { useOpenOrders, type OpenOrdersScope } from './hooks/use-open-orders';
import { checkoutTotals, usePosCheckout } from './hooks/use-pos-checkout';
import { usePosData } from './hooks/use-pos-data';
import { usePosTheme } from './hooks/use-pos-theme';
import {
  PosLiveProvider,
  usePosDeviceStatus,
  usePosSocketEvents,
  usePosTseStatus,
  type OrderTransferredPayload,
} from './hooks/use-pos-live';
import { usePosTseOutage } from './hooks/use-pos-tse';
import { effectiveTableMode, mergeOpenTables, resolveTableSelectView, sameContext, sortAreas } from './utils/tables';
import { posNotice } from './utils/pos-notice';
import { useWaiterSession } from './hooks/use-waiter-session';
import { WaiterChip } from './components/waiter-chip';
import { WaiterHandoverSheet } from './components/waiter-handover-sheet';
import { WaiterSettleSheet } from './components/waiter-settle-sheet';
import { foreignOwner, isLeadWaiter, isMyTable, may, waiterLabel, type TableFilter } from '@/lib/waiters';

type SheetId =
  | 'pay'
  | 'history'
  | 'openOrders'
  | 'split'
  | 'pfand'
  | 'cashbook'
  | 'logout'
  | 'table'
  | 'emergency'
  | 'waiterSummary'
  | 'waiterSettle'
  | 'handover'
  | null;

/** Kartenzahlung ohne gespeicherte Bestellung (Kassieren-Blatt der Bestellansicht). */
const UNSAVED_KEY = 'openeos-pos-unsaved-card';
const COUNTER: PosTableContext = { kind: 'counter' };

export default function DevicePosPage() {
  const tUi = useTranslations('deviceUi');
  const router = useRouter();
  const hydrated = useDeviceHydration();
  const { deviceId, deviceToken, status, checkStatus, posTheme } = useDeviceStore();
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  usePosTheme(posTheme ?? 'system');

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
  const {
    deviceName,
    settings,
    table: storedTable,
    setTable,
    posTheme,
    setPosTheme,
    logout,
  } = useDeviceStore();
  const serviceMode = (settings?.serviceMode as string) || 'table';
  const deviceAreaId = (settings?.tableAreaId as string | undefined) ?? null;
  const cart = useCartStore();
  const { eventId, setEventId } = cart;

  const [sheet, setSheet] = useState<SheetId>(null);
  // Bedienungen (bedienungen-plan.md §6): keine automatische Sperre,
  // solange ein Bezahl-Blatt (auch SumUp) offen ist.
  const waiterSession = useWaiterSession({ busy: sheet === 'pay' || sheet === 'split' });
  const { mode: waiterMode, waiter } = waiterSession;
  const sharedTill = waiterMode === 'shared';
  const [tableFilter, setTableFilter] = useState<TableFilter>('mine');
  const [carryDefault, setCarryDefault] = useState(false);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [printing, setPrinting] = useState(false);
  const [serving, setServing] = useState(false);
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);

  const handleBroadcast = useCallback((message: BroadcastMessage) => {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setBroadcasts((prev) => [...prev, message]);
  }, []);
  const dismissBroadcast = useCallback((id: string) => {
    setBroadcasts((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Tisch übergeben: Hinweis an die neue Bedienung (an jedem ihrer Geräte).
  const tSettle = useTranslations('waiterSettlement');
  const handleOrderTransferred = useCallback(
    (payload: OrderTransferredPayload) => {
      const me = useWaiterSessionStore.getState().waiter;
      if (!me?.waiterId || payload.toWaiterId !== me.waiterId) return;
      toast(
        payload.tableNumber
          ? tSettle('toast.receivedTable', { table: payload.tableNumber })
          : tSettle('toast.receivedOrder', { count: payload.orderIds.length }),
      );
    },
    [toast, tSettle],
  );
  const socketOptions = usePosSocketEvents(
    eventId,
    handleBroadcast,
    waiterSession.onWaiterUpdated,
    handleOrderTransferred,
  );
  const { socket, isConnected } = useDeviceSocket(socketOptions);
  const connection = usePosConnection(isConnected);
  const offline = connection === 'offline';

  // Produkte laden schon auf der Startansicht: der Tisch öffnet dann sofort.
  const {
    orgName,
    orgSettings,
    organization,
    activeEvent,
    eventsLoading,
    categories,
    products,
    productsLoading,
    vouchers,
    pfandTypes,
  } = usePosData(eventId, true);
  // Phase der Veranstaltung: „Geplant“ bucht wie der Testmodus
  // Testbestellungen (Testbetrieb bis zum Verkaufsfenster), „Beendet“
  // nimmt keine neuen Bestellungen mehr an.
  const eventPhase = useEventPhase(activeEvent);
  const isTest = eventPhase === 'test' || eventPhase === 'planned';
  // Notfall-Support (AGB 18.2) im Menü, solange die gebuchte Veranstaltung echt verkauft.
  const emergency = useDeviceEmergencySupport(!!activeEvent).data;
  const showEmergency = eventPhase === 'active' && showEmergencyAtPos(emergency, activeEvent);
  // Betriebsart (lädt bei `organizationSettingsUpdated` neu, siehe use-pos-live):
  // ohne Bargeld kein Bar, keine Kassenlade, keine Pfand-Auszahlung;
  // „Nur Bons“ ohne Preise und Zahlungen — senden, Küche, Ausgabe, abschließen.
  const operating = resolveOperatingMode(organization);
  const cashless = !operating.cashAllowed;
  const orderOnly = operating.ordersOnly;

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

  // „Nur Bons“: kein Pfand (keine Beträge, keine Auszahlung).
  const chargePfand =
    !orderOnly && resolveChargePfand(orgSettings?.pfand, context?.kind === 'table' ? 'table' : 'counter');
  useCustomerDisplayBroadcast(socket, isConnected, chargePfand, orderOnly);

  const orderingMode = effectiveOrderingMode(
    activeEvent?.settings?.orderingMode || orgSettings?.pos?.orderingMode,
    orderOnly,
  );
  const isTab = orderingMode === 'tab';

  const areas = useMemo(() => sortAreas(tablesQuery.data?.areas ?? [], deviceAreaId), [tablesQuery.data, deviceAreaId]);
  // Tischwahl fest je Gerät (Verwaltung); ohne Einstellung Karte, wenn der
  // Standardbereich einen Tischplan hat, sonst Liste. Freie Nummer: Ziffernblock.
  const selectView = resolveTableSelectView(
    tableMode === 'free' ? 'free' : 'predefined',
    settings?.tableSelectView,
    areas,
    deviceAreaId,
  );
  // Kopf „Kasse 03 · Zelt A“: Standardbereich des Geräts, wenn freigegeben.
  const deviceAreaName = tablesEnabled ? (areas.find((a) => a.id === deviceAreaId)?.name ?? null) : null;
  const tableStatus = useTableStatus(eventId, { enabled: tablesEnabled, live: isConnected });
  const openTables = useMemo(() => {
    if (!tablesEnabled) return [];
    const entries = mergeOpenTables(tableStatus.status, cart.parked, eventId, chargePfand);
    // „Nur Bons“: keine offenen Beträge — der Tisch ist nur „offen“.
    return orderOnly ? entries.map((entry) => ({ ...entry, amount: 0 })) : entries;
  }, [tablesEnabled, tableStatus.status, cart.parked, eventId, chargePfand, orderOnly]);
  // Bedienungen (Kurzname, Farbe) für Tischbesitz und Hinweise.
  const waiterTiles = useQuery({
    queryKey: ['device-waiters'],
    queryFn: () => deviceApi.getWaiterTiles(),
    enabled: waiterMode !== 'off',
    staleTime: 60_000,
  }).data?.data;
  const waiterById = useMemo(() => new Map((waiterTiles ?? []).map((w) => [w.id, w])), [waiterTiles]);
  // „Meine Tische“ (gemeinsame Kasse): meine und noch niemandem zugeordnete.
  const visibleOpenTables = useMemo(
    () =>
      sharedTill && waiter?.waiterId && tableFilter === 'mine'
        ? openTables.filter((entry) => isMyTable(entry, waiter.waiterId))
        : openTables,
    [openTables, sharedTill, waiter?.waiterId, tableFilter],
  );

  // Offene Bestellungen des Kontexts: Tisch → Abschnitt „Gesendet“;
  // Theke + `tab` → Zähler „Offene Bestellungen“.
  const scope: OpenOrdersScope | null =
    context?.kind === 'table' ? { kind: 'table', tableKey: context.key } : isTab ? { kind: 'counter' } : null;
  const { orders: scopeOrders, refetch: refetchScope } = useOpenOrders(eventId, scope, inOrderView);
  const sentOrders = useMemo(() => (context?.kind === 'table' ? scopeOrders : []), [context, scopeOrders]);
  const counterOrderCount = context?.kind === 'table' ? 0 : scopeOrders.length;
  const printer = usePosDeviceStatus();
  // Cloud-TSE: Ausfall-Hinweis (letzter Vorgang ohne Signatur oder offener
  // Ausfall laut Server). Trainingsbuchungen im Testbetrieb deckt dessen
  // Hinweis ab.
  const tseStatus = usePosTseStatus();
  const tseOutage = usePosTseOutage(tseStatus);
  // Genau ein Hinweis unter dem Kopf (Reihenfolge siehe posNotice).
  const notice = posNotice({
    phase: eventPhase,
    offline,
    tseOutage,
    cashBlocked: operating.cashBlockedWithoutTse,
    orderOnly,
  });
  const hasBand = notice === 'ended' || notice === 'planned' || notice === 'test';

  // Testmodus: SumUp-Zahlart deaktiviert, keine Aufrufe am Lesegerät.
  const card = orderOnly
    ? null
    : resolvePosCardMode({
        readerLinked: !!settings?.sumupReaderId,
        sumupEnabled: isIntegrationEnabled(orgSettings, 'sumup'),
        isTest,
        cashless,
      });
  const contextLabel = !context
    ? ''
    : context.kind === 'table'
      ? t('cartV2.contextTable', { label: context.label })
      : context.kind === 'togo'
        ? t('tables.togo')
        : t('cartV2.contextCounter');

  const checkout = usePosCheckout({
    eventId,
    orderingMode,
    context: context ?? COUNTER,
    chargePfand,
    sentOrders,
    contextLabel,
    orderOnly,
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
        // Fremder Tisch: buchen und kassieren erlaubt, mit Hinweis (E6).
        const owner = foreignOwner(entry, useWaiterSessionStore.getState().waiter?.waiterId);
        if (owner) {
          const tile = waiterById.get(owner);
          toast(t('waiter.foreignTable', { name: tile ? waiterLabel({ name: tile.shortName }) : '?' }));
        }
        if (entry?.state === 'wait') {
          deviceTablesApi
            .acknowledge({ tableKey: next.key, eventId })
            .then(() => queryClient.invalidateQueries({ queryKey: ['device-table-status'] }))
            .catch(() => {});
        }
      }
    },
    [eventId, openTables, queryClient, setTable, waiterById, toast, t],
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

  // „Tisch abschließen“ (Nur Bons): statt „Kassieren“ — alle offenen
  // Bestellungen des Tisches, danach zurück zur Tischwahl.
  const [closingTable, setClosingTable] = useState(false);
  const closeTable = async () => {
    const { orderIds, canClose } = tableCloseState(sentOrders);
    if (!canClose) return;
    setClosingTable(true);
    try {
      await deviceTablesApi.completeOrders(orderIds);
      toast(t('orderOnly.tableClosed'));
      for (const key of ['device-open-orders', 'device-table-status', 'device-order-history']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      openContext(null);
    } catch (error) {
      toast(apiErrorMessage(error), 'danger');
      await refetchScope();
    } finally {
      setClosingTable(false);
    }
  };

  const lock = (reason: 'lock' | 'switch' | 'logout' = 'lock') => {
    setSheet(null);
    void waiterSession.lock(reason);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/device/register');
  };

  // Nach dem Kassieren (F10): Tischbetrieb zurück zur Tischwahl, Theke bleibt.
  const nextReceipt = useCallback(() => {
    setDone(null);
    if (tablesEnabled) openContext(null);
    // „Nach jedem Kassieren sperren“ (Theke).
    if (waiterSession.lockAfterPayment) void waiterSession.lock('lock');
  }, [tablesEnabled, openContext, waiterSession]);

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

  if (sharedTill && !waiter) {
    return (
      <PinEntryScreen
        deviceName={deviceName || 'POS'}
        onSuccess={waiterSession.signIn}
        onLogout={handleLogout}
        offline={offline}
        lockReason={waiterSession.lockReason}
        parkedFor={waiterSession.parkedFor}
        tiles={waiterSession.tiles}
      />
    );
  }
  if (waiterMode === 'personal' && waiterSession.personal === 'unassigned') {
    return (
      <div className="pos-blocked" data-testid="pos-waiter-unassigned">
        <div className="oe-card">
          <Icon name="lock" size={28} />
          <h1>{t('waiter.unassignedTitle')}</h1>
          <p>{t('waiter.unassignedText')}</p>
        </div>
      </div>
    );
  }

  const totals = checkoutTotals(cart, chargePfand, sentOrders);
  // Offener Tisch mit gesendeten Bestellungen: übergeben (eigene jede
  // Bedienung, fremde nur Schichtleitung — der Server prüft das).
  const currentEntry =
    context?.kind === 'table'
      ? openTables.find((entry) => entry.context.kind === 'table' && entry.context.key === context.key)
      : undefined;
  const handoverTarget =
    waiterMode !== 'off' && !!waiter && context?.kind === 'table' && totals.openOrderIds.length > 0
      ? {
          orderId: totals.openOrderIds[0],
          tableNumber: context.label,
          ownerId: currentEntry?.waiterId ?? null,
        }
      : null;
  const menu: PosMenuAction[] = [
    { id: 'history', icon: 'clock', label: t('menu.history'), onSelect: () => setSheet('history') },
    ...(isTab ? [{ id: 'open', icon: 'orders' as const, label: t('menu.openOrders'), onSelect: () => setSheet('openOrders') }] : []),
    ...(pfandTypes.length > 0 && !orderOnly
      ? [{ id: 'pfand', icon: 'deposit' as const, label: t('menu.pfandReturn'), onSelect: () => setSheet('pfand') }]
      : []),
    // Kassenbuch (Anfangsbestand, Einlage, Entnahme, Kassensturz): nur mit Bargeld.
    ...(operating.cashAllowed && !orderOnly && may(waiter, 'cashbook')
      ? [{ id: 'cashbook', icon: 'note' as const, label: t('menu.cashbook'), onSelect: () => setSheet('cashbook') }]
      : []),
    ...(!orderOnly && cashDrawerAvailable({ settings, cashless }) && may(waiter, 'cashDrawer')
      ? [{
          id: 'drawer',
          icon: 'drawer' as const,
          label: t('menu.cashDrawer'),
          disabled: offline,
          onSelect: () => deviceApi.openCashDrawer().then(() => toast(t('menu.cashDrawerOpened')), () => toast(t('menu.cashDrawerFailed'), 'danger')),
        }]
      : []),
    // Tisch übergeben (Bedienungen): am offenen Tisch mit gesendeten Bestellungen.
    ...(handoverTarget
      ? [{
          id: 'handover',
          icon: 'users' as const,
          label: t('waiter.handover'),
          disabled: offline,
          onSelect: () => setSheet('handover'),
        }]
      : []),
    ...(showEmergency
      ? [{ id: 'emergency', icon: 'alert' as const, label: t('menu.emergency'), onSelect: () => setSheet('emergency') }]
      : []),
  ];

  const startMode = tableMode === 'predefined' ? 'predefined' : 'free';
  // „Rechnung teilen“ am Tisch. Im Modus `tab` werden ungesendete Zeilen
  // vorher gesendet; im Modus `immediate` entsteht nie eine unbezahlte
  // Bestellung (F8) — geteilt werden dort nur schon offene Bestellungen
  // (Gastbestellung, Rest), solange nichts Ungesendetes im Warenkorb liegt.
  // An der Theke läuft Teilen über „Offene Bestellungen“.
  const canSplit =
    !orderOnly &&
    context?.kind === 'table' &&
    (isTab
      ? totals.openOrderIds.length > 0 || cart.items.length > 0
      : totals.openOrderIds.length > 0 && cart.items.length === 0);
  const openSplit = async () => {
    if (isTab && useCartStore.getState().items.length > 0) await checkout.send();
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
        orderOnly={orderOnly}
        actionsDisabled={offline || checkout.isSending || !eventId}
        isSending={checkout.isSending}
        onSend={checkout.send}
        onCheckout={() => setSheet('pay')}
        onPfandReturn={pfandTypes.length > 0 && !orderOnly ? () => setSheet('pfand') : undefined}
        openOrders={
          isTab && context?.kind !== 'table'
            ? { count: counterOrderCount, onOpen: () => setSheet('openOrders') }
            : undefined
        }
        sent={
          context?.kind === 'table'
            ? {
                orders: sentOrders,
                openAmount: orderOnly ? 0 : totals.sentOpen,
                onServe: serve,
                serving,
                ...(orderOnly ? { onClose: () => void closeTable(), closing: closingTable } : {}),
              }
            : null
        }
      />
    );
  } else {
    body = (
      <PosStartView
        mode={startMode}
        areas={areas}
        view={selectView}
        openTables={visibleOpenTables}
        openTablesLoading={tableStatus.isLoading}
        tableFilter={sharedTill && waiter?.waiterId ? { value: tableFilter, onChange: setTableFilter } : undefined}
        waiters={waiterById}
        staleSince={connection === 'online' ? null : tableStatus.updatedAt}
        onOpen={(next) => openContext(next)}
      />
    );
  }

  return (
    <PosLiveProvider value={isConnected}>
      <div className={hasBand ? 'pos-shell has-band' : 'pos-shell'}>
        <BroadcastToast messages={broadcasts} onDismiss={dismissBroadcast} />
        <PosHeader
          deviceName={deviceAreaName ? `${deviceName || 'POS'} · ${deviceAreaName}` : deviceName || 'POS'}
          organizationName={orgName}
          eventName={activeEvent?.name ?? null}
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
          user={null}
          waiter={
            waiter ? (
              <WaiterChip
                waiter={waiter}
                shared={sharedTill}
                onSwitch={() => lock('switch')}
                onLock={() => lock('lock')}
                onSignOut={() => lock('logout')}
                onSummary={() => setSheet('waiterSummary')}
                onSettle={isLeadWaiter(waiter) ? () => setSheet('waiterSettle') : undefined}
              />
            ) : undefined
          }
          menu={menu}
          theme={posTheme ?? 'system'}
          onThemeChange={setPosTheme}
          onLogout={() => setSheet('logout')}
        />
        {notice === 'ended' && <PosEndedBanner />}
        {(notice === 'planned' || notice === 'test') && (
          <PosTestModeBanner realSalesFrom={notice === 'planned' ? activeEvent?.realSalesFrom : null} />
        )}
        {notice === 'offline' && (
          <Banner tone="danger" icon={<Icon name="wifi-off" />} className="pos-offline">
            {t('offline.banner')}
          </Banner>
        )}
        {notice === 'tseOutage' && (
          <Banner tone="warn" icon={<Icon name="alert" />} className="pos-orderonly pos-tse-outage">
            {t('tseOutage.banner')}
          </Banner>
        )}
        {notice === 'cashBlocked' && (
          <Banner tone="warn" icon={<Icon name="alert" />} className="pos-orderonly">
            {t('cashBlocked.banner')}
          </Banner>
        )}
        {notice === 'orderOnly' && (
          <Banner tone="info" icon={<Icon name="info" />} className="pos-orderonly">
            {t('orderOnly.banner')}
          </Banner>
        )}

        {body}
        <PosFooter variant="line" />

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
            view={selectView}
          />
        )}
        {!orderOnly && (
        <PaySheet
          open={sheet === 'pay'}
          onClose={() => setSheet(null)}
          title={t('pay.title', { context: contextLabel })}
          subtitle={t('order.itemCount', { count: cart.getItemCount() })}
          amount={totals.due}
          pfandIncluded={totals.pfand}
          card={card}
          discount={
            // Rabatt-Bons nur mit Recht „Rabatt“ (Bedienung ohne Schalter: aus).
            may(waiter, 'discount')
              ? { vouchers, applied: cart.appliedVouchers, onApply: cart.applyVoucher, onRemove: cart.removeVoucher }
              : null
          }
          onSplit={canSplit ? () => void openSplit() : undefined}
          onPay={async (result) => {
            const info = await checkout.pay(result);
            setSheet(null);
            setDone(info);
          }}
          disabled={offline}
          persistKey={UNSAVED_KEY}
        />
        )}
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
        <OrderHistorySheet
          isOpen={sheet === 'history'}
          onClose={() => setSheet(null)}
          eventId={eventId}
          card={card ?? 'manual'}
          disabled={offline}
          onPaid={setDone}
          orderOnly={orderOnly}
        />
        <OpenOrdersSheet
          isOpen={sheet === 'openOrders'}
          onClose={() => setSheet(null)}
          eventId={eventId}
          card={card ?? 'manual'}
          disabled={offline}
          onSplit={() => setSheet('split')}
          onPaid={setDone}
          orderOnly={orderOnly}
        />
        {!orderOnly && (
        <SplitPaymentModal
          isOpen={sheet === 'split'}
          onClose={() => setSheet(null)}
          eventId={eventId}
          scope={context?.kind === 'table' ? { kind: 'table', tableKey: context.key } : { kind: 'counter' }}
          card={card ?? 'manual'}
          disabled={offline}
        />
        )}
        {!orderOnly && (
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
          cashless={cashless}
          receiptContext={{
            title: orgName || 'OpenEOS',
            eventName: activeEvent?.name ?? null,
            deviceName: deviceName || 'POS',
            isTest,
            canPrint,
          }}
        />
        )}
        {operating.cashAllowed && !orderOnly && (
          <CashbookSheet open={sheet === 'cashbook'} onClose={() => setSheet(null)} disabled={offline} />
        )}
        {showEmergency && emergency && (
          <EmergencySupportSheet open={sheet === 'emergency'} onClose={() => setSheet(null)} info={emergency} />
        )}
        {waiter && (
          <WaiterSettleSheet
            mode={sheet === 'waiterSummary' ? 'summary' : sheet === 'waiterSettle' ? 'settle' : null}
            onClose={() => setSheet(null)}
            me={waiter}
            tiles={waiterTiles ?? []}
            disabled={offline}
          />
        )}
        <WaiterHandoverSheet
          order={sheet === 'handover' && handoverTarget ? handoverTarget : null}
          tiles={waiterTiles ?? []}
          excludeId={handoverTarget?.ownerId ?? null}
          onClose={() => setSheet(null)}
          onDone={() => setSheet(null)}
        />
        <LogoutSheet open={sheet === 'logout'} onClose={() => setSheet(null)} onConfirm={handleLogout} />
      </div>
    </PosLiveProvider>
  );
}
