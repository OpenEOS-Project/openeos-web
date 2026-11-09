'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { deviceApi, apiClient } from '@/lib/api-client';
import { autoLockSecondsOf, shouldAutoLock, waiterModeOf } from '@/lib/waiters';
import { useCartStore } from '@/stores/cart-store';
import { useDeviceStore } from '@/stores/device-store';
import { useWaiterSessionStore } from '@/stores/waiter-session-store';
import { ApiException } from '@/types/api';
import type { PosWaiter, WaiterMode, WaiterSessionResponse } from '@/types/waiter';

export type LockReason = 'lock' | 'switch' | 'timeout' | 'logout';

/** Fester Bedienung fehlt (personal): Gerät sperren mit Hinweis. */
export type PersonalState = 'loading' | 'ok' | 'unassigned';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;

/**
 * Bedienungs-Sitzung der Kasse (bedienungen-plan.md §6):
 *
 * - `shared`: PIN-Bildschirm „Wer bedient?“, Token nur im Speicher.
 *   Sperren/Wechseln parkt den ungesendeten Warenkorb je Bedienung.
 *   Automatische Sperre nach `autoLockSeconds` ohne Berührung, nie
 *   während einer laufenden Zahlung (`busy`).
 * - `personal`: feste Bedienung des Geräts, ohne PIN.
 * - `off`: wie bisher, niemand angemeldet.
 */
export function useWaiterSession({ busy }: { busy: boolean }) {
  const settings = useDeviceStore((s) => s.settings);
  const mode: WaiterMode = waiterModeOf(settings);
  const waiter = useWaiterSessionStore((s) => s.waiter);
  const lockReason = useWaiterSessionStore((s) => s.lockReason);
  const [personal, setPersonal] = useState<PersonalState>('loading');
  /** Nach dem Sperren mit vollem Warenkorb: für wen er gemerkt wurde. */
  const [parkedFor, setParkedFor] = useState<string | null>(null);

  // Sitzung abgelaufen (Server 403): sofort sperren, Warenkorb parken.
  const parkCurrent = useCallback((current: PosWaiter | null) => {
    if (!current) return false;
    const cart = useCartStore.getState();
    const table = useDeviceStore.getState().table;
    const hasCart =
      cart.items.length > 0 || Object.keys(cart.parked).length > 0 || cart.appliedVouchers.length > 0;
    if (hasCart || table) {
      useWaiterSessionStore.getState().park(current.id, {
        cart: { items: cart.items, appliedVouchers: cart.appliedVouchers, pfandReturns: cart.pfandReturns },
        parked: cart.parked,
        table,
        savedAt: Date.now(),
      });
    }
    useCartStore.setState({ items: [], appliedVouchers: [], pfandReturns: [], parked: {} });
    useDeviceStore.getState().setTable(null);
    return cart.items.length > 0 || Object.keys(cart.parked).length > 0;
  }, []);

  useEffect(() => {
    apiClient.onWaiterSessionLost(() => {
      const current = useWaiterSessionStore.getState().waiter;
      if (waiterModeOf(useDeviceStore.getState().settings) !== 'shared') return;
      parkCurrent(current);
      useWaiterSessionStore.getState().clear('expired');
    });
    return () => apiClient.onWaiterSessionLost(null);
  }, [parkCurrent]);

  // Modus gewechselt (Verwaltung): Sitzung verwerfen.
  const previousMode = useRef(mode);
  useEffect(() => {
    if (previousMode.current !== mode) {
      previousMode.current = mode;
      useWaiterSessionStore.getState().clear(null);
    }
  }, [mode]);

  // Feste Bedienung: vom Server holen (auch nach Änderungen in der Verwaltung).
  const personalWaiterId = mode === 'personal' ? (settings?.waiterId as string | undefined) : undefined;
  const refreshPersonal = useCallback(async () => {
    try {
      const response = await deviceApi.getWaiterSession();
      const view = response.data;
      if (view?.waiter) {
        useWaiterSessionStore.getState().start(view.waiter, null, null);
        setPersonal('ok');
      } else {
        useWaiterSessionStore.getState().clear(null);
        setPersonal('unassigned');
      }
    } catch {
      setPersonal('unassigned');
    }
  }, []);
  useEffect(() => {
    if (mode !== 'personal') return;
    setPersonal('loading');
    void refreshPersonal();
  }, [mode, personalWaiterId, refreshPersonal]);

  /** Anmelden: Sitzung merken, geparkten Warenkorb dieser Bedienung zurückholen. */
  const signIn = useCallback((session: WaiterSessionResponse) => {
    const store = useWaiterSessionStore.getState();
    store.start(session.waiter, session.token ?? null, session.expiresAt);
    const parking = store.take(session.waiter.id);
    if (parking) {
      useCartStore.setState({
        items: parking.cart.items,
        appliedVouchers: parking.cart.appliedVouchers,
        pfandReturns: parking.cart.pfandReturns,
        parked: parking.parked as ReturnType<typeof useCartStore.getState>['parked'],
      });
      useDeviceStore.getState().setTable(parking.table);
    }
    setParkedFor(null);
  }, []);

  /** Sperren/Wechseln/Abmelden: Sitzung beenden, Warenkorb parken. */
  const lock = useCallback(
    async (reason: LockReason = 'lock') => {
      if (mode !== 'shared') return;
      const current = useWaiterSessionStore.getState().waiter;
      const hadCart = parkCurrent(current);
      setParkedFor(hadCart && current ? (current.shortName ?? current.name) : null);
      // Erst den Server, dann das Token vergessen.
      await deviceApi.endWaiterSession(reason).catch(() => undefined);
      useWaiterSessionStore.getState().clear(reason === 'logout' ? null : reason === 'timeout' ? 'timeout' : 'lock');
    },
    [mode, parkCurrent],
  );

  // Automatische Sperre nach Inaktivität.
  const autoLockSeconds = autoLockSecondsOf(settings);
  const lastActivity = useRef(Date.now());
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    if (mode !== 'shared' || !waiter || !autoLockSeconds) return;
    lastActivity.current = Date.now();
    const touch = () => {
      lastActivity.current = Date.now();
    };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, touch, { passive: true });
    const timer = window.setInterval(() => {
      if (busyRef.current) {
        lastActivity.current = Date.now();
        return;
      }
      if (shouldAutoLock(lastActivity.current, Date.now(), autoLockSeconds, false)) {
        void lock('timeout');
      }
    }, 1000);
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, touch);
      window.clearInterval(timer);
    };
  }, [mode, waiter, autoLockSeconds, lock]);

  /** Echtzeit: Bedienung deaktiviert, neue PIN, Rechte geändert. */
  const onWaiterUpdated = useCallback(
    (data: unknown) => {
      const waiterId = (data as { waiterId?: string } | null)?.waiterId;
      const current = useWaiterSessionStore.getState().waiter;
      if (mode === 'personal') {
        if (waiterId && waiterId === personalWaiterId) void refreshPersonal();
        return;
      }
      if (!current || !waiterId || current.waiterId !== waiterId) return;
      deviceApi
        .getWaiterSession()
        .then((response) => {
          if (response.data?.waiter) {
            useWaiterSessionStore.getState().start(
              response.data.waiter,
              apiClient.getWaiterSessionToken(),
              response.data.expiresAt,
            );
          } else {
            parkCurrent(current);
            useWaiterSessionStore.getState().clear('revoked');
          }
        })
        .catch((error: unknown) => {
          if (error instanceof ApiException && error.status === 403) {
            parkCurrent(current);
            useWaiterSessionStore.getState().clear('revoked');
          }
        });
    },
    [mode, personalWaiterId, refreshPersonal, parkCurrent],
  );

  return {
    mode,
    waiter,
    lockReason,
    personal,
    parkedFor,
    signIn,
    lock,
    onWaiterUpdated,
    /** Nach jedem Kassieren sperren (Theke). */
    lockAfterPayment: mode === 'shared' && settings?.lockAfterPayment === true,
    tiles: mode === 'shared' && settings?.waiterTiles === true,
  };
}
