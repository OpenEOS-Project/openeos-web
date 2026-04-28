export type RentalHardwareType = 'printer' | 'display';
export type RentalHardwareStatus = 'available' | 'rented' | 'maintenance' | 'retired';
export type RentalAssignmentStatus = 'pending' | 'confirmed' | 'active' | 'returned' | 'cancelled';

export interface RentalHardware {
  id: string;
  type: RentalHardwareType;
  name: string;
  serialNumber: string;
  model: string | null;
  description: string | null;
  dailyRate: number;
  status: RentalHardwareStatus;
  hardwareConfig: Record<string, unknown>;
  notes: string | null;
  deviceId: string | null;
  device?: { id: string; name: string; status: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface RentalAssignment {
  id: string;
  rentalHardwareId: string;
  organizationId: string;
  eventId: string | null;
  status: RentalAssignmentStatus;
  startDate: string;
  endDate: string;
  dailyRate: number;
  totalDays: number;
  totalAmount: number;
  notes: string | null;
  confirmedAt: string | null;
  pickupAt: string | null;
  returnedAt: string | null;
  rentalHardware?: RentalHardware;
  organization?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateRentalHardwareData {
  type: RentalHardwareType;
  name: string;
  serialNumber: string;
  model?: string;
  description?: string;
  dailyRate: number;
  hardwareConfig?: Record<string, unknown>;
  notes?: string;
  deviceId?: string | null;
}

export interface UpdateRentalHardwareData {
  type?: RentalHardwareType;
  name?: string;
  serialNumber?: string;
  model?: string;
  description?: string;
  dailyRate?: number;
  status?: RentalHardwareStatus;
  hardwareConfig?: Record<string, unknown>;
  notes?: string;
  deviceId?: string | null;
}

export interface CreateRentalAssignmentData {
  rentalHardwareId: string;
  organizationId: string;
  eventId?: string;
  startDate: string;
  endDate: string;
  notes?: string;
}
