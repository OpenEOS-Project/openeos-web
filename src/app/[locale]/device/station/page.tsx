'use client';

import { useEffect, useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useDeviceStore, useDeviceHydration } from '@/stores/device-store';
import { useDeviceSocket } from '@/hooks/use-device-socket';
import { useDisplayAppearance } from '@/hooks/use-display-appearance';
import { CircleAlert, CircleCheck as CheckCircleIcon } from 'lucide-react';
import { Icon } from '@openeos/ui';
import { deviceApi } from '@/lib/api-client';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import {
  buildStationBoard,
  mergeSnapshot,
  pickReadyAt,
  type BoardCard,
  type LocalReady,
  type StationOrder,
} from '@/lib/station-board';
import { StationHeader } from './components/station-header';
import { StationOrderCard } from './components/station-order-card';

export default function DeviceStationPage() {
  const t = useTranslations('device.station');
  const tUi = useTranslations('deviceUi.station');
  const router = useRouter();
  const queryClient = useQueryClient();
  const apiErrorMessage = useApiErrorMessage();
  const hasHydrated = useDeviceHydration();

  const {
    deviceId,
    deviceToken,
    status,
    settings: deviceSettings,
    deviceName,
  } = useDeviceStore();

  const stationId = deviceSettings?.stationId as string | undefined;
  const design = useDisplayAppearance();

  // Check auth after hydration
  useEffect(() => {
    if (!hasHydrated) return;
    if (!deviceId || !deviceToken || status !== 'verified') {
      router.replace('/device/display');
    }
  }, [hasHydrated, deviceId, deviceToken, status, router]);

  // Fetch organization info (for station name)
  const { data: orgData } = useQuery({
    queryKey: ['device-organization'],
    queryFn: () => deviceApi.getOrganization(),
    enabled: hasHydrated && status === 'verified',
  });

  /* Die Anzeige hing zuletzt an einer 30-Sekunden-Abfrage: eine Bestellung
     konnte eine halbe Minute in der Kueche liegen, bevor sie jemand sah.
     Die Ereignisse dafuer verschickt der Server laengst an den
     Organisationsraum, dem jedes Geraet beim Verbinden beitritt — es hat
     nur niemand zugehoert.

     Die Abfrage bleibt als Netz darunter, nur seltener: sie faengt die
     Luecke, waehrend die Verbindung weg ist. */
  const refreshDeviceStatus = useCallback(() => {
    void useDeviceStore.getState().checkStatus();
  }, []);

  const handleStationEvent = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['station-items'] });
  }, [queryClient]);

  const socketEvents = useMemo(
    () => ({
      orderCreated: handleStationEvent,
      orderUpdated: handleStationEvent,
      orderItemStatusChanged: handleStationEvent,
      kitchenOrderCancelled: handleStationEvent,
      // Ohne diesen Eintrag griffe eine Aenderung im Dashboard erst beim
      // naechsten Neuladen — auf einem Bildschirm ohne Tastatur also nie.
      deviceSettingsUpdated: refreshDeviceStatus,
    }),
    [handleStationEvent, refreshDeviceStatus],
  );

  const { isConnected } = useDeviceSocket({
    onConnect: handleStationEvent,
    on: socketEvents,
  });

  // Fetch station items
  const { data: stationData, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['station-items'],
    queryFn: () => deviceApi.getStationItems(),
    enabled: hasHydrated && status === 'verified' && !!stationId,
    /* Den Takt geben die Ereignisse vor; die Abfrage ist das Netz
       darunter. Wie eng es geknuepft sein muss, haengt davon ab, ob die
       Verbindung steht: solange sie steht, reicht ein seltener Blick.
       Ist sie weg, ist die Abfrage der einzige Weg — und eine Kueche darf
       nicht minutenlang blind sein, nur weil das WLAN gezuckt hat. */
    refetchInterval: isConnected ? 120000 : 15000,
  });

  const orders: StationOrder[] = useMemo(() => stationData?.data ?? [], [stationData]);

  /* Was dieser Bildschirm fertig gemeldet hat. Die API listet nur Offenes;
     ohne diese Merkliste verschwand eine Position nach dem Klick einfach
     — oder gar nichts geschah sichtbar, bis der Abruf durch war. */
  const [ready, setReady] = useState<ReadonlyMap<string, LocalReady>>(() => new Map());
  const [snapshots, setSnapshots] = useState<ReadonlyMap<string, StationOrder>>(() => new Map());
  const [pendingItemIds, setPendingItemIds] = useState<ReadonlySet<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  const [markError, setMarkError] = useState<string | null>(null);

  const markReady = useMutation({
    mutationFn: ({ itemId }: { itemId: string; entry: StationOrder }) => deviceApi.markStationItemReady(itemId),
    onMutate: ({ itemId, entry }) => {
      setMarkError(null);
      setPendingItemIds((prev) => new Set(prev).add(itemId));
      setSnapshots((prev) => new Map(prev).set(entry.order.id, mergeSnapshot(prev.get(entry.order.id), entry)));
    },
    onSuccess: (response, { itemId, entry }) => {
      const at = Date.now();
      const serverItem = response?.data?.items?.find((item) => item.id === itemId);
      setReady((prev) =>
        new Map(prev).set(itemId, { orderId: entry.order.id, readyAt: pickReadyAt(serverItem?.readyAt, at) }),
      );
      setNow(at);
      queryClient.invalidateQueries({ queryKey: ['station-items'] });
    },
    /* Vorher ohne jede Rueckmeldung: der Knopf wurde wieder aktiv, als sei
       nichts gewesen. Jetzt steht der Grund gut sichtbar unten im Bild. */
    onError: (error) => {
      setMarkError(apiErrorMessage(error, tUi('markReadyErrorHint')));
    },
    onSettled: (_data, _error, { itemId }) => {
      setPendingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    },
  });

  const handleItemReady = (entry: StationOrder, itemId: string) => markReady.mutate({ itemId, entry });

  const board = useMemo(
    () => buildStationBoard({ open: orders, snapshots, ready, now, autoClearSeconds: design.autoClearSeconds }),
    [orders, snapshots, ready, now, design.autoClearSeconds],
  );

  // Zum naechsten Wechsel (Ausblenden, Umzug in "Erledigt") neu rechnen.
  useEffect(() => {
    if (board.nextChangeAt === null) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, board.nextChangeAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [board.nextChangeAt]);

  // Ausgeblendetes aus der Merkliste nehmen, damit sie nicht waechst.
  useEffect(() => {
    if (board.forget.length === 0) return;
    const gone = new Set(board.forget);
    setSnapshots((prev) => new Map([...prev].filter(([orderId]) => !gone.has(orderId))));
    setReady((prev) => new Map([...prev].filter(([, entry]) => !gone.has(entry.orderId))));
  }, [board.forget]);

  // Fehlerhinweis verschwindet nach einer Weile von selbst.
  useEffect(() => {
    if (!markError) return;
    const timer = window.setTimeout(() => setMarkError(null), 8000);
    return () => window.clearTimeout(timer);
  }, [markError]);

  // Loading
  if (!hasHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-secondary">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  if (!deviceId || status !== 'verified') {
    return (
      <div className="flex h-screen items-center justify-center bg-secondary">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  // No station configured
  if (!stationId) {
    return (
      <div className="flex h-screen flex-col bg-secondary">
        <StationHeader
          stationName={deviceName || t('title')}
          isConnected={isConnected}
          logoUrl={design.logoUrl}
          showLogo={design.showLogo}
        />
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-center text-lg text-tertiary">{t('noStation')}</p>
        </div>
      </div>
    );
  }

  const totalItems = orders.reduce((sum, o) => sum + o.items.length, 0);
  const isService = (card: BoardCard) => card.order.fulfillmentType === 'table_service';
  const hasCards = board.cards.length > 0 || board.archived.length > 0;

  const renderCards = (cards: BoardCard[], variant: 'service' | 'pickup', archived = false) =>
    cards.map((card) => (
      <StationOrderCard
        key={card.order.id}
        order={card.order}
        items={card.items}
        onItemReady={(itemId) => handleItemReady(card, itemId)}
        pendingItemIds={pendingItemIds}
        phase={card.phase}
        archived={archived}
        isNew={false}
        variant={variant}
      />
    ));

  const renderColumn = (variant: 'service' | 'pickup') => {
    const cards = board.cards.filter((card) => isService(card) === (variant === 'service'));
    const archived = board.archived.filter((card) => isService(card) === (variant === 'service'));
    const openCount = cards.filter((card) => card.phase === 'open').length;
    const tone =
      variant === 'service'
        ? {
            head: 'bg-blue-light-50 dark:bg-blue-light-950',
            title: 'text-blue-light-700 dark:text-blue-light-400',
            count: 'bg-blue-light-100 text-blue-light-700 dark:bg-blue-light-900 dark:text-blue-light-400',
          }
        : {
            head: 'bg-success-50 dark:bg-success-950',
            title: 'text-success-700 dark:text-success-400',
            count: 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-400',
          };
    return (
      <div className="flex flex-col overflow-hidden rounded-xl border border-secondary bg-primary">
        <div className={`flex items-center gap-2 border-b border-secondary px-4 py-3 ${tone.head}`}>
          <span className={`text-sm font-semibold ${tone.title}`}>
            {variant === 'service' ? tUi('serviceColumn') : tUi('pickupColumn')}
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone.count}`}>
            {openCount}
          </span>
        </div>
        <div className="flex-1 overflow-auto p-3">
          {cards.length === 0 && archived.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-tertiary">{t('noOrders')}</p>
            </div>
          ) : (
            <>
              {cards.length === 0 ? (
                <p className="py-6 text-center text-sm text-tertiary">{t('noOrders')}</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{renderCards(cards, variant)}</div>
              )}
              {/* Ohne "Erledigte ausblenden" landen fertige Karten hier,
                  abgesetzt und abgeschwaecht — nachsehen statt suchen. */}
              {archived.length > 0 && (
                <section className="mt-4 border-t border-secondary pt-3" aria-label={tUi('done')}>
                  <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-tertiary">
                    <Icon name="check-circle" size={14} />
                    {tUi('done')}
                  </h2>
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{renderCards(archived, variant, true)}</div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex h-screen flex-col bg-secondary ${design.klasse}`}>
      <StationHeader
        stationName={design.headline || deviceName || t('title')}
        stationColor={null}
        isConnected={isConnected}
        organizationName={orgData?.data?.name}
        orderCount={orders.length}
        itemCount={totalItems}
        logoUrl={design.logoUrl}
        showLogo={design.showLogo}
      />

      <div className="flex-1 overflow-hidden p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="size-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
              <span className="text-sm text-tertiary">{tUi('loading')}</span>
            </div>
          </div>
        ) : isError && orders.length === 0 ? (
          /* Ohne diesen Zweig zeigte ein Fehler beim Laden dieselbe Flaeche
             wie "keine Bestellungen" — samt "Verbunden". Eine Kueche haette
             dann auf Bons gewartet, die nie erscheinen. */
          <div className="flex h-full items-center justify-center">
            <div className="flex max-w-md flex-col items-center gap-4 text-center" role="alert">
              <div className="flex size-20 items-center justify-center rounded-full bg-error-secondary">
                <CircleAlert className="size-10 text-error-primary" />
              </div>
              <div>
                <p className="text-xl font-semibold text-primary">{tUi('loadError')}</p>
                <p className="mt-1 text-sm text-tertiary">{tUi('loadErrorHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="min-h-11 rounded-lg border border-secondary bg-primary px-4 text-sm font-semibold text-primary disabled:opacity-60"
              >
                {isFetching ? tUi('loading') : tUi('retry')}
              </button>
            </div>
          </div>
        ) : !hasCards ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-20 items-center justify-center rounded-full bg-brand-50 ring-8 ring-brand-25 dark:bg-brand-950 dark:ring-brand-900/30">
                <CheckCircleIcon className="size-10 text-brand-600 dark:text-brand-400" />
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-primary">
                  {design.idleText || t('noOrders')}
                </p>
                {/* Der echte Zustand der Verbindung statt fest "Verbunden". */}
                <p className={`mt-1 text-sm ${isConnected ? 'text-tertiary' : 'text-error-primary'}`}>
                  {isConnected ? t('connected') : tUi('reconnecting')}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid h-full grid-cols-2 gap-4">
            {renderColumn('service')}
            {renderColumn('pickup')}
          </div>
        )}
      </div>

      {markError && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div
            role="alert"
            className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-xl border-2 border-red-500 bg-primary px-4 py-3 shadow-lg dark:border-red-400"
          >
            <CircleAlert className="size-6 shrink-0 text-error-primary" />
            <div className="min-w-0">
              <p className="text-base font-semibold text-primary">{tUi('markReadyError')}</p>
              <p className="text-sm text-tertiary">{markError}</p>
            </div>
            <button
              type="button"
              onClick={() => setMarkError(null)}
              aria-label={tUi('dismiss')}
              className="ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-tertiary hover:bg-secondary"
            >
              <Icon name="x" size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
