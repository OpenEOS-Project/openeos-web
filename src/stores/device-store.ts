'use client';

import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient, devicesApi } from '@/lib/api-client';
import type { DeviceInfo, DeviceStatus, DeviceClass } from '@/types/device';

interface DeviceState {
  // Device info
  deviceId: string | null;
  deviceToken: string | null;
  verificationCode: string | null;
  organizationId: string | null;
  organizationName: string | null;
  deviceName: string | null;
  deviceClass: DeviceClass | null;
  status: DeviceStatus | null;

  // Session state (not persisted)
  tableNumber: string | null;

  // UI state
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
}

interface DeviceActions {
  // Registration
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
      verificationCode: null,
      organizationId: null,
      organizationName: null,
      deviceName: null,
      deviceClass: null,
      status: null,
      tableNumber: null,
      isLoading: false,
      isPolling: false,
      error: null,

      // Register device
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
          });

          // If verified, stop polling
          if (data.status === 'verified') {
            get().stopPolling();
          }

          return data.status;
        } catch (error) {
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
        set({
          deviceId: null,
          deviceToken: null,
          verificationCode: null,
          organizationId: null,
          organizationName: null,
          deviceName: null,
          deviceClass: null,
          status: null,
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
