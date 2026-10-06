#!/usr/bin/env node
/**
 * Prüft, dass die Geräteansichten (Kasse, Station, Anzeigen) keine Emojis
 * und keine Unicode-Symbole als Ersatz für Icons enthalten — die Regel des
 * Designsystems (@openeos/ui, „Icons statt Zeichen“). Pfeile, Haken,
 * Kreuze und die Rücktaste kommen aus dem Icon-Set, leere Werte zeigt CSS.
 *
 * Geprüft werden
 *  - Quelltexte unter src/app/[locale]/device/** (ohne Kommentare),
 *  - die Texte der Namensräume, die diese Ansichten verwenden
 *    (pos, deviceUi, device) in src/messages/{de,en}.json.
 *
 * Aufruf: node scripts/check-pos-symbols.mjs — Exit-Code 1 bei Treffern.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const DEVICE_DIR = join(root, 'src', 'app', '[locale]', 'device');
const MESSAGES = ['de', 'en'].map((lang) => join(root, 'src', 'messages', `${lang}.json`));
const NAMESPACES = ['pos', 'deviceUi', 'device'];

/** Ausdrücklich verbotene Zeichen (aus der Kassen-Spezifikation) plus Verwandte. */
const SYMBOLS = '⚠✓✔✕✖✗✘⋯…↩↪▾▴▸◂▲▼►◄⌫×−→←↑↓⇒⇐➜➔•';
// Auslassungspunkte (…) sind Satzzeichen, keine Icons — in Texten erlaubt.
const ALLOWED = new Set(['…']);
const symbolRe = new RegExp(`[${[...SYMBOLS].filter((c) => !ALLOWED.has(c)).join('')}]`, 'u');
const emojiRe = /\p{Extended_Pictographic}/u;

/** Entfernt Block- und Zeilenkommentare (grob, reicht für TS/TSX/CSS). */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length));
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(tsx?|css)$/.test(entry.name)) yield path;
  }
}

const findings = [];
const check = (where, text) => {
  const hit = text.match(symbolRe) ?? text.match(emojiRe);
  if (hit) findings.push(`${where}: "${hit[0]}" (U+${hit[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`);
};

for await (const file of walk(DEVICE_DIR)) {
  const lines = stripComments(await readFile(file, 'utf8')).split('\n');
  lines.forEach((line, index) => check(`${relative(root, file)}:${index + 1}`, line));
}

for (const file of MESSAGES) {
  const messages = JSON.parse(await readFile(file, 'utf8'));
  const visit = (node, path) => {
    if (typeof node === 'string') check(`${relative(root, file)} ${path}`, node);
    else if (node && typeof node === 'object') for (const [key, value] of Object.entries(node)) visit(value, `${path}.${key}`);
  };
  for (const ns of NAMESPACES) if (messages[ns]) visit(messages[ns], ns);
}

if (findings.length > 0) {
  console.error(`Emojis/Unicode-Symbole in den Geräteansichten (${findings.length}):`);
  for (const finding of findings) console.error(`  ${finding}`);
  console.error('Icons aus @openeos/ui verwenden (<Icon name="…" />), leere Werte per CSS.');
  process.exit(1);
}
console.log('check-pos-symbols: keine Emojis oder Unicode-Symbole gefunden.');
