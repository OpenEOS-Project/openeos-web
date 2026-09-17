import { redirect } from 'next/navigation';

/**
 * Alter Einstieg für Anzeigen.
 *
 * Die Kopplung gilt inzwischen für jede Geräteart und liegt unter
 * /device/pair. Diese Route bleibt bestehen, weil sie auf ausgedruckten
 * Zetteln und in Lesezeichen stehen kann.
 */
export default function DeviceDisplayPage() {
  redirect('/device/pair?type=display');
}
