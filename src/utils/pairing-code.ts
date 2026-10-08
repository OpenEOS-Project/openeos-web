/**
 * Kopplungscode eines Geräts: sechs Ziffern, angezeigt auf /device/pair
 * bzw. /device/register und eingegeben unter „Gerät verbinden".
 *
 * Angezeigt wird er ohne Trenner („573080"), eingegeben darf er beliebig
 * aussehen — wer ihn abschreibt oder aus einer Nachricht einfügt, bringt
 * oft Leerzeichen oder Bindestriche mit („57 30 80", „573-080"). Alles
 * außer Ziffern fällt weg, danach zählen die ersten sechs.
 */
export const PAIRING_CODE_LENGTH = 6;

export function normalizePairingCode(input: string | null | undefined): string {
  return (input ?? '').replace(/\D/g, '').slice(0, PAIRING_CODE_LENGTH);
}
