import {
  checkWebhookUrl,
  deliveriesSearchParams,
  deliveryStatusTone,
  eventTypeMessageKey,
  eventTypesWithAmounts,
  groupSelectionState,
  groupWebhookEventTypes,
  isSuccessStatusCode,
  prettyJson,
  toggleEventTypes,
  webhookDocsUrl,
  webhookDuration,
  webhookEndpointStatus,
  webhookLimitReached,
  webhookSecretHint,
  webhookStatusTone,
  webhookUrlErrorReason,
  webhookUrlHintKey,
} from '@/lib/webhooks';
import { ApiException } from '@/types/api';
import type { WebhookEventType, WebhookEventTypeInfo } from '@/types/webhook';
import { expect, test } from '@playwright/test';

/*
 * Webhooks: Status und Pillen, Gruppen der Ereignistypen, Auswahl,
 * Prüfung der Adresse, Fehler der API, Query der Zustellliste.
 */

function endpoint(active: boolean, consecutiveFailures = 0, disabledReason: 'too_many_failures' | null = null) {
  return { active, consecutiveFailures, disabledReason };
}

const INFO: WebhookEventTypeInfo[] = [
  { type: 'order.created', group: 'orders', description: 'Bestellung angelegt', containsAmounts: true },
  { type: 'product.updated', group: 'catalog', description: 'Produkt geändert', containsAmounts: true },
  { type: 'order.paid', group: 'orders', description: 'Bestellung bezahlt', containsAmounts: true },
  { type: 'event.activated', group: 'events', description: 'Veranstaltung freigeschaltet', containsAmounts: false },
  { type: 'payment.created', group: 'payments', description: 'Zahlung', containsAmounts: true },
];
const ORDER = INFO.map((info) => info.type);

test.describe('endpoint status', () => {
  test('active without failures', () => {
    expect(webhookEndpointStatus(endpoint(true))).toBe('active');
  });

  test('failing as soon as one delivery failed in a row', () => {
    expect(webhookEndpointStatus(endpoint(true, 1))).toBe('failing');
  });

  test('paused when switched off, failures do not matter', () => {
    expect(webhookEndpointStatus(endpoint(false))).toBe('paused');
    expect(webhookEndpointStatus(endpoint(false, 12))).toBe('paused');
  });

  test('auto-disabled beats paused and failing', () => {
    expect(webhookEndpointStatus(endpoint(false, 30, 'too_many_failures'))).toBe('auto_disabled');
  });

  test('pill tones', () => {
    expect(webhookStatusTone('active')).toBe('success');
    expect(webhookStatusTone('paused')).toBe('neutral');
    expect(webhookStatusTone('failing')).toBe('warning');
    expect(webhookStatusTone('auto_disabled')).toBe('danger');
    expect(deliveryStatusTone('succeeded')).toBe('success');
    expect(deliveryStatusTone('pending')).toBe('neutral');
    expect(deliveryStatusTone('delivering')).toBe('info');
    expect(deliveryStatusTone('failed')).toBe('danger');
  });
});

test.describe('event type groups', () => {
  test('groups in the fixed group order, types in API order', () => {
    const groups = groupWebhookEventTypes(INFO);
    expect(groups.map((g) => g.group)).toEqual(['orders', 'payments', 'events', 'catalog']);
    expect(groups[0].types.map((t) => t.type)).toEqual(['order.created', 'order.paid']);
  });

  test('unknown groups from a newer API come last', () => {
    const groups = groupWebhookEventTypes([
      { type: 'order.created', group: 'orders', description: '', containsAmounts: true },
      { type: 'x.y' as WebhookEventType, group: 'future' as never, description: '', containsAmounts: false },
    ]);
    expect(groups.map((g) => g.group)).toEqual(['orders', 'future']);
  });

  test('empty list gives no groups', () => {
    expect(groupWebhookEventTypes([])).toEqual([]);
  });

  test('selection state of a group', () => {
    const group: WebhookEventType[] = ['order.created', 'order.paid'];
    expect(groupSelectionState([], group)).toBe('none');
    expect(groupSelectionState(['order.paid'], group)).toBe('some');
    expect(groupSelectionState(['order.paid', 'order.created', 'event.activated'], group)).toBe('all');
  });

  test('toggling keeps the API order and drops duplicates', () => {
    let selected: WebhookEventType[] = [];
    selected = toggleEventTypes(selected, ['event.activated'], true, ORDER);
    selected = toggleEventTypes(selected, ['order.paid', 'order.created'], true, ORDER);
    expect(selected).toEqual(['order.created', 'order.paid', 'event.activated']);
    selected = toggleEventTypes(selected, ['order.paid', 'order.paid'], true, ORDER);
    expect(selected).toEqual(['order.created', 'order.paid', 'event.activated']);
    selected = toggleEventTypes(selected, ['order.created', 'order.paid'], false, ORDER);
    expect(selected).toEqual(['event.activated']);
  });

  test('types the API does not list stay selected at the end', () => {
    const selected = toggleEventTypes(['refund.created'], ['order.paid'], true, ORDER);
    expect(selected).toEqual(['order.paid', 'refund.created']);
  });

  test('selected types with amounts', () => {
    expect(eventTypesWithAmounts(['event.activated'], INFO)).toEqual([]);
    expect(eventTypesWithAmounts(['event.activated', 'order.paid', 'product.updated'], INFO)).toEqual([
      'product.updated',
      'order.paid',
    ]);
  });

  test('message keys without dots', () => {
    expect(eventTypeMessageKey('shop.order.created')).toBe('shop_order_created');
    expect(eventTypeMessageKey('ping')).toBe('ping');
  });
});

test.describe('url check', () => {
  test('https address is fine', () => {
    expect(checkWebhookUrl('https://example.org/hook')).toBeNull();
    expect(checkWebhookUrl('  https://hooks.example.org:8443/a?b=c  ')).toBeNull();
  });

  test('required and length', () => {
    expect(checkWebhookUrl('')).toBe('required');
    expect(checkWebhookUrl('   ')).toBe('required');
    expect(checkWebhookUrl(`https://example.org/${'a'.repeat(2048)}`)).toBe('too_long');
  });

  test('http and other schemes', () => {
    expect(checkWebhookUrl('http://example.org/hook')).toBe('not_https');
    expect(checkWebhookUrl('ftp://example.org/hook')).toBe('invalid');
    expect(checkWebhookUrl('example.org/hook')).toBe('invalid');
    expect(checkWebhookUrl('https://')).toBe('invalid');
  });

  test('http only when the server allows it', () => {
    expect(checkWebhookUrl('http://192.168.1.20:8080/hook', { allowHttp: true })).toBeNull();
    expect(checkWebhookUrl('http://192.168.1.20:8080/hook', { allowHttp: false })).toBe('not_https');
    expect(checkWebhookUrl('ftp://example.org/hook', { allowHttp: true })).toBe('invalid');
    expect(checkWebhookUrl('http://user:pw@example.org/hook', { allowHttp: true })).toBe('credentials');
  });

  test('hint follows what the server allows', () => {
    expect(webhookUrlHintKey(undefined)).toBe('urlHint');
    expect(webhookUrlHintKey({ allowHttp: false, allowPrivateNetworks: false })).toBe('urlHint');
    expect(webhookUrlHintKey({ allowHttp: true, allowPrivateNetworks: false })).toBe('urlHintHttp');
    expect(webhookUrlHintKey({ allowHttp: false, allowPrivateNetworks: true })).toBe('urlHintPrivate');
    expect(webhookUrlHintKey({ allowHttp: true, allowPrivateNetworks: true })).toBe('urlHintHttpPrivate');
  });

  test('credentials in the address', () => {
    expect(checkWebhookUrl('https://user:secret@example.org/hook')).toBe('credentials');
    expect(checkWebhookUrl('https://user@example.org/hook')).toBe('credentials');
  });

  test('reason of a rejected address from the API', () => {
    const err = (reason?: string) =>
      new ApiException('VALIDATION_ERROR', 'x', 400, undefined, 'WEBHOOK_URL_INVALID', reason ? { reason } : undefined);
    expect(webhookUrlErrorReason(err('private_address'))).toBe('private_address');
    expect(webhookUrlErrorReason(err('unresolvable'))).toBe('unresolvable');
    expect(webhookUrlErrorReason(err('something_new'))).toBe('invalid');
    expect(webhookUrlErrorReason(err())).toBe('invalid');
    expect(
      webhookUrlErrorReason(new ApiException('CONFLICT', 'x', 409, undefined, 'WEBHOOK_LIMIT_REACHED', { limit: 10 }))
    ).toBeNull();
    expect(webhookUrlErrorReason(new Error('x'))).toBeNull();
  });
});

test.describe('helpers', () => {
  test('secret hint like the API', () => {
    expect(webhookSecretHint('whsec_3fA9b8c7d6e5')).toBe('whsec_3fA9…');
    expect(webhookSecretHint('short')).toBe('short');
  });

  test('limit', () => {
    expect(webhookLimitReached(9, 10)).toBe(false);
    expect(webhookLimitReached(10, 10)).toBe(true);
  });

  test('deliveries query: empty filters and page 1 drop out, limit is clamped', () => {
    expect(deliveriesSearchParams({}).toString()).toBe('');
    expect(deliveriesSearchParams({ page: 1, limit: 20 }).toString()).toBe('limit=20');
    expect(deliveriesSearchParams({ status: 'failed', eventType: 'order.paid', page: 3, limit: 500 }).toString()).toBe(
      'status=failed&eventType=order.paid&limit=100&page=3'
    );
    expect(deliveriesSearchParams({ limit: 0 }).toString()).toBe('limit=1');
  });

  test('duration', () => {
    expect(webhookDuration(null)).toBeNull();
    expect(webhookDuration(-1)).toBeNull();
    expect(webhookDuration(87.4)).toEqual({ unit: 'ms', value: 87 });
    expect(webhookDuration(999)).toEqual({ unit: 'ms', value: 999 });
    expect(webhookDuration(1234)).toEqual({ unit: 's', value: 1.2 });
    expect(webhookDuration(10000)).toEqual({ unit: 's', value: 10 });
  });

  test('pretty JSON for objects and JSON text, other text unchanged', () => {
    expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(prettyJson('{"ok":true}')).toBe('{\n  "ok": true\n}');
    expect(prettyJson('OK')).toBe('OK');
  });

  test('2xx counts as delivered', () => {
    expect(isSuccessStatusCode(200)).toBe(true);
    expect(isSuccessStatusCode(204)).toBe(true);
    expect(isSuccessStatusCode(301)).toBe(false);
    expect(isSuccessStatusCode(null)).toBe(false);
  });

  test('docs link per language', () => {
    expect(webhookDocsUrl('de')).toBe('https://docs.openeos.de/integrationen/webhooks');
    expect(webhookDocsUrl('en')).toBe('https://docs.openeos.de/en/integrationen/webhooks');
  });
});
