'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { CashPolicyNotice } from '@/components/shared/cash-policy-notice';
import { usePermissions } from '@/hooks/use-permissions';
import { Link } from '@/i18n/routing';
import { cashNoticeKind, cashNoticeStorageKey } from '@/lib/cash-policy';
import { useAuthStore } from '@/stores/auth-store';

/** Wo die Einstellung liegt (Einstellungen → Organisation → Zahlungen). */
export const PAYMENT_SETTINGS_HREF = '/settings?tab=org-payments';

/**
 * Länderhinweis zu Bargeld im Dashboard (einmal, wegklickbar): Bitte um das
 * Land, TSE-Hinweis für Bestandsorganisationen in Deutschland, „Deutschland
 * ohne Bargeld“, Österreich, Schweiz oder andere Länder. Nur für Admins.
 * Weggeklickt wird je Nutzer, Organisation und Art im localStorage — ändert
 * sich die Art (z. B. nach dem Festlegen des Landes), erscheint der neue
 * Hinweis. Dauerhaft steht er in Einstellungen → Organisation → Zahlungen.
 */
export function CashPolicyHint() {
  const t = useTranslations('cashPolicy');
  const user = useAuthStore((state) => state.user);
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const { isAdmin } = usePermissions();
  const organization = currentOrganization?.organization;
  const organizationId = currentOrganization?.organizationId ?? '';
  const kind = cashNoticeKind(organization);
  const key = user && organizationId && kind ? cashNoticeStorageKey(user.id, organizationId, kind) : null;

  // Erst nach dem Laden lesen: auf dem Server gibt es kein localStorage, und
  // ein kurz aufblitzender Hinweis wäre schlimmer als ein kurz fehlender.
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    if (!key) return;
    try {
      setDismissed(window.localStorage.getItem(key) === '1');
    } catch {
      setDismissed(false);
    }
  }, [key]);

  // Die Bitte um das Land lässt sich nicht wegklicken: ohne Land fehlt die
  // Grundlage für alle anderen Hinweise.
  const dismissible = kind !== 'set_country';
  if (!key || !isAdmin || (dismissible && dismissed)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(key, '1');
    } catch {
      // Ohne Speicher bleibt er nur für diese Sitzung weg.
    }
  };

  return (
    <CashPolicyNotice
      organization={organization}
      isAdmin={isAdmin}
      kind={kind}
      onDismiss={dismissible ? dismiss : undefined}
      action={
        <Link href={PAYMENT_SETTINGS_HREF} className="cash-tse-notice__link">
          {t('settingsLink')}
        </Link>
      }
    />
  );
}
