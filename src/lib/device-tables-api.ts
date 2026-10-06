import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type { Order } from '@/types/order';
import type {
  AcknowledgeTableData,
  DeliverOrderItemsResponse,
  DeviceOpenOrdersQuery,
  DevicePosStatusResponse,
  DeviceTableStatus,
  DeviceTablesResponse,
  PaymentsBatchData,
  PaymentsBatchResponse,
} from '@/types/table';

/**
 * Geräte-Endpunkte für Tische, offene Bestellungen, Servieren und
 * Sammelzahlung (Spezifikation §3.4). Alle mit Geräte-Token; ohne
 * `eventId` gilt das aktive bzw. Test-Event.
 */
const device = { useDeviceAuth: true } as const;

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const deviceTablesApi = {
  /** Tischmodus und aktive Tische der freigegebenen Bereiche. */
  getTables: (eventId?: string | null) =>
    apiClient.get<ApiResponse<DeviceTablesResponse>>(
      `/device-api/tables${query({ eventId: eventId ?? undefined })}`,
      device,
    ),

  /** Alle nicht freien Tische (offen / wartet). */
  getStatus: (eventId?: string | null) =>
    apiClient.get<ApiResponse<DeviceTableStatus[]>>(
      `/device-api/tables/status${query({ eventId: eventId ?? undefined })}`,
      device,
    ),

  /** Offene (unbezahlte/teilbezahlte) Bestellungen, optional je Tisch oder Theke. */
  getOpenOrders: (params: DeviceOpenOrdersQuery = {}) =>
    apiClient.get<ApiResponse<Order[]>>(
      `/device-api/orders/open${query({
        eventId: params.eventId,
        tableKey: params.tableKey,
        tableId: params.tableId,
        fulfillmentType: params.fulfillmentType,
      })}`,
      device,
    ),

  /** Gastbestellungen (Shop/QR) eines Tisches quittieren. */
  acknowledge: (data: AcknowledgeTableData) =>
    apiClient.post<ApiResponse<{ acknowledged: number; orderIds: string[] }>>(
      '/device-api/tables/acknowledge',
      data,
      device,
    ),

  /** Fertige Positionen als serviert markieren (`ready → delivered`). */
  deliverItems: (itemIds: string[]) =>
    apiClient.post<ApiResponse<DeliverOrderItemsResponse>>(
      '/device-api/order-items/deliver',
      { itemIds },
      device,
    ),

  /** Mehrere offene Bestellungen in einer Transaktion kassieren. */
  payBatch: (data: PaymentsBatchData) =>
    apiClient.post<ApiResponse<PaymentsBatchResponse>>('/device-api/payments/batch', data, device),

  /** Bondrucker und TSE für die Kopf-Pillen. */
  getDeviceStatus: () => apiClient.get<ApiResponse<DevicePosStatusResponse>>('/device-api/status', device),
};
