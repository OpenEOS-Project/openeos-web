import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type {
  BulkCreateDiningTablesData,
  CreateDiningTableData,
  CreateTableAreaData,
  DiningTable,
  TableArea,
  TableDecor,
  TableLayoutItem,
  UpdateDiningTableData,
  UpdateTableAreaData,
} from '@/types/table';

/**
 * Verwaltung der Tische einer Organisation (Spezifikation §3.3):
 * Bereiche mit Karte und Deko, Tische, Serien.
 *
 * Schreiben dürfen Admins und Mitglieder mit Veranstaltungsrecht; jede
 * Änderung sendet `tablesUpdated` an den Organisationsraum.
 */

/**
 * PUT …/layout — nur die geänderten Tische; `decor` nur, wenn sich die
 * Deko geändert hat (fehlt es, bleibt sie auf dem Server unverändert).
 */
export interface TableLayoutPatch {
  tables: TableLayoutItem[];
  decor?: TableDecor[];
}

const base = (organizationId: string) => `/organizations/${organizationId}`;

export const tablesApi = {
  listAreas: (organizationId: string) =>
    apiClient.get<ApiResponse<TableArea[]>>(`${base(organizationId)}/table-areas`),

  createArea: (organizationId: string, data: CreateTableAreaData) =>
    apiClient.post<ApiResponse<TableArea>>(`${base(organizationId)}/table-areas`, data),

  updateArea: (organizationId: string, areaId: string, data: UpdateTableAreaData) =>
    apiClient.patch<ApiResponse<TableArea>>(`${base(organizationId)}/table-areas/${areaId}`, data),

  reorderAreas: (organizationId: string, ids: string[]) =>
    apiClient.patch<ApiResponse<TableArea[]>>(`${base(organizationId)}/table-areas/order`, { ids }),

  deleteArea: (organizationId: string, areaId: string) =>
    apiClient.delete<void>(`${base(organizationId)}/table-areas/${areaId}`),

  saveLayout: (organizationId: string, areaId: string, data: TableLayoutPatch) =>
    apiClient.put<ApiResponse<TableArea>>(`${base(organizationId)}/table-areas/${areaId}/layout`, data),

  createTable: (organizationId: string, data: CreateDiningTableData) =>
    apiClient.post<ApiResponse<DiningTable>>(`${base(organizationId)}/tables`, data),

  bulkCreate: (organizationId: string, data: BulkCreateDiningTablesData) =>
    apiClient.post<ApiResponse<DiningTable[]>>(`${base(organizationId)}/tables/bulk`, data),

  updateTable: (organizationId: string, tableId: string, data: UpdateDiningTableData) =>
    apiClient.patch<ApiResponse<DiningTable>>(`${base(organizationId)}/tables/${tableId}`, data),

  deleteTable: (organizationId: string, tableId: string) =>
    apiClient.delete<void>(`${base(organizationId)}/tables/${tableId}`),
};
