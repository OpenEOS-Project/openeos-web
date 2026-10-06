/**
 * Zonen, in denen die Datumstests laufen: Berlin (Sommer- und Winterzeit),
 * UTC wie auf einem Server, westlich von Greenwich (dort zeigte
 * `new Date('YYYY-MM-DD')` den Vortag) und weit oestlich.
 */
export const TIME_ZONES = ['Europe/Berlin', 'UTC', 'America/New_York', 'Pacific/Auckland'] as const;

/** Fuehrt fn in der angegebenen Zeitzone aus; Node uebernimmt TZ sofort. */
export function inTimeZone<T>(timeZone: string, fn: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}
