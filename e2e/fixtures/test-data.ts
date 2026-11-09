/**
 * Testdaten der E2E-Suite.
 *
 * Diese Konten legt e2e/global-setup.ts selbst an (Ersteinrichtung ueber
 * POST /api/setup, danach ein Mitglied). Es gibt keinen externen Seed, auf
 * den sie passen muessten.
 */

/** Basis-URL der API ohne `/api` — dieselbe Angabe wie API_URL der Oberflaeche. */
export const API_URL = (process.env.API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '');

/** Administrator aus der Ersteinrichtung: Super-Admin und Admin der Organisation. */
export const TEST_ADMIN = {
  email: 'admin@openeos.local',
  password: 'Admin123!',
  firstName: 'Erika',
  lastName: 'Admin',
};

/** Gewoehnliches Mitglied ohne Modulrechte. */
export const TEST_USER = {
  email: 'mitglied@openeos.local',
  password: 'Mitglied123!',
  firstName: 'Max',
  lastName: 'Mitglied',
};

export const TEST_ORG = {
  name: 'E2E Verein',
};

/**
 * Seit den Phasen (2026-11) verkauft eine aktive Veranstaltung nur in ihrem
 * Verkaufsfenster — eine Veranstaltung am festen Datum 2026-03-01 waere
 * „Beendet“. Die Tests legen sie deshalb fuer heute an.
 */

/** Heute (Europe/Berlin, wie Browser und Organisation) als 'YYYY-MM-DD'. */
export function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
}

/**
 * Beginn fuer Veranstaltungen, die ueber die API angelegt werden: jetzt,
 * mit Uhrzeit. Ein reines Datum laese die API als Mitternacht UTC.
 */
export function nowIso(): string {
  return new Date().toISOString();
}
