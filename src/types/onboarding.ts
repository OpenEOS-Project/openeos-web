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
}
