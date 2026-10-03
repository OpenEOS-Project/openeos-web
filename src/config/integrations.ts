import dynamic from 'next/dynamic';
import type { ComponentType, FC } from 'react';
import { CreditCard02, ShieldTick } from '@untitledui/icons';

import type { IntegrationId, OrganizationSettings } from '@/types/organization';

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
  /** Übersetzungsschlüssel für die Art des Dienstes, z. B. "Kartenzahlung". */
  vendorKey: string;
  /** Hausfarbe des Anbieters, solange kein Logo unter public/integrations liegt. */
  color: string;
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
  screenshots: IntegrationScreenshot[];
  /** Symbol für den Eintrag in der Seitenleiste. */
  navIcon: FC<{ className?: string }>;
  /** Inhalt der Konfigurationsseite /integrations/<id>. */
  ConfigComponent?: ComponentType;
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
    navIcon: CreditCard02,
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
    navIcon: CreditCard02,
  },
  {
    id: 'fiskaly',
    name: 'fiskaly',
    vendorKey: 'fiskaly.vendor',
    color: '#0F766E',
    available: false,
    shortDescriptionKey: 'fiskaly.description',
    longDescriptionKey: 'fiskaly.longDescription',
    requirementKeys: ['fiskaly.requirements.account'],
    screenshots: [],
    navIcon: ShieldTick,
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

export function integrationScreenshotSrc(screenshot: IntegrationScreenshot, locale: string): string {
  return screenshot.src.replace('{locale}', locale === 'en' ? 'en' : 'de');
}
