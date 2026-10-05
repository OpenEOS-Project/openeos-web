import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/**
 * Seitentitel fuer Routen, deren page.tsx eine Client-Komponente ist und
 * deshalb selbst kein `generateMetadata` exportieren darf. Ein schlankes
 * layout.tsx daneben exportiert `generateMetadata = pageTitle('…')`.
 *
 * Der Schluessel liegt unter `pageTitles.*` — getrennt von den
 * Ueberschriften, weil die teils als Satz formuliert sind
 * ("Willkommen zurueck.") und im Browser-Tab ohne Punkt stehen sollen.
 */
export function pageTitle(key: string) {
  return async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('pageTitles');
    return { title: t(key) };
  };
}
