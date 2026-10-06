/**
 * Datensparsame Fehlerberichte.
 *
 * Fehlerberichte enthalten nur, was zum Nachvollziehen des Fehlers noetig
 * ist: Pfad ohne Query, Methode und wenige unkritische Kopfzeilen. Alles,
 * was eine Sitzung, ein Geraet oder eine Person identifiziert (Cookies,
 * Authorization, Geraete-Token, Query-Strings, Request-Body, IP, E-Mail),
 * bleibt draussen.
 *
 * Bewusst reines JavaScript ohne Abhaengigkeiten: Die Datei wird von den
 * Sentry-Konfigurationen (Server, Edge, Browser) eingebunden und laesst sich
 * ohne Build mit `node --test` pruefen (scripts/error-report-scrub.test.mjs).
 */

/** Kopfzeilen, die in Fehlerberichten erhalten bleiben (klein geschrieben). */
export const ALLOWED_HEADERS = ['user-agent', 'accept-language', 'referer'];

/** Kopfzeilen, deren Wert eine URL ist — dort wird die Query entfernt. */
const URL_HEADERS = new Set(['referer']);

/**
 * Entfernt Query-String und Fragment aus einer URL oder einem Pfad.
 *
 * @param {unknown} url
 * @returns {string | undefined}
 */
export function stripQuery(url) {
  if (typeof url !== 'string') return undefined;
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/**
 * Reduziert Kopfzeilen auf die Allowlist. Namen werden klein geschrieben,
 * Mehrfachwerte zusammengefuegt, URL-Werte ohne Query uebernommen.
 *
 * @param {unknown} headers
 * @returns {Record<string, string>}
 */
export function filterHeaders(headers) {
  /** @type {Record<string, string>} */
  const result = {};
  if (!headers || typeof headers !== 'object') return result;

  for (const [rawName, rawValue] of Object.entries(headers)) {
    const name = rawName.toLowerCase();
    if (!ALLOWED_HEADERS.includes(name)) continue;

    let value = Array.isArray(rawValue) ? rawValue.join(', ') : rawValue;
    if (typeof value !== 'string') continue;
    if (URL_HEADERS.has(name)) value = stripQuery(value) ?? '';
    if (value) result[name] = value;
  }
  return result;
}

/**
 * Bereinigt die Angaben zur Anfrage, die Next an `onRequestError` uebergibt.
 *
 * @param {{ path?: unknown; method?: unknown; headers?: unknown } | undefined} request
 * @returns {{ path: string | undefined; method: string | undefined; headers: Record<string, string> }}
 */
export function scrubRequestInfo(request) {
  return {
    path: stripQuery(request?.path),
    method: typeof request?.method === 'string' ? request.method : undefined,
    headers: filterHeaders(request?.headers),
  };
}

/**
 * Bereinigt ein Sentry-Ereignis (Fehler oder Transaktion) vor dem Versand.
 * Veraendert das Ereignis an Ort und Stelle und gibt es zurueck, damit die
 * Funktion direkt als `beforeSend` / `beforeSendTransaction` dienen kann.
 *
 * @template {object} T
 * @param {T} event
 * @returns {T}
 */
export function scrubErrorEvent(event) {
  if (!event || typeof event !== 'object') return event;
  /** @type {Record<string, any>} */
  const e = event;

  if (e.request && typeof e.request === 'object') {
    const request = e.request;
    delete request.cookies;
    delete request.data;
    delete request.query_string;
    delete request.env;
    if (typeof request.url === 'string') request.url = stripQuery(request.url);
    if (request.headers) request.headers = filterHeaders(request.headers);
  }

  // Hoechstens die Nutzer-ID — keine E-Mail, kein Name, keine IP.
  if (e.user && typeof e.user === 'object') {
    const id = e.user.id;
    if (id === undefined || id === null || id === '') delete e.user;
    else e.user = { id };
  }

  if (e.extra && typeof e.extra === 'object' && e.extra.request) {
    e.extra.request = scrubRequestInfo(e.extra.request);
  }

  if (Array.isArray(e.breadcrumbs)) {
    e.breadcrumbs = e.breadcrumbs.map(scrubBreadcrumb);
  }

  // Transaktionen tragen die URL zusaetzlich in den Span-Attributen.
  scrubUrlData(e.contexts?.trace?.data);
  if (Array.isArray(e.spans)) {
    for (const span of e.spans) scrubUrlData(span?.data);
  }

  return event;
}

/**
 * Entfernt Query-Strings aus URLs in Breadcrumbs (fetch/xhr/Navigation).
 *
 * @template {object} T
 * @param {T} breadcrumb
 * @returns {T}
 */
export function scrubBreadcrumb(breadcrumb) {
  if (!breadcrumb || typeof breadcrumb !== 'object') return breadcrumb;
  /** @type {Record<string, any>} */
  const b = breadcrumb;
  scrubUrlData(b.data);
  return breadcrumb;
}

/** Attribute, deren Wert eine URL oder ein Pfad samt Query sein kann. */
const URL_KEYS = ['url', 'from', 'to', 'http.url', 'http.target', 'url.full', 'url.path'];

/** Attribute, die nur aus Query oder Fragment bestehen. */
const QUERY_KEYS = ['http.query', 'http.fragment', 'url.query', 'url.fragment'];

/** @param {unknown} data */
function scrubUrlData(data) {
  if (!data || typeof data !== 'object') return;
  /** @type {Record<string, unknown>} */
  const d = /** @type {Record<string, unknown>} */ (data);
  for (const key of URL_KEYS) {
    if (typeof d[key] === 'string') d[key] = stripQuery(d[key]);
  }
  for (const key of QUERY_KEYS) delete d[key];
}
