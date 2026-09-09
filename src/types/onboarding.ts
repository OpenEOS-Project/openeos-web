import type { EventStatus } from './event';

/** Ein Schritt des Quick-Starts. Die Reihenfolge kommt vom Server. */
export type OnboardingStepId = 'event' | 'activate' | 'categories' | 'products' | 'device';

export interface OnboardingStep {
  id: OnboardingStepId;
  done: boolean;
  /** Anzahl der vorhandenen Objekte — steht als Zusatz neben dem Schritt. */
  count: number;
}

export interface OnboardingStatus {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  /** Veranstaltung, auf die sich Kategorien und Produkte beziehen. */
  eventId: string | null;
  /** Ihr Zustand — entscheidet, ob der Schritt den Testmodus anbietet. */
  eventStatus: EventStatus | null;
  /** Obergrenze des Testmodus, auch ohne laufenden Test gesetzt. */
  testOrderLimit: number;
  /** Verbrauchte Bestellungen — nur im Testmodus, sonst null. */
  testOrdersUsed: number | null;
}
