/**
 * Bargeldloser Modus der Organisation (`settings.payments.cashless`).
 *
 * Im bargeldlosen Modus sperrt die API jeden Bargeldweg
 * (CASH_PAYMENTS_DISABLED); Kasse und Verwaltung blenden die
 * Bargeld-Bedienung dann aus. Ohne Eintrag ist Bargeld erlaubt (Standard).
 *
 * Von der TSE-Pflicht befreit der Modus allein nicht: Der Verein kann ihn
 * selbst wieder ausschalten, und nach Auskunft des BMF liegt eine
 * Kassenfunktion schon vor, wenn sich Bargeld selbst einschalten lässt.
 * TSE-frei ist nur die Betriebsart „Nur Bestellen“, die der Support schaltet.
 */

/** Nur ein ausdrückliches `true` zählt — wie in der API. */
export function isCashlessMode(settings: { payments?: { cashless?: boolean } } | null | undefined): boolean {
  return settings?.payments?.cashless === true;
}

/** FAQ-Eintrag zu Bargeld und TSE auf openeos.de (je Sprache). */
export function tseFaqUrl(locale: string): string {
  return locale === 'en' ? 'https://openeos.de/en/faq#tse' : 'https://openeos.de/faq#tse';
}

/** FAQ-Eintrag zur Betriebsart „Nur Bestellen“ auf openeos.de (je Sprache). */
export function orderOnlyFaqUrl(locale: string): string {
  return locale === 'en' ? 'https://openeos.de/en/faq#nur-bestellen' : 'https://openeos.de/faq#nur-bestellen';
}

/**
 * Ablauf am Schalter „Bargeldloser Modus“.
 *
 * Einschalten speichert sofort. Ausschalten erlaubt wieder Bargeld, deshalb
 * fragt die Oberfläche vorher nach (mit Hinweis zur TSE-Pflicht). Erst die
 * Bestätigung schickt die Änderung an die API; Abbrechen schließt nur die Rückfrage, der Modus bleibt an.
 *
 * `confirmOff`: ob die Rückfrage offen ist. `save`: der Wert, der an die API
 * geht, oder `null`, wenn nichts gesendet wird.
 */
export type CashlessSwitchEvent = { type: 'toggle'; checked: boolean } | { type: 'confirm' } | { type: 'cancel' };

export interface CashlessSwitchStep {
  confirmOff: boolean;
  save: boolean | null;
}

export function cashlessSwitchStep(confirmOff: boolean, event: CashlessSwitchEvent): CashlessSwitchStep {
  switch (event.type) {
    case 'toggle':
      return event.checked ? { confirmOff: false, save: true } : { confirmOff: true, save: null };
    case 'confirm':
      // Die Rückfrage bleibt offen, bis die API geantwortet hat.
      return confirmOff ? { confirmOff: true, save: false } : { confirmOff: false, save: null };
    case 'cancel':
      return { confirmOff: false, save: null };
  }
}
