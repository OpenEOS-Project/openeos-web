/**
 * Content-Security-Policy der Oberflaeche.
 *
 * Liegt hier und nicht in `next.config.ts`: Kopfzeilen aus der
 * Next-Konfiguration werden beim `next build` in das Routen-Manifest
 * geschrieben und stehen damit fest, bevor jemand das fertige Abbild
 * startet. Die Middleware wertet diese Funktion dagegen bei jeder Anfrage
 * aus.
 */
export function buildContentSecurityPolicy(options: {
  isDev: boolean;
  /** Wurde die Seite selbst ohne TLS ausgeliefert? */
  insecureOrigin: boolean;
}): string {
  const { isDev, insecureOrigin } = options;

  const connectSrc = [
    "'self'",
    'https:',
    // Eigener Scheme: ein Browser behandelt wss: nicht als Teil von https:.
    // Genau daran scheiterten schon einmal saemtliche Sockets, waehrend die
    // Oberflaeche lebendig aussah.
    'wss:',
    ...(isDev
      ? ['http://localhost:*', 'http://127.0.0.1:*', 'ws://localhost:*', 'ws://127.0.0.1:*']
      : []),
    /* Wird die Oberflaeche selbst ueber http ausgeliefert, laeuft diese
       Installation ohnehin ohne TLS — typischerweise eine eigenstaendige
       Installation im Vereinsnetz. Die API dort auf https festzunageln
       brachte keinen Schutz, sondern nur eine lautlose Sperre: der Browser
       blockt jede Anfrage, sichtbar sind bloss leere Listen.

       Umgekehrt bleibt eine ueber https ausgelieferte Oberflaeche streng —
       sie koennte eine http-API gar nicht ansprechen, das verbietet schon
       die Mixed-Content-Regel des Browsers. Die Lockerung greift also nur
       dort, wo sie nichts aufgibt. */
    ...(insecureOrigin && !isDev ? ['http:', 'ws:'] : []),
  ];

  return [
    "default-src 'self'",
    // 'unsafe-inline' bleibt noetig, solange der App Router seine
    // Bootstrap-Skripte inline einfuegt und keine Nonce durchgereicht wird.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(' ')}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}
