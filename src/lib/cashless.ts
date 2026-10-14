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

/**
 * Ablauf am Schalter „Bargeldloser Modus“.
 *
 * Einschalten speichert sofort. Ausschalten erlaubt wieder Bargeld — dafür
 * schreibt die Kassensicherungsverordnung eine TSE vor —, deshalb fragt die
 * Oberfläche vorher nach. Erst die Bestätigung schickt die Änderung an die
 * API; Abbrechen schließt nur die Rückfrage, der Modus bleibt an.
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
