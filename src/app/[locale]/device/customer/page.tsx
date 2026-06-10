'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, ShoppingBag03, Wifi, WifiOff } from '@untitledui/icons';
import { useDeviceStore, useDeviceHydration } from '@/stores/device-store';
import { useDeviceSocket } from '@/hooks/use-device-socket';
import { deviceApi } from '@/lib/api-client';
import { formatCurrency } from '@/utils/format';
import type { CustomerCartPayload } from '@/hooks/use-customer-display-broadcast';

interface PosCartUpdatedEvent extends CustomerCartPayload {
  posDeviceId: string;
}

const THANK_YOU_DURATION_MS = 6000;

export default function DeviceCustomerDisplayPage() {
  const t = useTranslations('device.customer');
  const router = useRouter();
  const hasHydrated = useDeviceHydration();

  const {
    deviceId,
    deviceToken,
    status,
    settings: deviceSettings,
  } = useDeviceStore();

  const posDeviceId = deviceSettings?.posDeviceId as string | undefined;

  const [cart, setCart] = useState<PosCartUpdatedEvent | null>(null);

  // Redirect unverified devices to the pairing screen
  useEffect(() => {
    if (!hasHydrated) return;
    if (!deviceId || !deviceToken || status !== 'verified') {
      router.replace('/device/register');
    }
  }, [hasHydrated, deviceId, deviceToken, status, router]);

  const { data: orgData } = useQuery({
    queryKey: ['device-organization'],
    queryFn: () => deviceApi.getOrganization(),
    enabled: hasHydrated && status === 'verified',
  });

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

  const handleCartUpdated = useCallback((data: unknown) => {
    const payload = data as PosCartUpdatedEvent;
    if (!payload?.posDeviceId) return;
    setCart((prev) => {
      // Keep the thank-you screen visible until its timer clears it;
      // the POS sends an empty "active" cart right after checkout.
      if (
        prev?.status === 'completed' &&
        payload.status === 'active' &&
        payload.items.length === 0
      ) {
        return prev;
      }
      return payload;
    });
  }, []);

  const socketEvents = useMemo(() => ({
    posCartUpdated: handleCartUpdated,
    deviceSettingsUpdated: refreshDeviceStatus,
    deviceConfigUpdated: refreshDeviceStatus,
    deviceStatusChanged: handleDeviceStatusChanged,
  }), [handleCartUpdated, refreshDeviceStatus, handleDeviceStatusChanged]);

  const { socket, isConnected } = useDeviceSocket({ on: socketEvents });

  // Subscribe to the paired POS device's live cart
  useEffect(() => {
    if (!socket || !isConnected || !posDeviceId) return;
    socket.emit('watchPosCart', { posDeviceId });
    return () => {
      socket.emit('unwatchPosCart', { posDeviceId });
    };
  }, [socket, isConnected, posDeviceId]);

  // Drop stale carts from a previously paired POS device
  useEffect(() => {
    setCart((prev) => (prev && prev.posDeviceId !== posDeviceId ? null : prev));
  }, [posDeviceId]);

  // Thank-you screen auto-dismiss
  useEffect(() => {
    if (cart?.status !== 'completed') return;
    const timer = setTimeout(() => setCart(null), THANK_YOU_DURATION_MS);
    return () => clearTimeout(timer);
  }, [cart?.status, cart?.updatedAt]);

  if (!hasHydrated || !deviceId || status !== 'verified') {
    return (
      <div className="flex h-screen items-center justify-center bg-secondary">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  const organizationName = orgData?.data?.name;
  const hasItems = !!cart && cart.items.length > 0;
  const isCompleted = cart?.status === 'completed';

  return (
    <div className="flex h-screen flex-col bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-secondary bg-primary px-6 py-3">
        <span className="text-lg font-semibold text-primary">
          {organizationName || t('title')}
        </span>
        <span className="flex items-center gap-2 text-sm text-tertiary">
          {isConnected ? (
            <>
              <Wifi className="size-4 text-success-500" />
              {t('connected')}
            </>
          ) : (
            <>
              <WifiOff className="size-4 text-error-500" />
              {t('disconnected')}
            </>
          )}
        </span>
      </div>

      {/* Body */}
      {!posDeviceId ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md text-center">
            <p className="text-xl font-semibold text-primary">{t('noPos')}</p>
            <p className="mt-2 text-sm text-tertiary">{t('noPosHint')}</p>
          </div>
        </div>
      ) : isCompleted ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
          <div className="flex size-28 items-center justify-center rounded-full bg-success-50 ring-8 ring-success-25 dark:bg-success-950 dark:ring-success-900/30">
            <CheckCircle className="size-14 text-success-600 dark:text-success-400" />
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-primary">{t('thankYou')}</p>
            <p className="mt-2 text-xl text-tertiary">
              {cart.kind === 'paid'
                ? t('paidTotal', { total: formatCurrency(cart.totals.payable) })
                : t('orderPlaced')}
            </p>
            {cart.orderNumber && (
              <p className="mt-4 text-lg text-tertiary">
                {t('orderNumber')}: <span className="font-semibold text-primary">{cart.orderNumber}</span>
              </p>
            )}
          </div>
        </div>
      ) : !hasItems ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
          <div className="flex size-24 items-center justify-center rounded-full bg-brand-50 ring-8 ring-brand-25 dark:bg-brand-950 dark:ring-brand-900/30">
            <ShoppingBag03 className="size-12 text-brand-600 dark:text-brand-400" />
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-primary">{t('welcome')}</p>
            <p className="mt-2 text-xl text-tertiary">{t('welcomeSubtitle')}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-secondary px-6 py-4">
            <h1 className="text-2xl font-semibold text-primary">{t('yourOrder')}</h1>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-3">
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-secondary bg-primary px-5 py-4"
                >
                  <div className="flex items-start gap-4">
                    <span className="min-w-10 text-2xl font-bold tabular-nums text-brand-600 dark:text-brand-400">
                      {item.quantity}×
                    </span>
                    <div>
                      <p className="text-2xl font-medium text-primary">{item.name}</p>
                      {item.options.length > 0 && (
                        <p className="mt-1 text-base text-tertiary">{item.options.join(', ')}</p>
                      )}
                      {item.isRefill && (
                        <p className="mt-1 text-base text-tertiary">{t('refill')}</p>
                      )}
                      {item.pfandAmount > 0 && (
                        <p className="mt-1 text-base text-tertiary">
                          + {formatCurrency(item.pfandAmount * item.quantity)} {t('pfand')}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-2xl font-semibold tabular-nums text-primary">
                    {formatCurrency(item.lineTotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t border-secondary bg-primary px-6 py-5">
            <div className="flex flex-col gap-2">
              {(cart.totals.discount > 0 || cart.totals.pfand > 0) && (
                <div className="flex items-center justify-between text-lg text-tertiary">
                  <span>{t('subtotal')}</span>
                  <span className="tabular-nums">{formatCurrency(cart.totals.subtotal)}</span>
                </div>
              )}
              {cart.totals.discount > 0 && (
                <div className="flex items-center justify-between text-lg text-success-600 dark:text-success-400">
                  <span>
                    {t('discount')}
                    {cart.vouchers.length > 0 && ` (${cart.vouchers.map((v) => v.name).join(', ')})`}
                  </span>
                  <span className="tabular-nums">−{formatCurrency(cart.totals.discount)}</span>
                </div>
              )}
              {cart.totals.pfand > 0 && (
                <div className="flex items-center justify-between text-lg text-tertiary">
                  <span>{t('pfand')}</span>
                  <span className="tabular-nums">{formatCurrency(cart.totals.pfand)}</span>
                </div>
              )}
              <div className="mt-1 flex items-center justify-between border-t border-secondary pt-3">
                <span className="text-3xl font-bold text-primary">{t('total')}</span>
                <span className="text-4xl font-bold tabular-nums text-primary">
                  {formatCurrency(cart.totals.payable)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
