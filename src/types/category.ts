export interface CategoryPrintSettings {
  printerId?: string;
  templateId?: string;
  copies?: number;
  enabled?: boolean;
}

export interface Category {
  id: string;
  organizationId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  printSettings: CategoryPrintSettings | null;
  createdAt: string;
  updatedAt: string;
  children?: Category[];
  products?: import('./product').Product[];
}

export interface CreateCategoryData {
  name: string;
  parentId?: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
  printSettings?: CategoryPrintSettings;
}

export interface UpdateCategoryData {
  name?: string;
  parentId?: string | null;
  description?: string;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  printSettings?: CategoryPrintSettings | null;
}
