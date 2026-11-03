import dynamic from 'next/dynamic';
import type { ComponentType, FC } from 'react';
import { CreditCard, ShieldCheck } from 'lucide-react';

import type { IntegrationId, Organization, OrganizationSettings } from '@/types/organization';

export interface IntegrationScreenshot {
  /** Pfad unter /public; `{locale}` wird durch die aktuelle Sprache ersetzt. */
  src: string;
  /** Übersetzungsschlüssel im Namensraum `integrations`. */
  altKey: string;
}

export interface IntegrationDefinition {
  id: IntegrationId;
  /** Markenname — wird nicht übersetzt. */
  name: string;
  /**
   * Übersetzungsschlüssel für den Namen, falls es (noch) keinen Markennamen
   * gibt, z. B. bei einer Integration, deren Anbieter nicht feststeht. Ist
   * er gesetzt, zeigt die Oberfläche ihn statt `name`.
   */
  nameKey?: string;
  /** Übersetzungsschlüssel für die Art des Dienstes, z. B. "Kartenzahlung". */
  vendorKey: string;
  /** Hausfarbe des Anbieters für die Ersatzkachel, solange kein `logo` eingetragen ist. */
  color: string;
  /**
   * Offizielles Logo unter /public, z. B. '/integrations/sumup.svg'. Nur
   * eintragen, wenn die Datei wirklich abgelegt ist — ohne Eintrag wird
   * gar nicht erst nachgefragt (keine 404 bei jedem Aufruf).
   */
  logo?: string;
  /**
   * Lässt die API das Einschalten zu? `false` zeigt die Integration als
   * angekündigt: das Infofenster geht auf, aber ohne Schalter.
   */
  available: boolean;
  /** Übersetzungsschlüssel (Namensraum `integrations`). */
  shortDescriptionKey: string;
  longDescriptionKey: string;
  requirementKeys: string[];
  /** Was beim Ausschalten wegfällt — steht in der Rückfrage auf der Konfigurationsseite. */
  deactivateEffectKey?: string;
  docsUrl?: Record<'de' | 'en', string>;
  /**
   * Ziel für `<link>…</link>` in der langen Beschreibung, z. B. ein Eintrag
   * in den FAQ auf openeos.de.
   */
  moreInfoUrl?: Record<'de' | 'en', string>;
  screenshots: IntegrationScreenshot[];
  /** Symbol für den Eintrag in der Seitenleiste. */
  navIcon: FC<{ className?: string }>;
  /** Inhalt der Konfigurationsseite /integrations/<id>. */
  ConfigComponent?: ComponentType;
  /**
   * Nur in diesen Ländern einschaltbar (ISO 3166-1 alpha-2). Andere
   * Organisationen sehen die Karte mit dem Hinweis `countryHintKey`.
   */
  countries?: string[];
  /** Hinweis für Organisationen außerhalb von `countries`. */
  countryHintKey?: string;
  /**
   * Bietet dieser Server die Integration an? Ohne Angabe: ja. `false`
   * zeigt die Karte mit `serverUnavailableKey` statt des Schalters.
   */
  serverAvailable?: (organization: Partial<Organization> | null | undefined) => boolean;
  serverUnavailableKey?: string;
  /**
   * Ausschalten gerade nicht möglich (z. B. Cloud-TSE aktiv: erst
   * endgültig deaktivieren). Die Rückfrage erklärt es mit `deactivateBlockedKey`.
   */
  deactivateBlocked?: (organization: Partial<Organization> | null | undefined) => boolean;
  deactivateBlockedKey?: string;
}

/**
 * Katalog aller Integrationen.
 *
 * Eine weitere Anbindung soll ein Eintrag hier sein und kein Umbau: Katalog,
 * Infofenster, Seitenleiste und Konfigurationsseite lesen alle aus dieser
 * Liste. Die Konfigurationskomponente wird erst auf ihrer Seite geladen,
 * damit die Seitenleiste — die den Katalog ebenfalls braucht — nicht den
 * Code jeder Integration mitschleppt.
 */
export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: 'sumup',
    name: 'SumUp',
    vendorKey: 'sumup.vendor',
    color: '#1B1B1B',
    available: true,
    shortDescriptionKey: 'sumup.description',
    longDescriptionKey: 'sumup.longDescription',
    requirementKeys: [
      'sumup.requirements.account',
      'sumup.requirements.reader',
      'sumup.requirements.apiKey',
    ],
    deactivateEffectKey: 'sumup.deactivateEffect',
    docsUrl: {
      de: 'https://docs.openeos.de/integrationen/sumup',
      en: 'https://docs.openeos.de/en/integrationen/sumup',
    },
    screenshots: [
      {
        src: '/integrations/screenshots/sumup/{locale}/01-konfiguration.png',
        altKey: 'sumup.screenshots.configuration',
      },
      {
        src: '/integrations/screenshots/sumup/{locale}/02-kasse-kartenzahlung.png',
        altKey: 'sumup.screenshots.posCardPayment',
      },
      {
        src: '/integrations/screenshots/sumup/{locale}/03-lesegeraet-koppeln.png',
        altKey: 'sumup.screenshots.pairReader',
      },
    ],
    navIcon: CreditCard,
    ConfigComponent: dynamic(() =>
      import('@/components/integrations/sumup-integration').then((m) => m.SumUpIntegration),
    ),
  },
  {
    id: 'stripe',
    name: 'Stripe',
    vendorKey: 'stripe.vendor',
    color: '#635BFF',
    available: false,
    shortDescriptionKey: 'stripe.description',
    longDescriptionKey: 'stripe.longDescription',
    requirementKeys: ['stripe.requirements.account'],
    screenshots: [],
    navIcon: CreditCard,
  },
  {
    // Name ohne Anbieter („Cloud-TSE“); Swissbit steht nur in der langen
    // Beschreibung, wie SumUp bei der Kartenzahlung.
    id: 'tse',
    name: 'Cloud-TSE',
    nameKey: 'tse.name',
    vendorKey: 'tse.vendor',
    color: '#475569',
    available: true,
    shortDescriptionKey: 'tse.description',
    longDescriptionKey: 'tse.longDescription',
    requirementKeys: ['tse.requirements.country', 'tse.requirements.paidEvent', 'tse.requirements.internet'],
    deactivateEffectKey: 'tse.deactivateEffect',
    docsUrl: {
      de: 'https://docs.openeos.de/integrationen/cloud-tse',
      en: 'https://docs.openeos.de/en/integrationen/cloud-tse',
    },
    moreInfoUrl: {
      de: 'https://openeos.de/faq#tse',
      en: 'https://openeos.de/en/faq#tse',
    },
    screenshots: [],
    navIcon: ShieldCheck,
    countries: ['DE'],
    countryHintKey: 'tse.onlyGermany',
    serverAvailable: (organization) => organization?.tse?.available !== false,
    serverUnavailableKey: 'tse.serverUnavailable',
    deactivateBlocked: (organization) =>
      organization?.tse?.state === 'active' || organization?.tse?.state === 'creating',
    deactivateBlockedKey: 'tse.deactivateBlocked',
    ConfigComponent: dynamic(() =>
      import('@/components/integrations/tse-integration').then((m) => m.TseIntegration),
    ),
  },
];

export function getIntegration(id: string): IntegrationDefinition | undefined {
  return INTEGRATIONS.find((integration) => integration.id === id);
}

/**
 * Nur ein ausdrückliches `enabled === true` zählt — wie in der API. Aus
 * hinterlegten Zugangsdaten (`settings.sumup.merchantCode`) wird bewusst
 * nichts abgeleitet: Bestandsorganisationen hat die Migration der API
 * eingeschaltet, und ein Ausschalten soll die Daten behalten dürfen.
 */
export function isIntegrationEnabled(
  settings: Partial<OrganizationSettings> | null | undefined,
  id: IntegrationId,
): boolean {
  return settings?.integrations?.[id]?.enabled === true;
}

/** Aktive und einschaltbare Integrationen, in Katalogreihenfolge. */
export function getEnabledIntegrations(
  settings: Partial<OrganizationSettings> | null | undefined,
): IntegrationDefinition[] {
  return INTEGRATIONS.filter(
    (integration) => integration.available && isIntegrationEnabled(settings, integration.id),
  );
}

/**
 * Anzeigename: der übersetzte `nameKey`, sonst der Markenname. `t` ist ein
 * Übersetzer für den Namensraum `integrations`.
 */
export function integrationName(
  integration: IntegrationDefinition,
  t: (key: string) => string,
): string {
  return integration.nameKey ? t(integration.nameKey) : integration.name;
}

/**
 * Kann die Organisation die Integration einschalten?
 * - `available`: ja,
 * - `comingSoon`: noch in Vorbereitung,
 * - `country`: nicht im Land der Organisation,
 * - `server`: dieser Server bietet sie nicht an.
 */
export type IntegrationAvailability = 'available' | 'comingSoon' | 'country' | 'server';

export function integrationAvailability(
  integration: IntegrationDefinition,
  organization: Partial<Organization> | null | undefined,
): IntegrationAvailability {
  if (!integration.available) return 'comingSoon';
  if (integration.countries) {
    const country = (organization?.country ?? '').trim().toUpperCase();
    if (!integration.countries.includes(country)) return 'country';
  }
  if (integration.serverAvailable && !integration.serverAvailable(organization)) return 'server';
  return 'available';
}

export function integrationHref(id: IntegrationId): string {
  return `/integrations/${id}`;
}

export function integrationDocsUrl(
  integration: IntegrationDefinition,
  locale: string,
): string | undefined {
  if (!integration.docsUrl) return undefined;
  return locale === 'en' ? integration.docsUrl.en : integration.docsUrl.de;
}

export function integrationMoreInfoUrl(
  integration: IntegrationDefinition,
  locale: string,
): string | undefined {
  if (!integration.moreInfoUrl) return undefined;
  return locale === 'en' ? integration.moreInfoUrl.en : integration.moreInfoUrl.de;
}

export function integrationScreenshotSrc(screenshot: IntegrationScreenshot, locale: string): string {
  return screenshot.src.replace('{locale}', locale === 'en' ? 'en' : 'de');
}
