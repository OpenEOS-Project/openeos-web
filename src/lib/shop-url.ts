import { getShopUrl } from '@/lib/runtime-config';

/**
 * Oeffentliche Basis-URL des Kunden-Shops.
 *
 * Kommt zur Laufzeit aus SHOP_URL (Rueckfall: NEXT_PUBLIC_SHOP_URL aus dem
 * Build), damit dasselbe Image auch mit eigener Domain laeuft.
 */
export function shopUrlForEvent(eventId: string): string {
  return `${getShopUrl()}/${eventId}`;
}
