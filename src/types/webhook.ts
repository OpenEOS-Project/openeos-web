import type { PaginationMeta } from '@/types/api';

/**
 * Ausgehende Webhooks einer Organisation.
 *
 * Die Formen spiegeln den Vertrag der API (`/organizations/:id/webhooks`).
 * Das Geheimnis (`secret`, `whsec_…`) kommt nur in den Antworten auf das
 * Anlegen und das Erneuern — danach steht nur noch `secretHint` da.
 */

export type WebhookEventType =
  | 'order.created'
  | 'order.paid'
  | 'order.completed'
  | 'order.cancelled'
  | 'payment.created'
  | 'refund.created'
  | 'shop.order.created'
  | 'pfand_return.created'
  | 'event.activated'
  | 'event.phase_changed'
  | 'cash_point_closing.created'
  | 'product.updated';

/** `ping` gibt es nur über „Test senden“; abonnieren lässt er sich nicht. */
export type WebhookDeliveryEventType = WebhookEventType | 'ping';

export type WebhookEventGroup = 'orders' | 'payments' | 'shop' | 'pfand' | 'events' | 'fiscal' | 'catalog';

/** Reihenfolge der Gruppen im Dialog. */
export const WEBHOOK_EVENT_GROUPS: readonly WebhookEventGroup[] = [
  'orders',
  'payments',
  'shop',
  'pfand',
  'events',
  'fiscal',
  'catalog',
];

export interface WebhookEventTypeInfo {
  type: WebhookEventType;
  group: WebhookEventGroup;
  /** Deutsche Beschreibung aus der API. */
  description: string;
  /** Enthält Beträge — in der Betriebsart „Nur Bons“ fehlen sie. */
  containsAmounts: boolean;
}

export interface WebhookInfo {
  /** `WEBHOOKS_ENABLED` auf dem Server. */
  enabled: boolean;
  maxEndpoints: number;
  apiVersion: string;
  signatureToleranceSeconds: number;
  maxAttempts: number;
  /** Aufbewahrung des Zustellprotokolls in Tagen. */
  retentionDays: number;
  eventTypes: WebhookEventTypeInfo[];
}

export type WebhookDisabledReason = 'too_many_failures';

export interface WebhookEndpoint {
  id: string;
  organizationId: string;
  url: string;
  description: string | null;
  eventTypes: WebhookEventType[];
  active: boolean;
  /** „Gästedaten mitsenden“ (Name, Telefon, Notizen der Gäste). */
  includeGuestData: boolean;
  /** „Testbestellungen mitsenden“. */
  includeTestOrders: boolean;
  /** Anfang des Geheimnisses, z. B. `whsec_3fA9…`. */
  secretHint: string;
  /** Bis dahin gilt nach dem Erneuern auch das alte Geheimnis. */
  previousSecretExpiresAt: string | null;
  /** Automatisch abgeschaltet → `active=false` und dieser Grund. */
  disabledReason: WebhookDisabledReason | null;
  disabledAt: string | null;
  consecutiveFailures: number;
  failingSince: string | null;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: 'succeeded' | 'failed' | null;
  lastSuccessAt: string | null;
  createdBy: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** Antwort auf Anlegen und Erneuern: der Eintrag plus das Geheimnis, genau einmal. */
export interface WebhookEndpointWithSecret extends WebhookEndpoint {
  secret: string;
}

export interface CreateWebhookInput {
  /** https, höchstens 2048 Zeichen. */
  url: string;
  /** Höchstens 255 Zeichen. */
  description?: string | null;
  /** Mindestens einer, ohne Doppelte. */
  eventTypes: WebhookEventType[];
  active?: boolean;
  includeGuestData?: boolean;
  includeTestOrders?: boolean;
}

export type UpdateWebhookInput = Partial<CreateWebhookInput>;

export type WebhookDeliveryStatus = 'pending' | 'delivering' | 'succeeded' | 'failed';

export const WEBHOOK_DELIVERY_STATUSES: readonly WebhookDeliveryStatus[] = [
  'succeeded',
  'pending',
  'delivering',
  'failed',
];

export type WebhookDeliveryError =
  | 'TIMEOUT'
  | 'CONNECTION_FAILED'
  | 'DNS_FAILED'
  | 'TLS_FAILED'
  | 'BLOCKED_ADDRESS'
  | 'REDIRECT_NOT_FOLLOWED'
  | 'HTTP_ERROR'
  | 'ENDPOINT_INACTIVE'
  | 'ENDPOINT_DELETED'
  | 'INTERNAL';

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  eventType: WebhookDeliveryEventType;
  status: WebhookDeliveryStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  responseStatus: number | null;
  durationMs: number | null;
  error: WebhookDeliveryError | null;
  /** Test oder erneutes Senden. */
  manual: boolean;
  /** Id der ursprünglichen Zustellung beim erneuten Senden. */
  redeliveryOf: string | null;
  createdAt: string;
}

export interface WebhookAttempt {
  at: string;
  responseStatus: number | null;
  durationMs: number | null;
  error: WebhookDeliveryError | null;
}

/** Der Rumpf, den der Empfänger bekommt. */
export interface WebhookPayload {
  id: string;
  type: WebhookDeliveryEventType;
  apiVersion: string;
  createdAt: string;
  organizationId: string;
  data: Record<string, unknown>;
}

export interface WebhookDeliveryDetail extends WebhookDelivery {
  payload: WebhookPayload;
  /** Die ersten 1 KB der Antwort des Empfängers. */
  responseBody: string | null;
  attemptLog: WebhookAttempt[];
}

/** Eine Seite der Zustellliste mit der üblichen `meta` (page/limit). */
export interface WebhookDeliveriesPage {
  data: WebhookDelivery[];
  meta: PaginationMeta;
}

export interface WebhookDeliveriesQuery {
  status?: WebhookDeliveryStatus;
  eventType?: WebhookDeliveryEventType;
  /** Ab 1. */
  page?: number;
  /** Höchstens 100. */
  limit?: number;
}

/** `params.reason` bei `WEBHOOK_URL_INVALID`. */
export type WebhookUrlInvalidReason = 'invalid' | 'not_https' | 'credentials' | 'private_address' | 'unresolvable';

/** Zustand eines Endpunkts in der Liste. */
export type WebhookEndpointStatus = 'active' | 'paused' | 'auto_disabled' | 'failing';
