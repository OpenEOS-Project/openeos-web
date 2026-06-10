// Public base URL of the customer-facing event shop. Override at build time
// via NEXT_PUBLIC_SHOP_URL (e.g. http://localhost:3004 in development).
export const SHOP_URL = process.env.NEXT_PUBLIC_SHOP_URL || 'https://shop.openeos.de';

export function shopUrlForEvent(eventId: string): string {
  return `${SHOP_URL}/${eventId}`;
}
