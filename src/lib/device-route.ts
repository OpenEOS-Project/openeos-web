import type { DeviceClass } from '@/types/device';

/**
 * Wohin ein freigegebenes Gerät gehört.
 *
 * Anzeigen zeigen standardmäßig den Warenkorb für Gäste; nur wer
 * ausdrücklich als Stationsanzeige eingerichtet ist, landet in der
 * Küchenansicht. Für alles andere bleibt die Kasse.
 *
 * Lag vorher nur in der Registrierungsseite. Die Anzeigen-Kopplung
 * braucht dieselbe Entscheidung, und zwei Fassungen würden beim nächsten
 * neuen Anzeigetyp auseinanderlaufen.
 */
export function zielRouteFuerGeraet(
  deviceClass: DeviceClass | null | undefined,
  settings: { displayMode?: string } | null | undefined,
): string {
  if (deviceClass !== 'display') return '/device/pos';
  return settings?.displayMode === 'station' ? '/device/station' : '/device/customer';
}
