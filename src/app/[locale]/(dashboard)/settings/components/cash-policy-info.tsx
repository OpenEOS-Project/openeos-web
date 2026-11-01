'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { CashPolicyNotice } from '@/components/shared/cash-policy-notice';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { organizationsApi } from '@/lib/api-client';
import { effectiveCashPolicy } from '@/lib/cash-policy';
import { countryName } from '@/lib/countries';
import type { CashPolicyChange, Organization } from '@/types/organization';

interface CashPolicyInfoProps {
  organization: Organization | undefined;
  isAdmin: boolean;
}

/**
 * Land und Bargeld-Regel (Einstellungen → Organisation → Zahlungen):
 * Land, wirksame Regel, der dauerhafte Länderhinweis und der Verlauf
 * (Land festgelegt, Wechsel, Änderungen durch den Support).
 */
export function CashPolicyInfo({ organization, isAdmin }: CashPolicyInfoProps) {
  const t = useTranslations('cashPolicy.info');
  const locale = useLocale();
  const { formatDateTime } = useLocaleFormat();
  const organizationId = organization?.id ?? '';

  const state = useQuery({
    queryKey: ['cash-policy', organizationId],
    queryFn: async () => (await organizationsApi.getCashPolicy(organizationId)).data,
    enabled: !!organizationId,
  });
  const history = state.data?.history ?? [];

  if (!organization) return null;

  const country = organization.country ?? null;
  const policy = effectiveCashPolicy(organization);
  const policyLabel = organization.cashPolicyLegacy
    ? t('policy.legacy')
    : policy === 'blocked_de_no_tse'
      ? t('policy.blocked')
      : t('policy.allowed');

  const entryLabel = (entry: CashPolicyChange) => {
    if (entry.kind === 'country') {
      return entry.fromValue
        ? t('history.countryChanged', {
            from: countryName(entry.fromValue, locale),
            to: countryName(entry.toValue, locale),
          })
        : t('history.countrySet', { country: countryName(entry.toValue, locale) });
    }
    return entry.toValue === 'legacy' ? t('history.legacyRestored') : t('history.switched');
  };

  return (
    <section className="cash-policy-info" aria-label={t('title')} data-testid="cash-policy-info">
      <div className="cash-policy-info__head">
        <span className="cash-policy-info__label">{t('country')}</span>
        <b className="cash-policy-info__value">{country ? countryName(country, locale) : t('noCountry')}</b>
        {country && <span className="operating-mode__since">{t('countryLocked')}</span>}
      </div>
      <div className="cash-policy-info__head">
        <span className="cash-policy-info__label">{t('policyLabel')}</span>
        <b className="cash-policy-info__value">{policyLabel}</b>
      </div>

      <CashPolicyNotice organization={organization} isAdmin={isAdmin} />

      {history.length > 0 && (
        <div className="cashless-history">
          <span className="cashless-history__title">{t('history.title')}</span>
          <ul>
            {history.map((entry) => (
              <li key={entry.id}>
                <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                <span>
                  {entryLabel(entry)}
                  {entry.changedByName ? ` · ${entry.changedByName}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
