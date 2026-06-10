import type { ServiceMode } from '@/types/device';

export interface PfandPolicy {
  tableService?: boolean;
  counterPickup?: boolean;
}

/**
 * Whether deposits (Pfand) are charged for a POS device, based on the org
 * policy and the device's service mode. Single source of truth for the
 * checkout (PosCart) and the customer-display broadcast — keep both callers
 * on this helper so their totals can never diverge.
 * Defaults: no Pfand for table service, Pfand for counter/takeaway.
 */
export function resolveChargePfand(
  policy: PfandPolicy | undefined,
  serviceMode: ServiceMode | string | undefined,
): boolean {
  return serviceMode === 'table'
    ? policy?.tableService ?? false
    : policy?.counterPickup ?? true;
}
