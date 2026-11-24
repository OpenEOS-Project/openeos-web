'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { eventsApi } from '@/lib/api-client';

import { categoryKeys } from './use-categories';
import { invoiceKeys } from './use-invoices';
import { onboardingKeys } from './use-onboarding';
import { productKeys } from './use-products';
import type { CopyCatalogData, CreateEventData, DuplicateEventData, Event, UpdateEventData } from '@/types/event';
import type { OrderInvoiceData } from '@/types/billing';

export const eventKeys = {
  all: ['events'] as const,
  lists: () => [...eventKeys.all, 'list'] as const,
  list: (organizationId: string) => [...eventKeys.lists(), organizationId] as const,
  details: () => [...eventKeys.all, 'detail'] as const,
  detail: (organizationId: string, id: string) => [...eventKeys.details(), organizationId, id] as const,
  active: (organizationId: string) => [...eventKeys.all, 'active', organizationId] as const,
  billing: (organizationId: string, id: string) => [...eventKeys.all, 'billing', organizationId, id] as const,
};

export function useEvents(organizationId: string) {
  return useQuery({
    queryKey: eventKeys.list(organizationId),
    queryFn: async () => {
      const response = await eventsApi.list(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
  });
}

/** Alle Veranstaltungen, auch jenseits der ersten Listenseite (Auswahl der Vorlage). */
export function useAllEvents(organizationId: string) {
  return useQuery({
    queryKey: [...eventKeys.list(organizationId), 'all'] as const,
    queryFn: () => eventsApi.listAll(organizationId),
    enabled: !!organizationId,
  });
}

export function useDuplicateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, id, data }: { organizationId: string; id: string; data: DuplicateEventData }) => {
      const response = await eventsApi.duplicate(organizationId, id, data);
      return response.data;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.list(organizationId) });
    },
  });
}

export function useCopyCatalog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      targetEventId,
      sourceEventId,
      data,
    }: {
      organizationId: string;
      targetEventId: string;
      sourceEventId: string;
      data: CopyCatalogData;
    }) => {
      const response = await eventsApi.copyFrom(organizationId, targetEventId, sourceEventId, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['productionStations'] });
    },
  });
}

export function useActiveEvent(organizationId: string) {
  return useQuery({
    queryKey: eventKeys.active(organizationId),
    queryFn: async () => {
      const response = await eventsApi.active(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
  });
}

export function useEvent(organizationId: string, id: string) {
  return useQuery({
    queryKey: eventKeys.detail(organizationId, id),
    queryFn: async () => {
      const response = await eventsApi.get(organizationId, id);
      return response.data;
    },
    enabled: !!organizationId && !!id,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, data }: { organizationId: string; data: CreateEventData }) => {
      const response = await eventsApi.create(organizationId, data);
      return response.data;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.list(organizationId) });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      id,
      data,
    }: {
      organizationId: string;
      id: string;
      data: UpdateEventData;
    }) => {
      const response = await eventsApi.update(organizationId, id, data);
      return response.data;
    },
    onSuccess: (data, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.list(organizationId) });
      queryClient.setQueryData(eventKeys.detail(organizationId, data.id), data);
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, id }: { organizationId: string; id: string }) => {
      await eventsApi.delete(organizationId, id);
      return { organizationId, id };
    },
    onSuccess: ({ organizationId, id }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.list(organizationId) });
      queryClient.removeQueries({ queryKey: eventKeys.detail(organizationId, id) });
    },
  });
}

export function useActivateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, id }: { organizationId: string; id: string }) => {
      const response = await eventsApi.activate(organizationId, id);
      return response.data;
    },
    onSuccess: (data, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.list(organizationId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.active(organizationId) });
      /* Der Quick-Start haengt am Zustand der Veranstaltung: sowohl der
         Testmodus als auch die Freischaltung erledigen denselben Schritt. */
      queryClient.invalidateQueries({ queryKey: onboardingKeys.status(organizationId) });
      queryClient.setQueryData(eventKeys.detail(organizationId, data.id), data);
    },
  });
}

export function useDeactivateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, id }: { organizationId: string; id: string }) => {
      const response = await eventsApi.deactivate(organizationId, id);
      return response.data;
    },
    onSuccess: (data, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.list(organizationId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.active(organizationId) });
      /* Der Quick-Start haengt am Zustand der Veranstaltung: sowohl der
         Testmodus als auch die Freischaltung erledigen denselben Schritt. */
      queryClient.invalidateQueries({ queryKey: onboardingKeys.status(organizationId) });
      queryClient.setQueryData(eventKeys.detail(organizationId, data.id), data);
    },
  });
}

export function useSetTestMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, id }: { organizationId: string; id: string }) => {
      const response = await eventsApi.setTestMode(organizationId, id);
      return response.data;
    },
    onSuccess: (data, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.list(organizationId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.active(organizationId) });
      /* Der Quick-Start haengt am Zustand der Veranstaltung: sowohl der
         Testmodus als auch die Freischaltung erledigen denselben Schritt. */
      queryClient.invalidateQueries({ queryKey: onboardingKeys.status(organizationId) });
      queryClient.setQueryData(eventKeys.detail(organizationId, data.id), data);
    },
  });
}

/** On-demand lookup of an event's billing status/price — call before deciding whether
 *  activation needs the checkout dialog (billingStatus 'none'/'pending') or can proceed directly. */
export function useEventBillingLookup() {
  return useMutation({
    mutationFn: async ({ organizationId, id }: { organizationId: string; id: string }) => {
      const response = await eventsApi.billing(organizationId, id);
      return response.data;
    },
  });
}

/**
 * Legt die Stripe-Zahlungsseite an. Der Browser verlässt danach die
 * Anwendung — invalidiert wird deshalb erst bei der Rückkehr, über
 * useSyncEventPayment.
 */
export function useCreateEventCheckout() {
  return useMutation({
    mutationFn: async ({ organizationId, id, withTse }: { organizationId: string; id: string; withTse?: boolean }) => {
      const response = await eventsApi.createCheckout(organizationId, id, withTse === undefined ? undefined : { withTse });
      return response.data;
    },
  });
}

/** Gleicht nach der Rückkehr aus dem Checkout den Zahlungsstand ab. */
export function useSyncEventPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, id }: { organizationId: string; id: string }) => {
      const response = await eventsApi.syncPayment(organizationId, id);
      return response.data;
    },
    onSuccess: (_data, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.list(organizationId) });
    },
  });
}

export function useOrderInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      id,
      data,
    }: {
      organizationId: string;
      id: string;
      data: OrderInvoiceData;
    }) => {
      const response = await eventsApi.orderInvoice(organizationId, id, data);
      return response.data;
    },
    onSuccess: (data, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.list(organizationId) });
      queryClient.setQueryData(eventKeys.detail(organizationId, data.id), data);
    },
  });
}

/** Freischaltung, bezahlter Betrag und Stornofrist einer Veranstaltung. */
export function useEventBilling(organizationId: string, id: string | null) {
  return useQuery({
    queryKey: eventKeys.billing(organizationId, id ?? ''),
    queryFn: async () => {
      const response = await eventsApi.billing(organizationId, id as string);
      return response.data;
    },
    enabled: !!organizationId && !!id,
    // Frist und Bestellungen ändern sich unabhängig von dieser Ansicht —
    // vor einer Entscheidung über Geld immer frisch laden.
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * Storniert die Freischaltung. Danach stimmen Liste, aktive Veranstaltung
 * (sie fällt in den Testmodus) und Rechnungen (Stornorechnung) nicht mehr.
 */
export function useCancelEventUnlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, id }: { organizationId: string; id: string }) => {
      const response = await eventsApi.cancelUnlock(organizationId, id);
      return response.data;
    },
    onSuccess: (data, { organizationId, id }) => {
      queryClient.setQueryData(eventKeys.billing(organizationId, id), data.billing);
      queryClient.invalidateQueries({ queryKey: eventKeys.list(organizationId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.active(organizationId) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(organizationId) });
      queryClient.invalidateQueries({ queryKey: onboardingKeys.status(organizationId) });
    },
  });
}
