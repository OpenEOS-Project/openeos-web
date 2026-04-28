import type { Printer } from './printer';
import type { Device } from './device';

export interface ProductionStation {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  handoffStationId: string | null;
  handoffStation?: ProductionStation | null;
  printerId: string | null;
  printer?: Printer | null;
  displayDeviceId: string | null;
  displayDevice?: Device | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductionStationData {
  name: string;
  description?: string;
  color?: string;
  sortOrder?: number;
  isActive?: boolean;
  handoffStationId?: string | null;
  printerId?: string | null;
  displayDeviceId?: string | null;
}

export interface UpdateProductionStationData {
  name?: string;
  description?: string;
  color?: string;
  sortOrder?: number;
  isActive?: boolean;
  handoffStationId?: string | null;
  printerId?: string | null;
  displayDeviceId?: string | null;
}
