/**
 * Verteilt einen erhaltenen Barbetrag auf mehrere Teilzahlungen.
 *
 * Bezahlt eine Barzahlung mehrere Bestellungen auf einmal, legt die Kasse
 * je Bestellung eine eigene Zahlung an. Bekaeme jede den vollen erhaltenen
 * Betrag mit, wiese jeder Bon das Rueckgeld gegen nur seinen Teilbetrag aus
 * — zusammen viel zu viel. Deshalb traegt nur die letzte Zahlung den Betrag,
 * abzueglich dessen, was die anderen schon abdecken: Ihr Bon zeigt dann
 * genau das Rueckgeld, das der Gast tatsaechlich bekommt.
 */
export function amountReceivedFor(
  index: number,
  amounts: number[],
  amountReceived: number | undefined,
): number | undefined {
  if (amountReceived === undefined || index !== amounts.length - 1) return undefined;
  const coveredByOthers = amounts.slice(0, -1).reduce((sum, amount) => sum + amount, 0);
  return Math.round((amountReceived - coveredByOthers) * 100) / 100;
}
