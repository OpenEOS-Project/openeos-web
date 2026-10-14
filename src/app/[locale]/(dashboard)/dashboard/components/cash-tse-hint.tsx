'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { CashTseNotice } from '@/components/shared/cash-tse-notice';
import { usePermissions } from '@/hooks/use-permissions';
import { Link } from '@/i18n/routing';
import { isCashlessMode } from '@/lib/cashless';
import { useAuthStore } from '@/stores/auth-store';

/** Wo die Einstellung liegt (Einstellungen → Organisation → Zahlungen). */
export const PAYMENT_SETTINGS_HREF = '/settings?tab=org-payments';

const storageKey = (userId: string, organizationId: string) =>
  `openeos-cash-tse-hint-dismissed:${userId}:${organizationId}`;

/**
 * Einmaliger Hinweis „Bargeld und TSE“ im Dashboard, solange die
 * Organisation Bargeld annimmt. Nur für Admins (nur sie können den
 * bargeldlosen Modus einschalten). Weggeklickt wird je Nutzer und
 * Organisation im localStorage — der Hinweis steht ohnehin dauerhaft in
 * den Zahlungseinstellungen.
 */
export function CashTseHint() {
  const t = useTranslations('cashTse');
  const user = useAuthStore((state) => state.user);
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const { isAdmin } = usePermissions();
  const organizationId = currentOrganization?.organizationId ?? '';
  const key = user && organizationId ? storageKey(user.id, organizationId) : null;

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

  if (!key || !isAdmin || dismissed || isCashlessMode(currentOrganization?.organization?.settings)) {
    return null;
  }

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(key, '1');
    } catch {
      // Ohne Speicher bleibt er nur für diese Sitzung weg.
    }
  };

  return (
    <CashTseNotice
      onDismiss={dismiss}
      action={
        <Link href={PAYMENT_SETTINGS_HREF} className="cash-tse-notice__link">
          {t('settingsLink')}
        </Link>
      }
    />
  );
}
