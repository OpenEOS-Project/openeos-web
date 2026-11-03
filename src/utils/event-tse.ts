import type { EventTseTerms } from '@/types/billing';

/** Gehört die Cloud-TSE zu dieser Freischaltung (mit der aktuellen Wahl)? */
export function checkoutIncludesTse(
  tse: EventTseTerms | undefined,
  answer: boolean | null
): boolean {
  if (!tse?.offer) return false;
  return tse.offer === 'included' || answer === true;
}

/** Zuschlag, der mit der aktuellen Wahl dazukommt (0 = inklusive). */
export function checkoutTseSurcharge(
  tse: EventTseTerms | undefined,
  answer: boolean | null
): number {
  return checkoutIncludesTse(tse, answer) ? (tse?.surcharge ?? 0) : 0;
}
