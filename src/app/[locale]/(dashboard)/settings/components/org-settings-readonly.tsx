'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Icon } from '@openeos/ui';

/**
 * Nur-Lesen für Mitglieder ohne Admin-Recht in den Organisationsreitern
 * (Allgemein, Kontakt, Steuerangaben, Rechtliche Angaben).
 *
 * Speichern darf dort nur ein Admin (PATCH /organizations/:id). Bisher sahen
 * Mitglieder dieselben Formulare und bekamen erst beim Speichern einen
 * Fehler. Jetzt: Hinweis oben, Felder gesperrt, kein Speichern-Knopf — wie
 * bei Betriebsart, Assistent und Benachrichtigungen.
 */
export function OrgReadOnlyNotice() {
  const t = useTranslations('settings');
  return (
    <div style={{ marginBottom: 16 }} data-testid="org-readonly-notice">
      <Banner tone="info" icon={<Icon name="lock" />}>
        {t('organizationReadOnly')}
      </Banner>
    </div>
  );
}

/** Rahmenloses fieldset: `disabled` sperrt alle Felder darin auf einmal. */
export function OrgSettingsFieldset({
  disabled,
  gap = 16,
  children,
}: {
  disabled: boolean;
  gap?: number;
  children: ReactNode;
}) {
  return (
    <fieldset
      disabled={disabled}
      data-readonly={disabled || undefined}
      style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap }}
    >
      {children}
    </fieldset>
  );
}
