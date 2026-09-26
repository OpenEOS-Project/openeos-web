/**
 * Laufzeit-Konfiguration der Oberflaeche.
 *
 * `NEXT_PUBLIC_*` wird beim `next build` fest in das Client-Bundle
 * hineingeschrieben. Fuer den gehosteten Betrieb ist das unproblematisch —
 * dort baut dieselbe Pipeline, die auch ausliefert. Fuer eine eigenstaendige
 * Installation war es der Grund, warum das veroeffentlichte Image unbrauchbar
 * war: darin steht `https://api.openeos.de`, und wer seine eigene API
 * betreibt, musste das Image selbst neu bauen.
 *
 * Deshalb kommen diese Werte jetzt zur Laufzeit aus dem Next-Server
 * (`output: 'standalone'`, also ein echter Node-Prozess) und werden im
 * Wurzel-Layout als Inline-Script in die Seite geschrieben. Die
 * `NEXT_PUBLIC_*`-Werte bleiben als Rueckfallebene erhalten, damit sich am
 * bestehenden Build nichts aendert.
 */

export interface RuntimeConfig {
  /** Basis-URL der API, ohne `/api`-Suffix. */
  apiUrl: string;
  /** Oeffentliche Basis-URL des Event-Shops. */
  shopUrl: string;
}

/** Name des globalen Feldes, ueber das der Server die Werte durchreicht. */
export const RUNTIME_CONFIG_GLOBAL = '__OPENEOS_RUNTIME_CONFIG__';

const BUILD_TIME_FALLBACK: RuntimeConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  shopUrl: process.env.NEXT_PUBLIC_SHOP_URL || 'https://shop.openeos.de',
};

/**
 * Liest die Werte, die der Server fuer diesen Prozess vorgibt.
 *
 * Nur serverseitig aufrufen: im Browser sind diese Variablen leer.
 */
export function readServerRuntimeConfig(): RuntimeConfig {
  return {
    apiUrl: process.env.API_URL || BUILD_TIME_FALLBACK.apiUrl,
    shopUrl: process.env.SHOP_URL || BUILD_TIME_FALLBACK.shopUrl,
  };
}

function initialConfig(): RuntimeConfig {
  if (typeof window === 'undefined') {
    return readServerRuntimeConfig();
  }

  const injected = (window as unknown as Record<string, unknown>)[RUNTIME_CONFIG_GLOBAL];
  if (injected && typeof injected === 'object') {
    const { apiUrl, shopUrl } = injected as Partial<RuntimeConfig>;
    return {
      apiUrl: apiUrl || BUILD_TIME_FALLBACK.apiUrl,
      shopUrl: shopUrl || BUILD_TIME_FALLBACK.shopUrl,
    };
  }

  return BUILD_TIME_FALLBACK;
}

/* Bewusst ein Modulwert und kein React-Context: `resolveUploadUrl` wird
   mitten im Rendern aus gewoehnlichen Funktionen heraus aufgerufen, und der
   API-Client ist ein Singleton, der schon beim Import existiert. Beide
   koennten einen Hook nicht benutzen. */
let current: RuntimeConfig = initialConfig();

export function getRuntimeConfig(): RuntimeConfig {
  return current;
}

/** Basis-URL der API ohne `/api`-Suffix (z. B. fuer WebSocket und Uploads). */
export function getApiBaseUrl(): string {
  return current.apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
}

/** Basis-URL der REST-Schnittstelle, inklusive `/api`. */
export function getApiUrl(): string {
  return `${getApiBaseUrl()}/api`;
}

export function getShopUrl(): string {
  return current.shopUrl.replace(/\/$/, '');
}
