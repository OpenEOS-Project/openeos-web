import type { Page, Route } from '@playwright/test';

/**
 * Nachbildung der Webhook-Endpunkte der API im Browser (page.route): hält
 * Webhooks und Zustellungen im Speicher und protokolliert die Anfragen.
 * Die echte Zustellung, Signatur und Prüfung der Adressen testet die API.
 */

const WEBHOOKS = /\/api\/organizations\/[0-9a-f-]{36}\/webhooks(?:\/[^?]*)?(?:\?.*)?$/;

export const EVENT_TYPES = [
  { type: 'order.created', group: 'orders', description: 'Bestellung angelegt', containsAmounts: true },
  { type: 'order.paid', group: 'orders', description: 'Bestellung vollständig bezahlt', containsAmounts: true },
  { type: 'order.completed', group: 'orders', description: 'Bestellung abgeschlossen', containsAmounts: true },
  { type: 'order.cancelled', group: 'orders', description: 'Bestellung storniert', containsAmounts: true },
  { type: 'payment.created', group: 'payments', description: 'Zahlung eingegangen', containsAmounts: true },
  { type: 'refund.created', group: 'payments', description: 'Storno oder Erstattung gebucht', containsAmounts: true },
  { type: 'shop.order.created', group: 'shop', description: 'Neue Bestellung im Online-Shop', containsAmounts: true },
  { type: 'pfand_return.created', group: 'pfand', description: 'Pfand zurückgegeben', containsAmounts: true },
  { type: 'event.activated', group: 'events', description: 'Veranstaltung freigeschaltet', containsAmounts: false },
  { type: 'event.phase_changed', group: 'events', description: 'Phase der Veranstaltung gewechselt', containsAmounts: false },
  { type: 'cash_point_closing.created', group: 'fiscal', description: 'Kassenabschluss erstellt (Cloud-TSE)', containsAmounts: false },
  { type: 'product.updated', group: 'catalog', description: 'Produkt geändert', containsAmounts: true },
];

export type Json = Record<string, unknown>;

interface Delivery extends Json {
  id: string;
  webhookId: string;
  eventId: string;
  eventType: string;
  status: string;
  attempts: number;
  createdAt: string;
}

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

function endpointFrom(input: Json, organizationId: string): Json {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    organizationId,
    url: input.url,
    description: input.description ?? null,
    eventTypes: input.eventTypes,
    active: input.active ?? true,
    includeGuestData: input.includeGuestData ?? false,
    includeTestOrders: input.includeTestOrders ?? false,
    secretHint: 'whsec_e2eA…',
    previousSecretExpiresAt: null,
    disabledReason: null,
    disabledAt: null,
    consecutiveFailures: 0,
    failingSince: null,
    lastDeliveryAt: null,
    lastDeliveryStatus: null,
    lastSuccessAt: null,
    createdBy: { id: uuid(), firstName: 'Erika', lastName: 'Admin' },
    createdAt: now,
    updatedAt: now,
  };
}

export function delivery(webhookId: string, eventType: string, patch: Partial<Delivery> = {}): Delivery {
  return {
    id: uuid(),
    webhookId,
    eventId: uuid(),
    eventType,
    status: 'succeeded',
    attempts: 1,
    maxAttempts: 8,
    nextAttemptAt: null,
    lastAttemptAt: new Date().toISOString(),
    responseStatus: 200,
    durationMs: 87,
    error: null,
    manual: false,
    redeliveryOf: null,
    createdAt: new Date().toISOString(),
    ...patch,
  };
}

/** Nachbildung der Webhook-Endpunkte der API, mit Protokoll der Anfragen. */
export class WebhookApiMock {
  info = {
    enabled: true,
    maxEndpoints: 10,
    apiVersion: '2026-11-10',
    signatureToleranceSeconds: 300,
    allowHttp: false,
    allowPrivateNetworks: false,
    maxAttempts: 8,
    retentionDays: 30,
    eventTypes: EVENT_TYPES,
  };
  endpoints: Json[] = [];
  deliveries: Delivery[] = [];
  requests: { method: string; path: string; body: Json | null }[] = [];
  /** Einmalige Ablehnung der nächsten Anlage (Fehlerpfad). */
  rejectNextCreate: Json | null = null;
  secretCount = 0;

  async install(page: Page) {
    await page.route(WEBHOOKS, (route) => this.handle(route));
  }

  seedEndpoint(input: Json, organizationId = '00000000-0000-4000-8000-000000000000'): Json {
    const endpoint = endpointFrom(input, organizationId);
    this.endpoints.unshift(endpoint);
    return endpoint;
  }

  private nextSecret() {
    this.secretCount += 1;
    return `whsec_e2eSecret${this.secretCount}_8f3b2c1d0e9a7b6c5d4e3f2a1b0c9d8e`;
  }

  private payload(d: Delivery, organizationId: string) {
    return {
      id: d.eventId,
      type: d.eventType,
      apiVersion: '2026-11-10',
      createdAt: d.createdAt,
      organizationId,
      data:
        d.eventType === 'ping'
          ? { webhookId: d.webhookId, message: 'Test von OpenEOS' }
          : { order: { id: uuid(), orderNumber: 'B-0042', status: 'open', paymentStatus: 'paid', currency: 'EUR' } },
    };
  }

  private async handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const [, organizationId, rest] = /\/organizations\/([^/]+)\/webhooks(.*)$/.exec(url.pathname) ?? [];
    const parts = (rest ?? '').split('/').filter(Boolean);
    const body = request.postData() ? (JSON.parse(request.postData() as string) as Json) : null;
    this.requests.push({ method, path: `${url.pathname}${url.search}`, body });

    const ok = (data: unknown, status = 200) => route.fulfill({ status, json: { data } });
    const fail = (status: number, code: string, reason: string, params?: Json) =>
      route.fulfill({ status, json: { error: { code, reason, message: reason, params } } });
    const find = (id: string) => this.endpoints.find((e) => e.id === id);

    if (parts.length === 0 && method === 'GET') return ok(this.endpoints);
    if (parts.length === 0 && method === 'POST') {
      if (this.rejectNextCreate) {
        const reject = this.rejectNextCreate;
        this.rejectNextCreate = null;
        return fail(400, 'VALIDATION_ERROR', 'WEBHOOK_URL_INVALID', reject);
      }
      const endpoint = endpointFrom(body ?? {}, organizationId);
      this.endpoints.unshift(endpoint);
      return ok({ ...endpoint, secret: this.nextSecret() }, 201);
    }
    if (parts[0] === 'info') return ok(this.info);

    const endpoint = find(parts[0]);
    if (!endpoint) return fail(404, 'NOT_FOUND', 'WEBHOOK_NOT_FOUND');

    if (parts.length === 1 && method === 'GET') return ok(endpoint);
    if (parts.length === 1 && method === 'PATCH') {
      Object.assign(endpoint, body, { updatedAt: new Date().toISOString() });
      if (body?.active === true) Object.assign(endpoint, { disabledReason: null, disabledAt: null, consecutiveFailures: 0, failingSince: null });
      return ok(endpoint);
    }
    if (parts.length === 1 && method === 'DELETE') {
      this.endpoints = this.endpoints.filter((e) => e !== endpoint);
      return ok({ id: endpoint.id, deleted: true });
    }
    if (parts[1] === 'rotate-secret') {
      const secret = this.nextSecret();
      Object.assign(endpoint, {
        secretHint: `${secret.slice(0, 10)}…`,
        previousSecretExpiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
      });
      return ok({ ...endpoint, secret });
    }
    if (parts[1] === 'test') {
      const d = delivery(endpoint.id as string, 'ping', { manual: true });
      this.deliveries.unshift(d);
      Object.assign(endpoint, { lastDeliveryAt: d.createdAt, lastDeliveryStatus: 'succeeded', lastSuccessAt: d.createdAt });
      return ok(d, 202);
    }
    if (parts[1] === 'deliveries' && parts.length === 2) {
      const status = url.searchParams.get('status');
      const eventType = url.searchParams.get('eventType');
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const pageNo = Number(url.searchParams.get('page') ?? 1);
      const all = this.deliveries.filter(
        (d) => d.webhookId === endpoint.id && (!status || d.status === status) && (!eventType || d.eventType === eventType),
      );
      const totalPages = Math.max(1, Math.ceil(all.length / limit));
      return route.fulfill({
        json: {
          data: all.slice((pageNo - 1) * limit, pageNo * limit),
          meta: { page: pageNo, limit, total: all.length, totalPages, hasNext: pageNo < totalPages, hasPrev: pageNo > 1 },
        },
      });
    }
    if (parts[1] === 'deliveries' && parts.length === 3 && method === 'GET') {
      const d = this.deliveries.find((x) => x.id === parts[2]);
      if (!d) return fail(404, 'NOT_FOUND', 'WEBHOOK_DELIVERY_NOT_FOUND');
      return ok({
        ...d,
        payload: this.payload(d, organizationId),
        responseBody: d.status === 'succeeded' ? '{"received":true}' : null,
        attemptLog: Array.from({ length: d.attempts }, () => ({
          at: d.createdAt,
          responseStatus: d.responseStatus,
          durationMs: d.durationMs,
          error: d.error ?? null,
        })),
      });
    }
    if (parts[1] === 'deliveries' && parts[3] === 'redeliver') {
      const original = this.deliveries.find((x) => x.id === parts[2]);
      if (!original) return fail(404, 'NOT_FOUND', 'WEBHOOK_DELIVERY_NOT_FOUND');
      const d = delivery(endpoint.id as string, original.eventType, {
        eventId: original.eventId,
        status: 'pending',
        attempts: 0,
        responseStatus: null,
        durationMs: null,
        lastAttemptAt: null,
        manual: true,
        redeliveryOf: original.id,
      });
      this.deliveries.unshift(d);
      return ok(d, 202);
    }
    return route.fallback();
  }
}
