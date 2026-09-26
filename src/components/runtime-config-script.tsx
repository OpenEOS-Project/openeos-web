import { RUNTIME_CONFIG_GLOBAL, readServerRuntimeConfig } from '@/lib/runtime-config';

/**
 * Schreibt die Laufzeit-Konfiguration als Inline-Script in die Seite.
 *
 * Muss vor allem anderen im Body stehen: Inline-Scripts laufen waehrend des
 * Parsens, die Bundles von Next sind `defer`-t. Der Wert steht damit fest,
 * bevor irgendein Client-Modul ihn liest.
 *
 * `script-src` erlaubt in der CSP bereits `'unsafe-inline'` (siehe
 * next.config.ts) — ohne das waere hier eine Nonce noetig.
 */
export function RuntimeConfigScript() {
  const config = readServerRuntimeConfig();

  /* JSON.stringify statt Interpolation, und `<` maskiert: sonst koennte ein
     "</script>" in einer URL das Script-Element vorzeitig beenden. */
  const serialized = JSON.stringify(config).replace(/</g, '\\u003c');

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.${RUNTIME_CONFIG_GLOBAL}=${serialized};`,
      }}
    />
  );
}
