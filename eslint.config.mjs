import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * Bis hierher gab es in diesem Projekt ueberhaupt keine ESLint-Konfiguration.
 * `next lint` fiel deshalb in seinen interaktiven Einrichtungsdialog und war
 * in der CI nicht verwendbar — gepruefte wurde nur `tsc --noEmit`.
 *
 * Bewusst der Regelsatz von Next, nicht mehr: Er faengt die Fehler ab, die in
 * einer Next-Anwendung tatsaechlich schaden (falsche Bildeinbindung, Hooks in
 * der falschen Reihenfolge, unerreichbare Server-/Client-Grenzen). Ein
 * strengerer Satz haette am Bestand hunderte Befunde erzeugt und waere nach
 * einer Woche wieder abgeschaltet worden.
 */
const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    /* Playwright-Fixtures heissen `use` und sehen fuer die Hook-Regel aus wie
       ein React-Hook in einer Nicht-Komponente. Sie sind keiner. */
    files: ['e2e/**'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    /* Diese drei stehen bewusst auf "Warnung" statt "Fehler".

       Es sind Altlasten — vor allem ungenutzte Bezeichner und `any` in der
       API-Anbindung. Sie jetzt blockierend zu schalten hiesse, entweder den
       ganzen Bestand in einem Zug umzuschreiben oder die Pruefung nach der
       ersten roten Runde wieder abzuschalten. Als Warnung bleiben sie
       sichtbar und lassen sich abarbeiten, waehrend die Regeln, die echte
       Fehler anzeigen — allen voran `react-hooks/rules-of-hooks` — sofort
       blockieren. */
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
];

export default eslintConfig;
