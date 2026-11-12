/**
 * Kopplungscode eines Geräts: acht Ziffern, angezeigt auf /device/pair
 * bzw. /device/register und eingegeben unter „Gerät verbinden“. Er gilt
 * 15 Minuten; danach holt sich das Gerät von selbst einen neuen. Geräte,
 * die noch vor der Umstellung einen Code bekommen haben, zeigen sechs
 * Ziffern — die gelten bis zu ihrem Ablauf weiter.
 *
 * Angezeigt wird er ohne Trenner („57308012“), eingegeben darf er beliebig
 * aussehen — wer ihn abschreibt oder aus einer Nachricht einfügt, bringt
 * oft Leerzeichen oder Bindestriche mit („5730 8012“, „5730-8012“). Alles
 * außer Ziffern fällt weg, danach zählen die ersten acht.
 */
export const PAIRING_CODE_LENGTH = 8;

/** Länge der Codes aus der Zeit vor der Umstellung. */
export const LEGACY_PAIRING_CODE_LENGTH = 6;

export function normalizePairingCode(input: string | null | undefined): string {
  return (input ?? '').replace(/\D/g, '').slice(0, PAIRING_CODE_LENGTH);
}

/** Vollständig eingegeben (acht Ziffern, bei älteren Geräten sechs)? */
export function isCompletePairingCode(code: string): boolean {
  return code.length === PAIRING_CODE_LENGTH || code.length === LEGACY_PAIRING_CODE_LENGTH;
}
