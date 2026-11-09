import type { EventTablesSettings } from './table';

// Matches backend EventStatus enum
export type EventStatus = 'active' | 'inactive' | 'test';

/**
 * Phase einer Veranstaltung (vom Server abgeleitet, Entscheidung 2026-11-08):
 * - `test`: Testmodus vor dem Kauf,
 * - `planned`: freigeschaltet, vor dem Verkaufsfenster — die Kasse bucht
 *   Testbestellungen, der Shop nur mit Vorverkauf,
 * - `active`: Verkaufsfenster (`realSalesFrom` bis `realSalesUntil`),
 * - `ended`: keine neuen Bestellungen mehr,
 * - `inactive`: ausgeschaltet.
 */
export type EventPhase = 'inactive' | 'test' | 'planned' | 'active' | 'ended';

export interface EventPhaseDetails {
  datePhases: boolean;
  businessDaysFrom: string | null;
  businessDaysUntil: string | null;
  earlyStartHours: number;
  graceHours: number;
  /** Cloud-TSE: der Vorlauf reicht nicht in den Vormonat. */
  earlyStartLimitedByMonth: boolean;
  presaleActive: boolean;
  /** Verkaufsfenster hat begonnen: Beginn fest, Ende nur vorziehen. */
  datesLocked: boolean;
}

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
  /** Tischbetrieb; fehlt → `free` (freie Nummer wie bisher). */
  tables?: EventTablesSettings | null;
  /** Verkaufsfenster: eigener Vorlauf (Stunden) und Vorverkauf im Shop. */
  sales?: {
    earlyStartHours?: number | null;
    presale?: boolean;
  } | null;
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
  /** Abrechnungsstand der Freischaltung (nur im gehosteten Betrieb von Belang). */
  billingStatus?: import('./billing').EventBillingStatus;
  /** Phase (fehlt bei älteren API-Versionen — dann gilt der Status). */
  phase?: EventPhase;
  /** Ab hier echte Verkäufe (ISO); `null` ohne Datumsphasen. */
  realSalesFrom?: string | null;
  /** Ab hier keine neuen Bestellungen (ISO). */
  realSalesUntil?: string | null;
  presaleEnabled?: boolean;
  phaseDetails?: EventPhaseDetails;
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
