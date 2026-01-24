// Matches backend EventStatus enum
export type EventStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export interface EventSettings {
  orderNumberPrefix?: string;
  enableOnlineOrdering?: boolean;
  enableTableService?: boolean;
  enableTakeaway?: boolean;
  maxOrdersPerHour?: number;
  [key: string]: unknown;
}

export interface Event {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: EventStatus;
  settings: EventSettings;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventData {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  settings?: Partial<EventSettings>;
}

export interface UpdateEventData {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  settings?: Partial<EventSettings>;
}
