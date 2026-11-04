#!/usr/bin/env node
/**
 * Erzeugt src/content/legal/muster-datenschutzhinweise-shop.ts aus der
 * gleichnamigen .md-Datei daneben.
 *
 * Die .md-Datei ist das Muster aus den Rechtstexten, Wort für Wort. Die
 * Oberfläche braucht den Text als Zeichenkette; ein Import von .md bräuchte
 * eigene Loader für Webpack und Turbopack. Deshalb ein erzeugtes Modul —
 * der Unit-Test (tests/unit/shop-privacy-template.spec.ts) schlägt fehl,
 * sobald beide auseinanderlaufen.
 *
 * Aufruf nach einer Änderung am Muster:  node scripts/gen-legal-templates.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src/content/legal');
const name = 'muster-datenschutzhinweise-shop';

const source = readFileSync(join(dir, `${name}.md`), 'utf8');
const out = `// Erzeugt von scripts/gen-legal-templates.mjs aus ${name}.md — nicht von Hand ändern.
// Der Wortlaut muss mit dem Muster in den Rechtstexten übereinstimmen.

export const SHOP_PRIVACY_TEMPLATE_SOURCE: string = ${JSON.stringify(source)};
`;
writeFileSync(join(dir, `${name}.ts`), out);
console.log(`src/content/legal/${name}.ts geschrieben (${source.length} Zeichen)`);
