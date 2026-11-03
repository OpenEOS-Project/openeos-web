'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Banner, Icon } from '@openeos/ui';

import { useDeployment } from '@/components/providers/setup-provider';
import {
  ConfirmDialog,
  CountryNotice,
  LegacyNotice,
  SetCountryNotice,
  useRefreshCurrentOrganization,
} from '@/components/shared/operating-mode-notices';
import { toast } from '@/components/shared/toast';
import { isIntegrationEnabled } from '@/config/integrations';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useOrganization } from '@/hooks/use-organizations';
import { usePermissions } from '@/hooks/use-permissions';
import { Link } from '@/i18n/routing';
import { organizationsApi } from '@/lib/api-client';
import { countryName } from '@/lib/countries';
import {
  canSwitchTo,
  certificateAvailable,
  countryNoticeKind,
  getOperatingMode,
  legacyNoticeKind,
  operatingModeDocsUrl,
  operatingModeLabelValue,
  operatingModeOptions,
  resolveOperatingMode,
  switchIsOneWay,
  type OperatingMode,
  type OperatingModeOption,
  type OperatingModeOrg,
} from '@/lib/operating-mode';
import { useAuthStore } from '@/stores/auth-store';
import type { OrganizationTseSummary } from '@/types/tse';
import type { OperatingModeState } from '@/types/organization';
import { SettingsSectionHead } from './settings-section-head';

/** Was sich je Betriebsart ändert (Reihenfolge der Punkte in der Rückfrage). */
const EFFECTS: Record<OperatingMode, string[]> = {
  orders_only: ['pos', 'money', 'receipts', 'shop', 'extras', 'reports'],
  cashless: ['pos', 'cash', 'refunds', 'pfand', 'rest'],
  full: ['pos', 'pfand', 'rest'],
};

/**
 * Einstellungen → Organisation → Betriebsart: die eine Einstellung, wie die
 * Organisation mit Geld umgeht („Nur Bons“, „Bargeldlos“, „Alle
 * Funktionen“). Aktuelle Betriebsart mit Datum, drei Auswahlkarten (was
 * wählbar ist, sagt die API), Rückfrage mit den Folgen je Ziel, Bestand-
 * und Länderhinweise, Bescheinigung (Deutschland) und Verlauf. Wechseln
 * dürfen nur Admins; die Kassen stellen sich per Socket sofort um.
 */
export function OperatingModeSection() {
  const t = useTranslations('operatingMode');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
  const { formatDate, formatDateTime } = useLocaleFormat();
  const { isAdmin } = usePermissions();
  const selfHosted = useDeployment().mode === 'selfhosted';
  const refresh = useRefreshCurrentOrganization();
  const currentOrganization = useAuthStore((s) => s.currentOrganization);
  const organization = currentOrganization?.organization;
  const organizationId = currentOrganization?.organizationId ?? '';

  // Cloud-TSE (nur GET /organizations/:id liefert `tse`): Pille an „Alle
  // Funktionen“ in Deutschland, mit Link zur Integrationsseite.
  const { data: organizationDetail } = useOrganization(organizationId);
  const tse = organizationDetail?.tse ?? null;

  const state = useQuery({
    queryKey: ['operating-mode', organizationId],
    queryFn: async () => (await organizationsApi.getOperatingMode(organizationId)).data,
    enabled: !!organizationId,
  });

  // Stand der API, solange er da ist; sonst die Organisation aus dem Store.
  const org: OperatingModeOrg | undefined = state.data ?? organization;
  const view = resolveOperatingMode(org);
  const options = operatingModeOptions(org, state.data?.options);
  const current = getOperatingMode(org);

  const [selected, setSelected] = useState<OperatingMode | null>(null);
  const [confirming, setConfirming] = useState<OperatingMode | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [pending, setPending] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Nach einem Wechsel (auch von einem anderen Gerät) die Auswahl zurücksetzen.
  useEffect(() => {
    setSelected(null);
  }, [current, view.legacy]);
  useEffect(() => {
    if (!confirming) setUnderstood(false);
  }, [confirming]);

  if (!organization) return null;

  // Eigene Installation: der Verein betreibt den Server selbst und startet
  // mit „Alle Funktionen (Bestand)“ — dort keine Bitte um einen Wechsel.
  const legacyKind = selfHosted ? null : legacyNoticeKind(org);
  const countryKind = countryNoticeKind(org);
  const showCertificate = !selfHosted && (state.data?.certificateAvailable ?? certificateAvailable(org));
  const sumupEnabled = isIntegrationEnabled(organization.settings, 'sumup');
  const history = state.data?.history ?? [];
  const target = selected;

  const save = async (mode: OperatingMode) => {
    setPending(true);
    try {
      const response = await organizationsApi.setOperatingMode(organizationId, mode);
      await refresh();
      toast.success(t('section.saved', { mode: t(`names.${operatingModeLabelValue(response.data)}`) }));
      setConfirming(null);
      setSelected(null);
    } catch (error) {
      toast.error(apiErrorMessage(error, tCommon('error')));
    } finally {
      setPending(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      const blob = await organizationsApi.operatingModeCertificate(organizationId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openeos-herstellerbescheinigung-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(apiErrorMessage(error, t('certificate.failed')));
    } finally {
      setDownloading(false);
    }
  };

  const availability = (option: OperatingModeOption) => {
    if (option.mode === current) return view.legacy ? t('availability.legacy') : t('availability.current');
    if (option.available) return t('availability.available');
    return t(`availability.${option.unavailableReason ?? 'tse_required'}`);
  };

  const oneWay = confirming ? switchIsOneWay(org, confirming) : false;
  const confirmsLegacy = confirming !== null && confirming === current && view.legacy;

  return (
    <div className="app-card" data-testid="operating-mode-section">
      <SettingsSectionHead icon="sliders-horizontal" title={t('section.title')} description={t('section.description')} />

      <div className="mode-section">
        {!view.country && <SetCountryNotice isAdmin={isAdmin} />}
        {legacyKind && <LegacyNotice kind={legacyKind} hasCountry={!!view.country} isAdmin={isAdmin} />}

        <div className="mode-section__current">
          <span className="mode-section__label">{t('section.current')}</span>
          <b className="mode-section__value" data-testid="operating-mode-current">
            {t(`names.${operatingModeLabelValue(org)}`)}
          </b>
          {view.since && <span className="mode-section__since">{t('section.since', { date: formatDate(view.since) })}</span>}
        </div>

        {view.cashBlockedWithoutTse && (
          <Banner tone="warn" icon={<Icon name="alert" />} title={t('section.cashBlocked.title')}>
            {t('section.cashBlocked.text')}
          </Banner>
        )}

        <fieldset className="mode-cards" disabled={!isAdmin || pending}>
          <legend className="mode-section__label">{t('section.choose')}</legend>
          {options.map((option) => {
            const isCurrent = option.mode === current;
            const selectable = isAdmin && canSwitchTo(org, option.mode, state.data?.options);
            const checked = (target ?? current) === option.mode;
            return (
              <label
                key={option.mode}
                className={[
                  'mode-card',
                  checked ? 'is-checked' : '',
                  isCurrent ? 'is-current' : '',
                  !option.available ? 'is-unavailable' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-testid={`operating-mode-option-${option.mode}`}
              >
                <input
                  type="radio"
                  name="operating-mode"
                  value={option.mode}
                  checked={checked}
                  disabled={!selectable && !isCurrent}
                  onChange={() => setSelected(isCurrent && !view.legacy ? null : option.mode)}
                />
                <span className="mode-card__body">
                  <span className="mode-card__head">
                    <b className="mode-card__name">{t(`names.${option.mode}`)}</b>
                    <span
                      className={[
                        'mode-card__badge',
                        isCurrent ? 'is-current' : option.available ? 'is-available' : 'is-unavailable',
                      ].join(' ')}
                    >
                      {availability(option)}
                    </span>
                  </span>
                  <span className="mode-card__text">{t(`descriptions.${option.mode}`)}</span>
                  {option.mode === 'full' && view.country === 'DE' && (
                    <>
                      <span className="mode-card__text mode-card__text--muted">{t('fullDeHint')}</span>
                      {!selfHosted || tse?.available ? (
                        <TseModeBadge tse={tse} tseActive={view.tseActive} isAdmin={isAdmin} />
                      ) : null}
                      <TseFollowsHint
                        setup={state.data?.tseSetup ?? null}
                        tseActive={view.tseActive}
                        unavailableReason={option.unavailableReason}
                        isAdmin={isAdmin}
                      />
                    </>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>

        {isAdmin ? (
          <div className="mode-section__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!target || pending || !canSwitchTo(org, target, state.data?.options)}
              onClick={() => target && setConfirming(target)}
              data-testid="operating-mode-switch"
            >
              {!target
                ? t('section.switchButtonEmpty')
                : target === current && view.legacy
                  ? t('section.confirmLegacyButton')
                  : t('section.switchButton', { mode: t(`names.${target}`) })}
            </button>
            <a href={operatingModeDocsUrl(locale)} target="_blank" rel="noopener noreferrer" className="notice-link">
              {t('section.docsLink')}
            </a>
          </div>
        ) : (
          <p className="mode-section__note">{t('section.adminOnly')}</p>
        )}

        {current === 'cashless' && !sumupEnabled && (
          <Banner tone="warn" icon={<Icon name="alert" />} title={t('section.noSumup.title')}>
            {t('section.noSumup.text')}{' '}
            <Link href="/integrations" className="notice-link">
              {t('section.noSumup.action')}
            </Link>
          </Banner>
        )}

        <div className="mode-section__current">
          <span className="mode-section__label">{t('section.country')}</span>
          <b className="mode-section__value">{view.country ? countryName(view.country, locale) : t('section.noCountry')}</b>
          {view.country && <span className="mode-section__since">{t('section.countryLocked')}</span>}
        </div>
        {countryKind && <CountryNotice kind={countryKind} />}

        {showCertificate && (
          <div className="mode-section__cert">
            <span className="mode-section__label">{t('certificate.title')}</span>
            <p className="mode-section__note">{isAdmin ? t('certificate.hint') : t('certificate.adminOnly')}</p>
            {isAdmin && (
              <button type="button" className="btn btn--secondary" onClick={() => void download()} disabled={downloading}>
                <Icon name="download" />
                {t('certificate.download')}
              </button>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="mode-history">
            <span className="mode-section__label">{t('history.title')}</span>
            <ul>
              {history.map((entry) => (
                <li key={entry.id}>
                  <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                  <span>
                    {entry.fromMode
                      ? t('history.entry', { from: t(`names.${entry.fromMode}`), to: t(`names.${entry.toMode}`) })
                      : t(`names.${entry.toMode}`)}
                    {entry.changedByName ? ` · ${entry.changedByName}` : ''}
                    {entry.reason ? ` · ${entry.reason}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          id="operating-mode-dialog"
          title={confirmsLegacy ? t('confirm.titleLegacy') : t(`confirm.title.${confirming}`)}
          confirmLabel={confirmsLegacy ? t('confirm.buttonLegacy') : oneWay ? t('confirm.buttonOneWay') : t('confirm.button')}
          danger={oneWay}
          pending={pending}
          confirmDisabled={oneWay && !understood}
          onConfirm={() => void save(confirming)}
          onCancel={() => setConfirming(null)}
        >
          {confirmsLegacy && <p>{t('confirm.legacyText')}</p>}
          <p>{t('confirm.intro')}</p>
          <ul className="mode-dialog__effects">
            {EFFECTS[confirming].map((key) => (
              <li key={key}>{t(`confirm.effects.${confirming}.${key}`)}</li>
            ))}
            {confirming === 'full' && (
              <li>{view.country === 'DE' ? t('confirm.effects.full.countryDe') : t('confirm.effects.full.countryOther')}</li>
            )}
            {confirming === 'full' && view.country === 'DE' && !view.tseActive && state.data?.tseSetup && (
              <li data-testid="operating-mode-confirm-tse">
                {t('tseFollows.confirm', { date: formatDate(state.data.tseSetup.scheduledFor) })}
              </li>
            )}
          </ul>
          {oneWay && (
            <>
              <Banner tone="warn" icon={<Icon name="alert" />}>
                {view.legacy ? t('confirm.oneWayLegacy') : t('confirm.oneWay')}
              </Banner>
              <label className="mode-dialog__check">
                <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
                <span>{t('confirm.oneWayCheck')}</span>
              </label>
            </>
          )}
          <p className="mode-dialog__muted">{t('confirm.logged')}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

/**
 * Zustand der Cloud-TSE an der Karte „Alle Funktionen“ (Deutschland) mit
 * Link: zur Integrationsseite, sonst in den Katalog zum Einschalten.
 */
function TseModeBadge({
  tse,
  tseActive,
  isAdmin,
}: {
  tse: OrganizationTseSummary | null;
  tseActive: boolean;
  isAdmin: boolean;
}) {
  const t = useTranslations('operatingMode.tseBadge');
  const active = tse ? tse.active : tseActive;
  const kind = active ? 'active' : tse?.state === 'creating' ? 'creating' : 'off';
  const badge = kind === 'active' ? 'badge badge--success' : kind === 'creating' ? 'badge badge--info' : 'badge badge--neutral';
  const enabled = tse?.integrationEnabled ?? false;
  return (
    <span className="mode-card__tse" data-testid="operating-mode-tse">
      <span className={badge}>
        <Icon name="shield" size={12} />
        {t(kind)}
      </span>
      {isAdmin && (
        <Link
          href={(enabled ? '/integrations/tse' : '/integrations') as never}
          className="notice-link"
          onClick={(event) => event.stopPropagation()}
        >
          {enabled ? t('link') : t('setup')}
        </Link>
      )}
    </span>
  );
}

/**
 * „Alle Funktionen“ in Deutschland ohne aktive TSE: mit bezahlter
 * Veranstaltung wählbar — die Cloud-TSE wird dann automatisch eingerichtet
 * (Datum). Ohne bezahlte Veranstaltung bleibt die Karte gesperrt, mit dem
 * Hinweis, zuerst eine Veranstaltung freizuschalten.
 */
function TseFollowsHint({
  setup,
  tseActive,
  unavailableReason,
  isAdmin,
}: {
  setup: OperatingModeState['tseSetup'] | null;
  tseActive: boolean;
  unavailableReason: OperatingModeOption['unavailableReason'];
  isAdmin: boolean;
}) {
  const t = useTranslations('operatingMode.tseFollows');
  const { formatDate } = useLocaleFormat();
  if (tseActive) return null;
  if (setup) {
    return (
      <span className="mode-card__text mode-card__text--muted" data-testid="operating-mode-tse-follows">
        <Icon name="clock" size={12} /> {t('scheduled', { date: formatDate(setup.scheduledFor), name: setup.eventName })}
        {setup.missing.length > 0 && <> {t('missing')}</>}
      </span>
    );
  }
  if (unavailableReason !== 'paid_event_required') return null;
  return (
    <span className="mode-card__text mode-card__text--muted" data-testid="operating-mode-tse-needs-event">
      {t('needsEvent')}{' '}
      {isAdmin && (
        <Link href="/events" className="notice-link" onClick={(event) => event.stopPropagation()}>
          {t('toEvents')}
        </Link>
      )}
    </span>
  );
}
