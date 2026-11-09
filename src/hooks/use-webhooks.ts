'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { webhooksApi } from '@/lib/webhooks';

import type {
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhookDeliveriesQuery,
  WebhookEndpoint,
  WebhookEndpointWithSecret,
} from '@/types/webhook';

export const webhookKeys = {
  all: (organizationId: string | undefined) => ['organizations', organizationId, 'webhooks'] as const,
  info: (organizationId: string | undefined) => ['organizations', organizationId, 'webhooks', 'info'] as const,
  list: (organizationId: string | undefined) => ['organizations', organizationId, 'webhooks', 'list'] as const,
  detail: (organizationId: string | undefined, webhookId: string | undefined) =>
    ['organizations', organizationId, 'webhooks', 'detail', webhookId] as const,
  deliveries: (organizationId: string | undefined, webhookId: string | undefined) =>
    ['organizations', organizationId, 'webhooks', 'deliveries', webhookId] as const,
  deliveryList: (organizationId: string | undefined, webhookId: string | undefined, query: WebhookDeliveriesQuery) =>
    ['organizations', organizationId, 'webhooks', 'deliveries', webhookId, 'list', query] as const,
  delivery: (organizationId: string | undefined, webhookId: string | undefined, deliveryId: string | undefined) =>
    ['organizations', organizationId, 'webhooks', 'deliveries', webhookId, 'detail', deliveryId] as const,
};

/**
 * Server-Stand: eingeschaltet, Höchstzahl, Ereignistypen mit Gruppe und
 * Beschreibung. Ändert sich nur mit einem neuen Release.
 */
export function useWebhookInfo(organizationId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: webhookKeys.info(organizationId),
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID required');
      return (await webhooksApi.info(organizationId)).data;
    },
    enabled: !!organizationId && enabled,
    staleTime: 5 * 60_000,
  });
}

/**
 * Alle Webhooks der Organisation, neueste zuerst. Nur Admins dürfen sie
 * sehen — Mitglieder bekommen 403, deshalb `enabled` nur mit `isAdmin`.
 */
export function useWebhooks(organizationId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: webhookKeys.list(organizationId),
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID required');
      return (await webhooksApi.list(organizationId)).data;
    },
    enabled: !!organizationId && enabled,
    staleTime: 15_000,
  });
}

export function useWebhook(organizationId: string | undefined, webhookId: string | undefined, enabled = true) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: webhookKeys.detail(organizationId, webhookId),
    queryFn: async () => {
      if (!organizationId || !webhookId) throw new Error('Webhook ID required');
      return (await webhooksApi.get(organizationId, webhookId)).data;
    },
    enabled: !!organizationId && !!webhookId && enabled,
    staleTime: 15_000,
    // Aus der Liste vorbelegen, damit die Detailseite sofort steht.
    initialData: () =>
      queryClient
        .getQueryData<WebhookEndpoint[]>(webhookKeys.list(organizationId))
        ?.find((endpoint) => endpoint.id === webhookId),
  });
}

/** Schreibt einen geänderten Endpunkt in Liste und Detail. */
function useStoreEndpoint(organizationId: string) {
  const queryClient = useQueryClient();
  return (endpoint: WebhookEndpoint) => {
    const { secret: _secret, ...plain } = endpoint as WebhookEndpointWithSecret;
    void _secret;
    queryClient.setQueryData<WebhookEndpoint[]>(webhookKeys.list(organizationId), (current) =>
      current?.map((item) => (item.id === plain.id ? plain : item))
    );
    queryClient.setQueryData(webhookKeys.detail(organizationId, plain.id), plain);
    queryClient.invalidateQueries({ queryKey: webhookKeys.list(organizationId) });
  };
}

/** Legt einen Webhook an; die Antwort trägt das Geheimnis genau einmal. */
export function useCreateWebhook(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWebhookInput): Promise<WebhookEndpointWithSecret> =>
      (await webhooksApi.create(organizationId, input)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.list(organizationId) });
    },
  });
}

export function useUpdateWebhook(organizationId: string) {
  const store = useStoreEndpoint(organizationId);
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateWebhookInput }): Promise<WebhookEndpoint> =>
      (await webhooksApi.update(organizationId, id, input)).data,
    onSuccess: store,
  });
}

export function useDeleteWebhook(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await webhooksApi.remove(organizationId, id)).data,
    onSuccess: (_result, id) => {
      queryClient.setQueryData<WebhookEndpoint[]>(webhookKeys.list(organizationId), (current) =>
        current?.filter((endpoint) => endpoint.id !== id)
      );
      queryClient.removeQueries({ queryKey: webhookKeys.detail(organizationId, id) });
      queryClient.removeQueries({ queryKey: webhookKeys.deliveries(organizationId, id) });
      queryClient.invalidateQueries({ queryKey: webhookKeys.list(organizationId) });
    },
  });
}

/** Neues Geheimnis; die Antwort trägt es genau einmal. */
export function useRotateWebhookSecret(organizationId: string) {
  const store = useStoreEndpoint(organizationId);
  return useMutation({
    mutationFn: async (id: string): Promise<WebhookEndpointWithSecret> =>
      (await webhooksApi.rotateSecret(organizationId, id)).data,
    onSuccess: store,
  });
}

/** Schickt ein `ping`; danach steht die Zustellung im Protokoll. */
export function useTestWebhook(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await webhooksApi.test(organizationId, id)).data,
    onSuccess: (_delivery, id) => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.deliveries(organizationId, id) });
      queryClient.invalidateQueries({ queryKey: webhookKeys.list(organizationId) });
    },
  });
}

/**
 * Zustellprotokoll eines Webhooks, seitenweise (limit/offset). Solange noch
 * etwas aussteht oder gerade gesendet wird, fragt die Liste alle 5 s nach.
 */
export function useWebhookDeliveries(
  organizationId: string | undefined,
  webhookId: string | undefined,
  query: WebhookDeliveriesQuery,
  enabled = true
) {
  return useQuery({
    queryKey: webhookKeys.deliveryList(organizationId, webhookId, query),
    queryFn: async () => {
      if (!organizationId || !webhookId) throw new Error('Webhook ID required');
      return webhooksApi.deliveries(organizationId, webhookId, query);
    },
    enabled: !!organizationId && !!webhookId && enabled,
    placeholderData: keepPreviousData,
    staleTime: 5_000,
    refetchInterval: (q) =>
      q.state.data?.data.some((delivery) => delivery.status === 'pending' || delivery.status === 'delivering')
        ? 5_000
        : false,
  });
}

export function useWebhookDelivery(
  organizationId: string | undefined,
  webhookId: string | undefined,
  deliveryId: string | undefined
) {
  return useQuery({
    queryKey: webhookKeys.delivery(organizationId, webhookId, deliveryId),
    queryFn: async () => {
      if (!organizationId || !webhookId || !deliveryId) throw new Error('Delivery ID required');
      return (await webhooksApi.delivery(organizationId, webhookId, deliveryId)).data;
    },
    enabled: !!organizationId && !!webhookId && !!deliveryId,
    staleTime: 5_000,
  });
}

/** Sendet eine Zustellung erneut (neue Zustellung, gleiche Ereignis-Id). */
export function useRedeliverWebhookDelivery(organizationId: string, webhookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deliveryId: string) =>
      (await webhooksApi.redeliver(organizationId, webhookId, deliveryId)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.deliveries(organizationId, webhookId) });
      queryClient.invalidateQueries({ queryKey: webhookKeys.list(organizationId) });
    },
  });
}
