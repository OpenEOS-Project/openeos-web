import type { Category } from './category';

export interface ProductOption {
  name: string;
  priceModifier: number;
}

export interface ProductOptionGroup {
  name: string;
  type: 'single' | 'multiple';
  required: boolean;
  options: ProductOption[];
}

export interface ProductOptions {
  groups: ProductOptionGroup[];
}

export interface ProductPrintSettings {
  printerId?: string;
  templateId?: string;
  copies?: number;
  enabled?: boolean;
}

export interface Product {
  id: string;
  eventId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
  isAvailable: boolean;
  trackInventory: boolean;
  stockQuantity: number;
  stockUnit: string;
  options: ProductOptions;
  printSettings: ProductPrintSettings | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  category?: Category;
}

export interface CreateProductData {
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isActive?: boolean;
  isAvailable?: boolean;
  trackInventory?: boolean;
  stockQuantity?: number;
  stockUnit?: string;
  options?: ProductOptions;
  printSettings?: ProductPrintSettings;
  sortOrder?: number;
}

export interface UpdateProductData {
  categoryId?: string;
  name?: string;
  description?: string | null;
  price?: number;
  imageUrl?: string | null;
  isActive?: boolean;
  isAvailable?: boolean;
  trackInventory?: boolean;
  stockQuantity?: number;
  stockUnit?: string;
  options?: ProductOptions;
  printSettings?: ProductPrintSettings | null;
  sortOrder?: number;
}

export interface AdjustStockData {
  quantity: number;
  reason?: string;
}
