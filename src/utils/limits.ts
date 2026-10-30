/**
 * Plaetze einer Schranke (Mitglieder je Organisation, Organisationen je
 * Benutzer). Die API meldet `limit` als wirksame Obergrenze, 0 heisst
 * unbegrenzt; `used` zaehlt bei Mitgliedern aktive plus offene Einladungen.
 */
export interface SeatUsage {
  used: number;
  /** Wirksame Obergrenze; 0 = unbegrenzt. */
  limit: number;
  unlimited: boolean;
  /** Kein Platz mehr frei — Einladen bzw. Anlegen ist gesperrt. */
  full: boolean;
  /** Freie Plaetze; bei unbegrenzt `null`. */
  remaining: number | null;
}

/**
 * Fehlt eine der Zahlen (aeltere API, Antwort noch unterwegs), gilt die
 * Schranke als nicht erreicht: die API prueft ohnehin, und ein faelschlich
 * gesperrter Knopf waere schlimmer als ein spaeter Fehlerhinweis.
 */
export function seatUsage(used: number | undefined | null, limit: number | undefined | null): SeatUsage {
  const safeUsed = Math.max(0, Math.trunc(used ?? 0));
  if (limit === undefined || limit === null || !Number.isFinite(limit) || limit <= 0) {
    return { used: safeUsed, limit: 0, unlimited: true, full: false, remaining: null };
  }
  const safeLimit = Math.trunc(limit);
  return {
    used: safeUsed,
    limit: safeLimit,
    unlimited: false,
    full: safeUsed >= safeLimit,
    remaining: Math.max(0, safeLimit - safeUsed),
  };
}
