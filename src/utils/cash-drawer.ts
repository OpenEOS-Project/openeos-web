/**
 * Kassenlade an der Kasse.
 *
 * Die Lade hängt an einem Bondrucker; welcher das ist, steht in den
 * Geräteeinstellungen (`settings.cashDrawerPrinterId`, gesetzt in der
 * Verwaltung unter Gerät → Drucker). Ohne diesen Eintrag lehnt die API
 * `/device-api/cash-drawer/open` mit `CASH_DRAWER_NOT_CONFIGURED` ab — die
 * Kasse ruft sie dann gar nicht erst auf, statt je Barverkauf einen
 * fehlgeschlagenen Aufruf in der Konsole zu hinterlassen.
 */

export type DeviceCashDrawerSettings = { cashDrawerPrinterId?: unknown } | null | undefined;

/** Ob dem Gerät ein Drucker mit Kassenlade zugeordnet ist. */
export function cashDrawerConfigured(settings: DeviceCashDrawerSettings): boolean {
  const id = settings?.cashDrawerPrinterId;
  return typeof id === 'string' && id.trim() !== '';
}

/**
 * Ob die Lade an diesem Gerät überhaupt nutzbar ist: konfiguriert und die
 * Organisation nicht im bargeldlosen Modus (dort gibt es kein Bargeld, also
 * auch nichts abzuzählen).
 */
export function cashDrawerAvailable(options: { settings: DeviceCashDrawerSettings; cashless: boolean }): boolean {
  return !options.cashless && cashDrawerConfigured(options.settings);
}

/**
 * Ob das Kassieren-Blatt die Lade jetzt öffnen soll: Blatt offen, Zahlart
 * Bar, ein Betrag über 0, Lade nutzbar und in diesem Vorgang noch nicht
 * geöffnet (je Vorgang nur einmal, damit sie beim Hin- und Herwechseln der
 * Zahlart nicht wiederholt aufspringt).
 */
export function shouldOpenCashDrawer(options: {
  open: boolean;
  method: string | null;
  amount: number;
  cashless: boolean;
  settings: DeviceCashDrawerSettings;
  alreadyOpened: boolean;
}): boolean {
  if (!options.open || options.alreadyOpened) return false;
  if (options.method !== 'cash' || options.amount <= 0) return false;
  return cashDrawerAvailable({ settings: options.settings, cashless: options.cashless });
}
