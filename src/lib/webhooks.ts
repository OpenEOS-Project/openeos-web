import { apiClient } from '@/lib/api-client';

import { ApiException, type ApiResponse } from '@/types/api';
import {
  WEBHOOK_EVENT_GROUPS,
  type CreateWebhookInput,
  type UpdateWebhookInput,
  type WebhookDeliveriesPage,
  type WebhookDeliveriesQuery,
  type WebhookDelivery,
  type WebhookDeliveryDetail,
  type WebhookDeliveryStatus,
  type WebhookEndpoint,
  type WebhookEndpointStatus,
  type WebhookEndpointWithSecret,
  type WebhookEventGroup,
  type WebhookEventType,
  type WebhookEventTypeInfo,
  type WebhookInfo,
  type WebhookUrlInvalidReason,
} from '@/types/webhook';

/**
 * Ausgehende Webhooks: Abrufe gegen die API und reine Hilfen für Liste,
 * Dialoge und Zustellprotokoll (settings/components/webhooks-*.tsx,
 * settings/webhooks/[webhookId]).
 */

const base = (organizationId: string) => `/organizations/${organizationId}/webhooks`;

export const webhooksApi = {
  info: (organizationId: string) => apiClient.get<ApiResponse<WebhookInfo>>(`${base(organizationId)}/info`),

  list: (organizationId: string) => apiClient.get<ApiResponse<WebhookEndpoint[]>>(base(organizationId)),

  get: (organizationId: string, webhookId: string) =>
    apiClient.get<ApiResponse<WebhookEndpoint>>(`${base(organizationId)}/${webhookId}`),

  /** `data.secret` (whsec_…) kommt genau einmal, hier. */
  create: (organizationId: string, input: CreateWebhookInput) =>
    apiClient.post<ApiResponse<WebhookEndpointWithSecret>>(base(organizationId), input),

  update: (organizationId: string, webhookId: string, input: UpdateWebhookInput) =>
    apiClient.patch<ApiResponse<WebhookEndpoint>>(`${base(organizationId)}/${webhookId}`, input),

  remove: (organizationId: string, webhookId: string) =>
    apiClient.delete<ApiResponse<{ id: string; deleted: true }>>(`${base(organizationId)}/${webhookId}`),

  /** Neues Geheimnis, einmal im Klartext; das alte gilt noch 24 h. */
  rotateSecret: (organizationId: string, webhookId: string) =>
    apiClient.post<ApiResponse<WebhookEndpointWithSecret>>(`${base(organizationId)}/${webhookId}/rotate-secret`),

  /** Stellt ein `ping`-Ereignis in die Warteschlange — auch bei pausiertem Endpunkt. */
  test: (organizationId: string, webhookId: string) =>
    apiClient.post<ApiResponse<WebhookDelivery>>(`${base(organizationId)}/${webhookId}/test`),

  deliveries: (organizationId: string, webhookId: string, query: WebhookDeliveriesQuery = {}) => {
    const search = deliveriesSearchParams(query).toString();
    return apiClient.get<WebhookDeliveriesPage>(
      `${base(organizationId)}/${webhookId}/deliveries${search ? `?${search}` : ''}`
    );
  },

  delivery: (organizationId: string, webhookId: string, deliveryId: string) =>
    apiClient.get<ApiResponse<WebhookDeliveryDetail>>(
      `${base(organizationId)}/${webhookId}/deliveries/${deliveryId}`
    ),

  /** Neue Zustellung mit derselben Ereignis-Id und demselben Inhalt. */
  redeliver: (organizationId: string, webhookId: string, deliveryId: string) =>
    apiClient.post<ApiResponse<WebhookDelivery>>(
      `${base(organizationId)}/${webhookId}/deliveries/${deliveryId}/redeliver`
    ),
};

/** Seitengröße des Zustellprotokolls; die API erlaubt höchstens 100. */
export const WEBHOOK_DELIVERIES_PAGE_SIZE = 20;
export const WEBHOOK_DELIVERIES_MAX_LIMIT = 100;

/** Standard-Höchstzahl je Organisation, falls `info` noch lädt. */
export const DEFAULT_MAX_WEBHOOK_ENDPOINTS = 10;

/** Längen wie in der API. */
export const WEBHOOK_URL_MAX_LENGTH = 2048;
export const WEBHOOK_DESCRIPTION_MAX_LENGTH = 255;

/** Query-String der Zustellliste; leere Filter und Seite 1 fallen weg, `limit` wird auf 1–100 begrenzt. */
export function deliveriesSearchParams(query: WebhookDeliveriesQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.eventType) params.set('eventType', query.eventType);
  if (query.limit !== undefined) {
    const limit = Math.min(WEBHOOK_DELIVERIES_MAX_LIMIT, Math.max(1, Math.floor(query.limit)));
    params.set('limit', String(limit));
  }
  if (query.page !== undefined && query.page > 1) params.set('page', String(Math.floor(query.page)));
  return params;
}

/**
 * Zustand für die Liste. Automatisch abgeschaltet schlägt pausiert (beides
 * hat `active=false`), Fehler zählen nur bei aktiven Endpunkten.
 */
export function webhookEndpointStatus(
  endpoint: Pick<WebhookEndpoint, 'active' | 'disabledReason' | 'consecutiveFailures'>
): WebhookEndpointStatus {
  if (endpoint.disabledReason) return 'auto_disabled';
  if (!endpoint.active) return 'paused';
  if (endpoint.consecutiveFailures > 0) return 'failing';
  return 'active';
}

export type PillTone = 'success' | 'neutral' | 'warning' | 'danger' | 'info';

/** Farbe der Statuspille eines Endpunkts (`badge--<tone>`). */
export function webhookStatusTone(status: WebhookEndpointStatus): PillTone {
  switch (status) {
    case 'active':
      return 'success';
    case 'paused':
      return 'neutral';
    case 'failing':
      return 'warning';
    case 'auto_disabled':
      return 'danger';
  }
}

/** Farbe der Statuspille einer Zustellung. */
export function deliveryStatusTone(status: WebhookDeliveryStatus): PillTone {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'pending':
      return 'neutral';
    case 'delivering':
      return 'info';
    case 'failed':
      return 'danger';
  }
}

export interface WebhookEventTypeGroup {
  group: WebhookEventGroup;
  types: WebhookEventTypeInfo[];
}

/**
 * Ereignistypen nach Gruppe, in der festen Reihenfolge der Gruppen; innerhalb
 * einer Gruppe wie von der API geliefert. Unbekannte Gruppen (neuere API)
 * hängen hinten an, leere fallen weg.
 */
export function groupWebhookEventTypes(eventTypes: readonly WebhookEventTypeInfo[]): WebhookEventTypeGroup[] {
  const byGroup = new Map<WebhookEventGroup, WebhookEventTypeInfo[]>();
  for (const info of eventTypes) {
    const list = byGroup.get(info.group) ?? [];
    list.push(info);
    byGroup.set(info.group, list);
  }
  const known = WEBHOOK_EVENT_GROUPS.filter((group) => byGroup.has(group));
  const unknown = [...byGroup.keys()].filter((group) => !WEBHOOK_EVENT_GROUPS.includes(group));
  return [...known, ...unknown].map((group) => ({ group, types: byGroup.get(group) ?? [] }));
}

/** Wie viele Typen einer Gruppe gewählt sind: alle, einige oder keiner. */
export function groupSelectionState(
  selected: readonly WebhookEventType[],
  groupTypes: readonly WebhookEventType[]
): 'all' | 'some' | 'none' {
  const count = groupTypes.filter((type) => selected.includes(type)).length;
  if (count === 0) return 'none';
  return count === groupTypes.length ? 'all' : 'some';
}

/**
 * Setzt oder entfernt Typen und hält dabei die Reihenfolge von `order`
 * (Reihenfolge der API), damit die Auswahl stabil und ohne Doppelte bleibt.
 */
export function toggleEventTypes(
  selected: readonly WebhookEventType[],
  types: readonly WebhookEventType[],
  checked: boolean,
  order: readonly WebhookEventType[]
): WebhookEventType[] {
  const next = new Set(selected);
  for (const type of types) {
    if (checked) next.add(type);
    else next.delete(type);
  }
  const ordered = order.filter((type) => next.has(type));
  // Typen, die die API (noch) nicht kennt, bleiben hinten erhalten.
  const rest = [...next].filter((type) => !order.includes(type));
  return [...ordered, ...rest];
}

/** Gewählte Typen, deren Inhalt Beträge trägt („Nur Bons“ lässt sie weg). */
export function eventTypesWithAmounts(
  selected: readonly WebhookEventType[],
  eventTypes: readonly WebhookEventTypeInfo[]
): WebhookEventType[] {
  return eventTypes.filter((info) => info.containsAmounts && selected.includes(info.type)).map((info) => info.type);
}

/** Vorschau eines Geheimnisses wie `secretHint` der API: die ersten 10 Zeichen plus Auslassung. */
export function webhookSecretHint(secret: string): string {
  return secret.length <= 10 ? secret : `${secret.slice(0, 10)}…`;
}

export type WebhookUrlCheck = 'required' | 'too_long' | WebhookUrlInvalidReason;

/**
 * Prüft die Adresse, bevor sie zur API geht: Pflicht, Länge, lesbar, nur
 * https und ohne Zugangsdaten in der Adresse. Private Netze und
 * Erreichbarkeit prüft erst die API (`private_address`, `unresolvable`).
 * `null` heißt: sieht gut aus.
 */
export function checkWebhookUrl(value: string): WebhookUrlCheck | null {
  const trimmed = value.trim();
  if (!trimmed) return 'required';
  if (trimmed.length > WEBHOOK_URL_MAX_LENGTH) return 'too_long';
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return 'invalid';
  }
  if (url.protocol !== 'https:') {
    return url.protocol === 'http:' ? 'not_https' : 'invalid';
  }
  if (!url.hostname) return 'invalid';
  if (url.username || url.password) return 'credentials';
  return null;
}

/** `params.reason` einer abgelehnten Adresse — sonst `null`. */
export function webhookUrlErrorReason(error: unknown): WebhookUrlInvalidReason | null {
  if (!(error instanceof ApiException) || error.reason !== 'WEBHOOK_URL_INVALID') return null;
  const reason = error.params?.reason;
  const known: WebhookUrlInvalidReason[] = ['invalid', 'not_https', 'credentials', 'private_address', 'unresolvable'];
  return typeof reason === 'string' && (known as string[]).includes(reason)
    ? (reason as WebhookUrlInvalidReason)
    : 'invalid';
}

/** `true`, sobald kein weiterer Webhook mehr angelegt werden kann. */
export function webhookLimitReached(count: number, maxEndpoints: number): boolean {
  return count >= maxEndpoints;
}

/** Inhalt hübsch eingerückt; Text, der kein JSON ist, bleibt wie er ist. */
export function prettyJson(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2) ?? '';
}

/** Anleitung „Webhooks“ in openeos-docs, je Sprache. */
export function webhookDocsUrl(locale: string): string {
  return locale === 'en'
    ? 'https://docs.openeos.de/en/integrationen/webhooks'
    : 'https://docs.openeos.de/integrationen/webhooks';
}

/** Ein 2xx-Code gilt als zugestellt. */
export function isSuccessStatusCode(code: number | null | undefined): boolean {
  return typeof code === 'number' && code >= 200 && code < 300;
}

/**
 * Schlüssel eines Ereignistyps in den Übersetzungen: next-intl liest Punkte
 * als Verschachtelung, deshalb `order.paid` → `order_paid`.
 */
export function eventTypeMessageKey(type: string): string {
  return type.replace(/\./g, '_');
}

/** Dauer für die Anzeige: unter einer Sekunde in ms, darüber in s mit einer Nachkommastelle. */
export function webhookDuration(ms: number | null | undefined): { unit: 'ms' | 's'; value: number } | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return { unit: 'ms', value: Math.round(ms) };
  return { unit: 's', value: Math.round(ms / 100) / 10 };
}
