/**
 * Kassiermodus einer Veranstaltung — dieselbe Regel wie in der API
 * (`common/utils/ordering-mode.ts`): Wirksam ist der Wert der
 * Veranstaltung, sonst der der Organisation (`settings.pos.orderingMode`),
 * sonst `immediate`.
 */
export type OrderingMode = 'immediate' | 'tab';

export const DEFAULT_ORDERING_MODE: OrderingMode = 'immediate';

export function resolveOrderingMode(
  eventSettings?: { orderingMode?: string | null } | null,
  organizationSettings?: { pos?: { orderingMode?: string | null } | null } | null,
): OrderingMode {
  const value = eventSettings?.orderingMode || organizationSettings?.pos?.orderingMode;
  return value === 'tab' ? 'tab' : DEFAULT_ORDERING_MODE;
}
