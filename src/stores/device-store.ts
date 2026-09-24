'use client';

import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient, devicesApi } from '@/lib/api-client';
import { ApiException } from '@/types/api';
import { zielRouteFuerGeraet } from '@/lib/device-route';
import type { DeviceInfo, DeviceStatus, DeviceClass } from '@/types/device';

interface DeviceState {
  // Device info
  deviceId: string | null;
  deviceToken: string | null;
  /** Als was dieses Geraet angetreten ist — auch vor der Freigabe bekannt. */
  gewuenschterTyp: DeviceClass | null;
  verificationCode: string | null;
  organizationId: string | null;
  organizationName: string | null;
  deviceName: string | null;
  deviceClass: DeviceClass | null;
  status: DeviceStatus | null;
  settings: Record<string, unknown> | null;

  // Session state (not persisted)
  tableNumber: string | null;

  // UI state
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
}

interface DeviceActions {
  // Initialization (for TV apps - no organization required)
  init: (suggestedName?: string, deviceType?: DeviceClass) => Promise<void>;

  // Legacy Registration (for POS devices - requires organization slug)
  register: (name: string, organizationSlug: string) => Promise<void>;

  // Status polling
  checkStatus: () => Promise<DeviceStatus | null>;
  startPolling: () => void;
  stopPolling: () => void;

  // Auth
  logout: () => Promise<void>;
  clearDevice: () => void;

  // Session
  setTableNumber: (tableNumber: string | null) => void;
  clearSession: () => void;

  // Setters
  setError: (error: string | null) => void;
}

let pollingInterval: NodeJS.Timeout | null = null;

export const useDeviceStore = create<DeviceState & DeviceActions>()(
  persist(
    (set, get) => ({
      // Initial state
      deviceId: null,
      deviceToken: null,
      gewuenschterTyp: null,
      verificationCode: null,
      organizationId: null,
      organizationName: null,
      deviceName: null,
      deviceClass: null,
      status: null,
      settings: null,
      tableNumber: null,
      isLoading: false,
      isPolling: false,
      error: null,

      // Initialize device (for TV apps - no organization required)
      init: async (suggestedName?: string, deviceType?: DeviceClass) => {
        /* Den gewuenschten Typ merken. Die Statusabfrage liefert
           `deviceClass` erst fuer freigegebene Geraete; ohne diesen
           Vermerk faellt ein Bildschirm, dessen Geraet in der Verwaltung
           geloescht wurde, beim Neuanmelden auf "Kasse" zurueck und
           taucht in der Freigabe als solche auf. */
        set({ isLoading: true, error: null, gewuenschterTyp: deviceType ?? null });

        try {
          const response = await devicesApi.init({
            suggestedName,
            deviceType,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          });

          const data = response.data;

          // Store device token in api client
          apiClient.setDeviceToken(data.deviceToken);

          set({
            deviceId: data.deviceId,
            deviceToken: data.deviceToken,
            verificationCode: data.verificationCode,
            deviceName: suggestedName || null,
            deviceClass: deviceType || null,
            status: 'pending',
            isLoading: false,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Initialization failed',
          });
          throw error;
        }
      },

      // Legacy: Register device (for POS devices - requires organization slug)
      register: async (name: string, organizationSlug: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await devicesApi.register({
            name,
            organizationSlug,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          });

          const data = response.data;

          // Store device token in api client
          apiClient.setDeviceToken(data.deviceToken);

          set({
            deviceId: data.deviceId,
            deviceToken: data.deviceToken,
            verificationCode: data.verificationCode,
            organizationName: data.organizationName,
            deviceName: name,
            status: 'pending',
            isLoading: false,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Registration failed',
          });
          throw error;
        }
      },

      // Check device status
      checkStatus: async () => {
        const { deviceToken } = get();
        if (!deviceToken) return null;

        try {
          const response = await devicesApi.getStatus();
          const data = response.data;

          set({
            status: data.status,
            deviceId: data.deviceId,
            organizationId: data.organizationId || null,
            organizationName: data.organizationName || get().organizationName,
            deviceClass: data.deviceClass || null,
            // Nachziehen, wenn das Geraet im Dashboard umbenannt wurde.
            deviceName: data.name || get().deviceName,
            settings: data.settings || get().settings,
          });

          // If verified, stop polling
          if (data.status === 'verified') {
            get().stopPolling();
          }

          /* Wechselt in der Verwaltung der Typ oder der Modus, gehoert das
             Geraet in eine andere Ansicht. Ohne diesen Schritt blieb ein
             Fernseher, den jemand von "Kasse" auf "Kuechenanzeige"
             umstellte, in der Kassenansicht stehen — die Einstellung kam
             an, sichtbar aenderte sich nichts, und vor Ort haelt man das
             fuer einen Fehler. */
          if (data.status === 'verified' && typeof window !== 'undefined') {
            const ziel = zielRouteFuerGeraet(
              data.deviceClass as DeviceClass | null,
              data.settings as { displayMode?: string } | null,
            );
            const jetzt = window.location.pathname;

            /* Nur zwischen den Geraeteansichten umleiten: Auf der
               Kopplungsseite entscheidet die Seite selbst, und anderswo
               hat der Speicher nichts zu suchen. */
            const inGeraeteansicht = /\/device\/(pos|customer|station)$/.test(jetzt);
            if (inGeraeteansicht && !jetzt.endsWith(ziel)) {
              window.location.replace(ziel);
            }
          }

          return data.status;
        } catch (error) {
          /* Kennt der Server den Token nicht mehr, ist dieses Geraet
             entfernt oder neu angelegt worden. Weiterfragen hilft nie:
             Zwei Geraete eines Kunden haben auf diese Weise stundenlang
             mehrfach pro Sekunde angefragt und dabei nur "offline"
             angezeigt, ohne dass jemand erfuhr, warum. */
          if (error instanceof ApiException && error.status === 401) {
            const klasse = get().deviceClass ?? get().gewuenschterTyp;
            get().clearDevice();

            if (typeof window !== 'undefined') {
              const typ = klasse === 'display' ? 'display' : 'pos';
              window.location.href = `/device/pair?type=${typ}&grund=entfernt`;
            }
            return null;
          }

          console.error('Failed to check device status:', error);
          return null;
        }
      },

      // Start polling for verification
      startPolling: () => {
        const { isPolling } = get();
        if (isPolling) return;

        set({ isPolling: true });

        // Poll every 3 seconds
        pollingInterval = setInterval(() => {
          get().checkStatus();
        }, 3000);
      },

      // Stop polling
      stopPolling: () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
        }
        set({ isPolling: false });
      },

      // Logout device
      logout: async () => {
        try {
          await devicesApi.logout();
        } catch {
          // Ignore errors, clear anyway
        }

        apiClient.clearDeviceToken();
        get().clearDevice();
      },

      // Clear device state
      clearDevice: () => {
        get().stopPolling();
        /* Auch die Ablage im API-Client leeren. Der Token lag an zwei
           Stellen, und geleert wurde nur eine — beim naechsten
           Seitenaufbau holte dieser Speicher hier den toten Token
           zurueck, das Geraet fragte erneut, bekam wieder 401 und drehte
           sich im Kreis. */
        apiClient.setDeviceToken(null);
        set({
          deviceId: null,
          deviceToken: null,
          verificationCode: null,
          organizationId: null,
          organizationName: null,
          deviceName: null,
          deviceClass: null,
          status: null,
          settings: null,
          tableNumber: null,
          error: null,
        });
      },

      // Session management
      setTableNumber: (tableNumber) => set({ tableNumber }),
      clearSession: () => set({ tableNumber: null }),

      setError: (error) => set({ error }),
    }),
    {
      name: 'openeos-device',
      partialize: (state) => ({
        deviceId: state.deviceId,
        deviceToken: state.deviceToken,
        verificationCode: state.verificationCode,
        organizationId: state.organizationId,
        organizationName: state.organizationName,
        deviceName: state.deviceName,
        deviceClass: state.deviceClass,
        status: state.status,
        settings: state.settings,
        // Persist session state for device POS
        tableNumber: state.tableNumber,
      }),
      onRehydrateStorage: () => (state) => {
        // Restore device token to API client after rehydration
        if (state?.deviceToken) {
          apiClient.setDeviceToken(state.deviceToken);
        }
      },
    }
  )
);

// Hydration helpers
export const waitForHydration = () => {
  return new Promise<void>((resolve) => {
    if (useDeviceStore.persist.hasHydrated()) {
      resolve();
    } else {
      const unsubscribe = useDeviceStore.persist.onFinishHydration(() => {
        unsubscribe();
        resolve();
      });
    }
  });
};

export const useDeviceHydration = () => {
  const [hasHydrated, setHasHydrated] = useState(useDeviceStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribe = useDeviceStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    // Check again in case it hydrated between render and effect
    if (useDeviceStore.persist.hasHydrated()) {
      setHasHydrated(true);
    }

    return unsubscribe;
  }, []);

  return hasHydrated;
};
