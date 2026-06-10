// Mirrors openeos-api inventory-count entities + DTOs
// (/events/:eventId/inventory/*).

export type InventoryCountStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';

export interface InventoryCountItem {
  id: string;
  inventoryCountId: string;
  productId: string;
  expectedQuantity: number;
  countedQuantity: number | null;
  difference: number | null;
  notes: string | null;
  countedByUserId: string | null;
  countedAt: string | null;
  product?: {
    id: string;
    name: string;
    stockQuantity?: number;
  };
}

export interface InventoryCount {
  id: string;
  eventId: string;
  name: string;
  status: InventoryCountStatus;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdByUserId: string;
  completedByUserId: string | null;
  createdByUser?: { id: string; firstName?: string; lastName?: string };
  completedByUser?: { id: string; firstName?: string; lastName?: string } | null;
  items?: InventoryCountItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryCountData {
  name: string;
  notes?: string;
}

export interface UpdateInventoryCountData {
  name?: string;
  notes?: string;
}

export interface BulkAddInventoryItemsData {
  categoryId?: string;
  productIds?: string[];
}

export interface UpdateInventoryItemData {
  countedQuantity: number;
  notes?: string;
}

export interface QueryInventoryCountsParams {
  status?: InventoryCountStatus;
  page?: number;
  limit?: number;
}
