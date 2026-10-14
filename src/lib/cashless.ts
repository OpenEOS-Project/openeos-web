/**
 * Bargeldloser Modus der Organisation (`settings.payments.cashless`).
 *
 * Eine elektronische Kasse braucht eine zertifizierte TSE nur, wenn sie
 * Bargeld erfassen kann. Im bargeldlosen Modus sperrt die API jeden
 * Bargeldweg (CASH_PAYMENTS_DISABLED); Kasse und Verwaltung blenden die
 * Bargeld-Bedienung dann aus. Ohne Eintrag ist Bargeld erlaubt (Standard).
 */

/** Nur ein ausdrückliches `true` zählt — wie in der API. */
export function isCashlessMode(settings: { payments?: { cashless?: boolean } } | null | undefined): boolean {
  return settings?.payments?.cashless === true;
}

/** FAQ-Eintrag zu Bargeld und TSE auf openeos.de (je Sprache). */
export function tseFaqUrl(locale: string): string {
  return locale === 'en' ? 'https://openeos.de/en/faq#tse' : 'https://openeos.de/faq#tse';
}
