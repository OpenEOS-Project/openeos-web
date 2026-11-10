/**
 * Regeln für „Beleg ausgeben“ an der Kasse (Belegausgabepflicht
 * § 146a Abs. 2 AO, AEAO zu § 146a Nr. 2.5).
 */

/** Einfache Prüfung vor dem Senden (die API prüft genauer). */
export function looksLikeEmail(value: string): boolean {
  const v = value.trim();
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/** Gibt es zu diesem Abschluss einen Kassenbeleg? („Ohne Zahlung“: nein.) */
export function receiptAvailable(method: string, orderIds: readonly string[]): boolean {
  return method !== 'free' && orderIds.length > 0;
}

/**
 * Schließt das Abschlussblatt von selbst (nach 5 s)? Nur, wenn der Beleg
 * schon auf Papier ausgegeben ist (automatischer Kassenbon) oder es keinen
 * gibt — sonst bleibt der QR-Code stehen, bis „Kein Beleg“ oder „Nächster
 * Bon“ gewählt ist. Nie bei Rückgeld und nie nach einer Eingabe.
 */
export function doneSheetAutoCloses(state: {
  hasChange: boolean;
  interacted: boolean;
  autoPrinted: boolean;
  receiptAvailable: boolean;
}): boolean {
  return !state.hasChange && !state.interacted && (state.autoPrinted || !state.receiptAvailable);
}
