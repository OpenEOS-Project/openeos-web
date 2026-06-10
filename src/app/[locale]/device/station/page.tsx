'use client';

import { useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useDeviceStore, useDeviceHydration } from '@/stores/device-store';
import { useDeviceSocket } from '@/hooks/use-device-socket';
import { CheckCircle as CheckCircleIcon } from '@untitledui/icons';
import { deviceApi } from '@/lib/api-client';
import { StationHeader } from './components/station-header';
import { StationOrderCard } from './components/station-order-card';

interface StationOrderItem {
  id: string;
  productName: string;
  categoryName: string;
  quantity: number;
  status: string;
  notes: string | null;
  kitchenNotes: string | null;
  options: any;
  createdAt: string;
}

interface StationOrder {
  order: {
    id: string;
    orderNumber: string;
    dailyNumber: number;
    tableNumber: string | null;
    customerName: string | null;
    priority: string;
    createdAt: string;
    fulfillmentType: string;
    source: string;
  };
  items: StationOrderItem[];
}

export default function DeviceStationPage() {
  const t = useTranslations('device.station');
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasHydrated = useDeviceHydration();

  const {
    deviceId,
    deviceToken,
    status,
    settings: deviceSettings,
    deviceName,
  } = useDeviceStore();

  const stationId = deviceSettings?.stationId as string | undefined;

  // Check auth after hydration
  useEffect(() => {
    if (!hasHydrated) return;
    if (!deviceId || !deviceToken || status !== 'verified') {
      router.replace('/device/register');
    }
  }, [hasHydrated, deviceId, deviceToken, status, router]);

  // Fetch organization info (for station name)
  const { data: orgData } = useQuery({
    queryKey: ['device-organization'],
    queryFn: () => deviceApi.getOrganization(),
    enabled: hasHydrated && status === 'verified',
  });

  // Fetch station items
  const { data: stationData, isLoading } = useQuery({
    queryKey: ['station-items'],
    queryFn: () => deviceApi.getStationItems(),
    enabled: hasHydrated && status === 'verified' && !!stationId,
    refetchInterval: 30000,
  });

  const orders: StationOrder[] = stationData?.data || [];

  // Mark item ready mutation
  const markReady = useMutation({
    mutationFn: (itemId: string) => deviceApi.markStationItemReady(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-items'] });
    },
  });

  // Station realtime was removed — data arrives via the 30s poll; refetch
  // immediately whenever the socket (re)connects so the view is fresh.
  const handleStationEvent = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['station-items'] });
  }, [queryClient]);

  const { isConnected } = useDeviceSocket({ onConnect: handleStationEvent });

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
        />
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-center text-lg text-tertiary">{t('noStation')}</p>
        </div>
      </div>
    );
  }

  const totalItems = orders.reduce((sum, o) => sum + o.items.length, 0);
  const serviceOrders = orders.filter(o => o.order.fulfillmentType === 'table_service');
  const pickupOrders = orders.filter(o => o.order.fulfillmentType !== 'table_service');

  return (
    <div className="flex h-screen flex-col bg-secondary">
      <StationHeader
        stationName={deviceName || t('title')}
        stationColor={null}
        isConnected={isConnected}
        organizationName={orgData?.data?.name}
        orderCount={orders.length}
        itemCount={totalItems}
      />

      <div className="flex-1 overflow-hidden p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="size-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
              <span className="text-sm text-tertiary">Laden...</span>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-20 items-center justify-center rounded-full bg-brand-50 ring-8 ring-brand-25 dark:bg-brand-950 dark:ring-brand-900/30">
                <CheckCircleIcon className="size-10 text-brand-600 dark:text-brand-400" />
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-primary">{t('noOrders')}</p>
                <p className="mt-1 text-sm text-tertiary">{t('connected')}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid h-full grid-cols-2 gap-4">
            {/* Left: Bedienungen (Table Service) */}
            <div className="flex flex-col overflow-hidden rounded-xl border border-secondary bg-primary">
              <div className="flex items-center gap-2 border-b border-secondary bg-blue-light-50 px-4 py-3 dark:bg-blue-light-950">
                <span className="text-sm font-semibold text-blue-light-700 dark:text-blue-light-400">Bedienungen</span>
                <span className="inline-flex items-center rounded-full bg-blue-light-100 px-2 py-0.5 text-xs font-medium text-blue-light-700 dark:bg-blue-light-900 dark:text-blue-light-400">
                  {serviceOrders.length}
                </span>
              </div>
              <div className="flex-1 overflow-auto p-3">
                {serviceOrders.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-tertiary">Keine offenen Bestellungen</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {serviceOrders.map((orderData) => (
                      <StationOrderCard
                        key={orderData.order.id}
                        order={orderData.order}
                        items={orderData.items}
                        onItemReady={(itemId) => markReady.mutate(itemId)}
                        isMarkingReady={markReady.isPending}
                        isNew={false}
                        variant="service"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Kunden (Counter Pickup) */}
            <div className="flex flex-col overflow-hidden rounded-xl border border-secondary bg-primary">
              <div className="flex items-center gap-2 border-b border-secondary bg-success-50 px-4 py-3 dark:bg-success-950">
                <span className="text-sm font-semibold text-success-700 dark:text-success-400">Kunden</span>
                <span className="inline-flex items-center rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-700 dark:bg-success-900 dark:text-success-400">
                  {pickupOrders.length}
                </span>
              </div>
              <div className="flex-1 overflow-auto p-3">
                {pickupOrders.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-tertiary">Keine offenen Bestellungen</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {pickupOrders.map((orderData) => (
                      <StationOrderCard
                        key={orderData.order.id}
                        order={orderData.order}
                        items={orderData.items}
                        onItemReady={(itemId) => markReady.mutate(itemId)}
                        isMarkingReady={markReady.isPending}
                        isNew={false}
                        variant="pickup"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
