#!/usr/bin/env node
/**
 * Stellt die Produkt-Icons aus @openeos/pos-icons als statische Dateien
 * bereit: public/pos-icons/<id>.png (256 px) und public/pos-icons/index.json
 * (id + Suchbegriffe, ohne Bilddaten) für die Icon-Auswahl.
 *
 * Läuft vor `next dev` und `next build` (package.json). Das npm-Paket ist
 * die einzige Quelle; public/pos-icons/ ist erzeugt und steht in .gitignore.
 *
 * Warum nicht <PosIcon> aus dem Paket: dessen dist enthält alle 47 PNGs als
 * data:-URIs (gut 3 MB) — im Client-Bundle zu schwer. Als Dateien lädt der
 * Browser nur die Bilder, die er zeigt, und speichert sie im Cache.
 *
 * Aufruf: node scripts/sync-pos-icons.mjs
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(root, 'public', 'pos-icons');

// package.json ist nicht exportiert und das Paket nur als ESM ("import")
// beschrieben — über den Haupteinstieg (dist/index.js) gehen.
const pkgDir = join(dirname(fileURLToPath(import.meta.resolve('@openeos/pos-icons'))), '..');
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const entries = JSON.parse(readFileSync(join(pkgDir, 'data', 'index.json'), 'utf8'));
const pngDir = join(pkgDir, 'icons', '256');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const index = [];
for (const entry of entries) {
  if (!/^[a-z0-9-]+$/.test(entry.id)) throw new Error(`Unerwartete Icon-ID: ${entry.id}`);
  const file = entry.icon256 ?? `${entry.id}.png`;
  const source = join(pngDir, file);
  if (!existsSync(source)) throw new Error(`PNG fehlt im Paket: ${file}`);
  copyFileSync(source, join(OUT, `${entry.id}.png`));
  index.push({ id: entry.id, terms: entry.terms });
}

writeFileSync(join(OUT, 'index.json'), `${JSON.stringify({ version: pkg.version, icons: index })}\n`);
const copied = readdirSync(OUT).filter((f) => f.endsWith('.png')).length;
console.log(`pos-icons ${pkg.version}: ${copied} Bilder nach public/pos-icons/`);
