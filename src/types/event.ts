// Matches backend EventStatus enum
export type EventStatus = 'active' | 'inactive' | 'test';

export type ShopWeekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface ShopTimeWindow {
  start: string; // 'HH:mm'
  end: string;
}

export type ShopOpeningHours = Partial<Record<ShopWeekday, ShopTimeWindow | null>>;

/** Ein konkretes Zeitfenster mit ISO-Zeitpunkten. Kann über Mitternacht laufen. */
export interface ShopWindow {
  start: string;
  end: string;
}

/**
 * 'event': Öffnungszeiten leiten sich aus dem Veranstaltungszeitraum ab.
 * 'weekly': feste Wochentags-Tabelle (Bestandsshops).
 */
export type ShopHoursMode = 'event' | 'weekly';

export interface EventSettings {
  orderNumberPrefix?: string;
  enableOnlineOrdering?: boolean;
  enableTableService?: boolean;
  enableTakeaway?: boolean;
  maxOrdersPerHour?: number;
  shop?: {
    enabled?: boolean;
    hoursMode?: ShopHoursMode;
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
  /** Pflicht — Preis und Öffnungszeiten hängen daran. */
  startDate: string;
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
