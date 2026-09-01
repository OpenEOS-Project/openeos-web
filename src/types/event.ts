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
 * 'event': Öffnungszeiten je Veranstaltungstag (`days`).
 * 'weekly': feste Wochentags-Tabelle (Bestandsshops).
 */
export type ShopHoursMode = 'event' | 'weekly';

/**
 * Ein Öffnungstag des Shops. Nur geöffnete Tage stehen in der Liste —
 * ein geschlossener Tag fehlt einfach.
 */
export interface ShopDaySetting {
  /** Veranstaltungstag als 'YYYY-MM-DD'. */
  date: string;
  /** 'HH:mm' */
  start: string;
  /** 'HH:mm'. Nicht später als `start` heißt: Ende am Folgetag. */
  end: string;
}

export interface EventSettings {
  orderNumberPrefix?: string;
  /** Sofort kassieren oder auf Deckel buchen — je Veranstaltung. */
  orderingMode?: 'immediate' | 'tab';
  enableOnlineOrdering?: boolean;
  enableTableService?: boolean;
  enableTakeaway?: boolean;
  maxOrdersPerHour?: number;
  shop?: {
    enabled?: boolean;
    hoursMode?: ShopHoursMode;
    days?: ShopDaySetting[];
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
