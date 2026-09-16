/**
 * Wiedererkennungswert für dieses Gerät.
 *
 * Kein Sicherheitsmerkmal, sondern eine Bequemlichkeit: Er entscheidet,
 * ob ein Gerät als vertraut gilt und der zweite Faktor entfallen darf.
 * Fälschbar ist er ohnehin — wer ihn kennt, braucht trotzdem das
 * Passwort, und die Markierung entsteht erst nach einem bestätigten Code.
 *
 * Lag vorher nur in der 2FA-Seite. Die Anmeldung braucht denselben Wert,
 * und zwei Fassungen würden über kurz oder lang verschiedene Ergebnisse
 * liefern — dann gälte kein Gerät mehr als vertraut.
 */
export function getDeviceFingerprint(): string {
  const data = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|');

  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
