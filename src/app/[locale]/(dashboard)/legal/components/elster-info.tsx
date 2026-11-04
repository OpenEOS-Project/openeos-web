'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, Info, Landmark, TriangleAlert } from 'lucide-react';

import { DetailPageHead } from '@/components/shared/detail-page-head';
import { Link } from '@/i18n/routing';
import { useElsterInfo } from '@/hooks/use-legal';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useAuthStore } from '@/stores/auth-store';
import type { ElsterTseUnit } from '@/types/legal';

import { CopyValue } from './copy-value';

import '@/styles/legal.css';

const ELSTER_URL = 'https://www.elster.de/eportal/start';

/**
 * Angaben für die Mitteilung elektronischer Aufzeichnungssysteme an das
 * Finanzamt (§ 146a Abs. 4 AO, über ELSTER). Die Werte kommen fertig von
 * der API — hier wird nur angezeigt und kopiert.
 */
export function ElsterInfoView() {
  const t = useTranslations('legal.elster');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { formatDate } = useLocaleFormat();
  const organizationId = useAuthStore((s) => s.currentOrganization?.organizationId);
  const { data, isLoading, error, refetch } = useElsterInfo(organizationId);

  const head = (
    <DetailPageHead
      backHref="/legal"
      backLabel={t('back')}
      icon={<Landmark />}
      title={t('title')}
      meta={t('subtitle')}
    />
  );

  if (isLoading || !organizationId) {
    return (
      <div className="legal-page">
        {head}
        <div className="app-card legal-card__text">{tCommon('loading')}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="legal-page">
        {head}
        <div className="app-card">
          <p className="auth-form__error">{apiErrorMessage(error, t('loadFailed'))}</p>
          <button type="button" className="btn btn--ghost" onClick={() => void refetch()}>
            {tCommon('retry')}
          </button>
        </div>
      </div>
    );
  }

  const { software, register, location, taxNumber, vatId, tse } = data;
  const address = [location.street, [location.zip, location.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const taxMissing = !taxNumber && !vatId;

  return (
    <div className="legal-page">
      {head}

      <section className="app-card legal-intro">
        <p>{t('intro')}</p>
        <p>{t('introDeadline')}</p>
        <p>
          <a href={ELSTER_URL} target="_blank" rel="noopener noreferrer">
            {t('elsterLink')}
            <ExternalLink aria-hidden="true" />
          </a>
        </p>
      </section>

      {(!location.complete || taxMissing) && (
        <div className="legal-warning" role="status" data-testid="elster-incomplete">
          <p className="legal-warning__title">
            <TriangleAlert aria-hidden="true" />
            {t('incompleteTitle')}
          </p>
          <p className="legal-warning__text">{t('incompleteText')}</p>
          <p className="legal-warning__text legal-warning__links">
            {!location.complete && (
              <Link href="/settings?tab=org-contact">{t('fixAddress')}</Link>
            )}
            {taxMissing && <Link href="/settings?tab=org-tax">{t('fixTax')}</Link>}
          </p>
        </div>
      )}

      <section className="app-card" aria-labelledby="elster-system-title">
        <h2 id="elster-system-title" className="legal-card__title">
          {t('systemTitle')}
        </h2>
        <dl className="legal-facts">
          <Fact label={t('softwareName')}>
            <CopyValue value={software.name} />
          </Fact>
          <Fact label={t('manufacturer')}>
            <CopyValue value={software.manufacturer} />
          </Fact>
          <Fact label={t('softwareVersion')}>
            <CopyValue value={software.version} mono />
          </Fact>
          <Fact label={t('systemKind')}>
            <CopyValue value={register.kind} />
          </Fact>
          <Fact label={t('registerSerial')}>
            <CopyValue value={register.serialNumber} mono />
          </Fact>
        </dl>
      </section>

      <section className="app-card" aria-labelledby="elster-location-title">
        <h2 id="elster-location-title" className="legal-card__title">
          {t('locationTitle')}
        </h2>
        <dl className="legal-facts">
          <Fact label={t('locationName')}>
            <CopyValue value={location.name} />
          </Fact>
          <Fact label={t('locationAddress')}>
            <CopyValue value={address} />
          </Fact>
          <Fact label={t('taxNumber')}>
            <CopyValue value={taxNumber} mono />
          </Fact>
          {vatId && (
            <Fact label={t('vatId')}>
              <CopyValue value={vatId} mono />
            </Fact>
          )}
        </dl>
      </section>

      <section className="app-card" aria-labelledby="elster-tse-title" data-testid="elster-tse">
        <h2 id="elster-tse-title" className="legal-card__title">
          {t('tseTitle')}
        </h2>
        {tse.length === 0 ? (
          <p className="legal-hint">
            <Info aria-hidden="true" />
            <span>{t('noTse')}</span>
          </p>
        ) : (
          <>
            <p className="legal-card__text">{t('tseText')}</p>
            <div className="legal-tse-list">
              {tse.map((unit, index) => (
                <TseCard key={`${unit.clientId}-${unit.serialNumber ?? index}`} unit={unit} formatDate={formatDate} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function TseCard({ unit, formatDate }: { unit: ElsterTseUnit; formatDate: (d: string | null) => string }) {
  const t = useTranslations('legal.elster');
  const tone =
    unit.state === 'active' ? 'badge--success' : unit.state === 'failed' ? 'badge--error' : 'badge--neutral';
  return (
    <article className="legal-tse">
      <div className="legal-tse__head">
        <span className="legal-tse__kind">{unit.kind}</span>
        <span className={`badge ${tone}`}>{t(`tseState.${unit.state}`)}</span>
      </div>
      <dl className="legal-facts">
        <Fact label={t('tseSerial')}>
          <CopyValue value={unit.serialNumber} mono />
        </Fact>
        <Fact label={t('tseCertification')}>
          <CopyValue value={unit.certificationId} mono />
        </Fact>
        <Fact label={t('tseCertificateUntil')}>
          <CopyValue value={unit.certificateExpiresAt ? formatDate(unit.certificateExpiresAt) : null} />
        </Fact>
        <Fact label={t('tseKind')}>
          <CopyValue value={unit.kind} />
        </Fact>
        <Fact label={t('tseActivated')}>
          <CopyValue value={unit.activatedAt ? formatDate(unit.activatedAt) : null} />
        </Fact>
        <Fact label={t('tseDeactivated')}>
          <CopyValue value={unit.deactivatedAt ? formatDate(unit.deactivatedAt) : null} />
        </Fact>
      </dl>
    </article>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="legal-facts__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
