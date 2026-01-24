export type ShiftPlanStatus = 'draft' | 'published' | 'closed';
export type ShiftRegistrationStatus = 'pending_email' | 'pending_approval' | 'confirmed' | 'rejected' | 'cancelled';

export interface ShiftPlanSettings {
  requireApproval: boolean;
  allowMultipleShifts: boolean;
  reminderDaysBefore: number;
  maxShiftsPerPerson?: number;
}

export interface ShiftPlan {
  id: string;
  organizationId: string;
  eventId: string | null;
  name: string;
  description: string | null;
  publicSlug: string;
  status: ShiftPlanStatus;
  settings: ShiftPlanSettings;
  createdAt: string;
  updatedAt: string;
  event?: {
    id: string;
    name: string;
  };
  jobs?: ShiftJob[];
}

export interface ShiftJob {
  id: string;
  shiftPlanId: string;
  name: string;
  description: string | null;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  shifts?: Shift[];
}

export interface Shift {
  id: string;
  shiftJobId: string;
  date: string;
  startTime: string;
  endTime: string;
  requiredWorkers: number;
  notes: string | null;
  createdAt: string;
  registrations?: ShiftRegistration[];
  job?: ShiftJob;
}

export interface ShiftRegistration {
  id: string;
  shiftId: string;
  registrationGroupId: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  status: ShiftRegistrationStatus;
  emailVerifiedAt: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  shift?: Shift;
}

// API DTOs
export interface CreateShiftPlanDto {
  name: string;
  description?: string;
  eventId?: string;
  publicSlug?: string;
  requireApproval?: boolean;
  allowMultipleShifts?: boolean;
  reminderDaysBefore?: number;
  maxShiftsPerPerson?: number;
}

export interface CreateShiftJobDto {
  name: string;
  description?: string;
  color?: string;
  sortOrder?: number;
}

export interface CreateShiftDto {
  date: string;
  startTime: string;
  endTime: string;
  requiredWorkers?: number;
  notes?: string;
}
