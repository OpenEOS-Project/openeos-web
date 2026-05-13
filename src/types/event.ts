// Matches backend EventStatus enum
export type EventStatus = 'active' | 'inactive' | 'test';

export type ShopWeekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface ShopTimeWindow {
  start: string; // 'HH:mm'
  end: string;
}

export type ShopOpeningHours = Partial<Record<ShopWeekday, ShopTimeWindow | null>>;

export interface EventSettings {
  orderNumberPrefix?: string;
  enableOnlineOrdering?: boolean;
  enableTableService?: boolean;
  enableTakeaway?: boolean;
  maxOrdersPerHour?: number;
  shop?: {
    enabled?: boolean;
    openingHours?: ShopOpeningHours;
    serviceFee?: number;
  };
  [key: string]: unknown;
}

export interface Event {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  status: EventStatus;
  settings: EventSettings;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventData {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  settings?: Partial<EventSettings>;
}

export interface UpdateEventData {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  settings?: Partial<EventSettings>;
}
