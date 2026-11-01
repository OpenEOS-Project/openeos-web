'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '@openeos/ui';

import { useDeployment } from '@/components/providers/setup-provider';
import { CountrySelect } from '@/components/shared/country-select';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { organizationsApi } from '@/lib/api-client';
import {
  AT_RKSV_URL,
  cashNoticeKind,
  cashPolicyDocsUrl,
  countriesFaqUrl,
  type CashNoticeKind,
} from '@/lib/cash-policy';
import { tseFaqUrl } from '@/lib/cashless';
import { countryName } from '@/lib/countries';
import { useAuthStore } from '@/stores/auth-store';
import type { Organization } from '@/types/organization';

/**
 * Lädt die aktuelle Organisation neu (nach Land festlegen / Wechsel), damit
 * Dashboard, Einstellungen und Hinweise sofort den neuen Stand zeigen.
 */
export function useRefreshCurrentOrganization() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    const current = useAuthStore.getState().currentOrganization;
    if (!current) return;
    const response = await organizationsApi.get(current.organizationId);
    const latest = useAuthStore.getState().currentOrganization;
    if (latest?.organizationId === current.organizationId) {
      useAuthStore.getState().setCurrentOrganization({ ...latest, organization: response.data });
    }
    queryClient.invalidateQueries({ queryKey: ['organizations'] });
    queryClient.invalidateQueries({ queryKey: ['cash-policy', current.organizationId] });
    queryClient.invalidateQueries({ queryKey: ['cashless-history', current.organizationId] });
  }, [queryClient]);
}

/** PDF der Herstellerbescheinigung „Deutschland ohne Bargeld“ speichern. */
export async function downloadCashPolicyCertificate(organizationId: string): Promise<void> {
  const blob = await organizationsApi.cashPolicyCertificate(organizationId);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `openeos-bescheinigung-ohne-bargeld-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface CashPolicyNoticeProps {
  organization: Organization | undefined;
  isAdmin: boolean;
  /** Wegklicken (Dashboard); in den Einstellungen dauerhaft sichtbar. */
  onDismiss?: () => void;
  /** Zusätzlicher Link, z. B. zu den Zahlungseinstellungen. */
  action?: ReactNode;
  /** Art vorgeben (sonst aus der Organisation). */
  kind?: CashNoticeKind | null;
}

/**
 * Länderhinweis zu Bargeld und Kassenregeln (neutral, „keine
 * Steuerberatung“). Je nach Land und Bestandsschutz:
 * - kein Land: Bitte um das Land (einmal selbst festlegen),
 * - Deutschland, Bestand: TSE-Pflicht und drei Wege (so lassen,
 *   freiwillig wechseln, auf die TSE warten),
 * - „Deutschland ohne Bargeld“: was das heißt, Bescheinigung,
 * - Österreich (RKSV), Schweiz, alle anderen Länder: kurzer Hinweis.
 */
export function CashPolicyNotice({ organization, isAdmin, onDismiss, action, kind: forcedKind }: CashPolicyNoticeProps) {
  const t = useTranslations('cashPolicy');
  const locale = useLocale();
  const kind = forcedKind === undefined ? cashNoticeKind(organization) : forcedKind;
  if (!organization || !kind) return null;

  const docsLink = (
    <a href={cashPolicyDocsUrl(locale)} target="_blank" rel="noopener noreferrer" className="cash-tse-notice__link">
      {t('docsLink')}
    </a>
  );

  let body: ReactNode;
  let title: string;
  let tone: 'info' | 'warn' = 'info';
  switch (kind) {
    case 'set_country':
      title = t('setCountry.title');
      tone = 'warn';
      body = (
        <>
          <p className="cash-policy__p">{t('setCountry.text')}</p>
          {isAdmin ? <SetCountryForm /> : <p className="cash-policy__p cash-policy__muted">{t('setCountry.adminOnly')}</p>}
        </>
      );
      break;
    case 'de_legacy':
      title = t('deLegacy.title');
      tone = 'warn';
      body = <GermanLegacyBody isAdmin={isAdmin} docsLink={docsLink} />;
      break;
    case 'de_blocked':
      title = t('deBlocked.title');
      body = <GermanBlockedBody organizationId={organization.id} isAdmin={isAdmin} docsLink={docsLink} />;
      break;
    case 'at':
      title = t('at.title');
      body = (
        <>
          <p className="cash-policy__p">{t('at.text')}</p>
          <p className="cash-policy__p cash-policy__muted">
            {t('noTaxAdvice')} {docsLink} ·{' '}
            <a href={AT_RKSV_URL} target="_blank" rel="noopener noreferrer" className="cash-tse-notice__link">
              {t('at.sourceLink')}
            </a>
          </p>
        </>
      );
      break;
    case 'ch':
      title = t('ch.title');
      body = (
        <>
          <p className="cash-policy__p">{t('ch.text')}</p>
          <p className="cash-policy__p cash-policy__muted">
            {t('noTaxAdvice')} {docsLink}
          </p>
        </>
      );
      break;
    case 'other':
      title = t('other.title');
      body = (
        <>
          <p className="cash-policy__p">{t('other.text')}</p>
          <p className="cash-policy__p cash-policy__muted">
            {t('noTaxAdvice')} {docsLink} ·{' '}
            <a href={countriesFaqUrl(locale)} target="_blank" rel="noopener noreferrer" className="cash-tse-notice__link">
              {t('faqLink')}
            </a>
          </p>
        </>
      );
      break;
  }

  return (
    <div
      className={['cash-tse-notice', 'cash-policy', onDismiss ? 'cash-tse-notice--dismissible' : '']
        .filter(Boolean)
        .join(' ')}
      data-testid={`cash-policy-notice-${kind}`}
    >
      {/* Markup wie <Banner> aus @openeos/ui, aber mit <div> statt <p> um
          den Inhalt: hier stehen Absätze, Listen und Formulare. */}
      <div className={`oe-banner oe-banner--${tone}`} role="status">
        <span className="oe-banner__ico">
          <Icon name={tone === 'warn' ? 'alert' : 'info'} />
        </span>
        <div className="cash-policy__content">
          <b>{title}</b>
          {body}
          {action ? <p className="cash-policy__p">{action}</p> : null}
        </div>
      </div>
      {onDismiss && (
        <button type="button" className="cash-tse-notice__dismiss" onClick={onDismiss} aria-label={t('dismiss')}>
          <Icon name="x" />
        </button>
      )}
    </div>
  );
}

/* ── Land festlegen (einmal) ───────────────────────────────────────── */

function SetCountryForm() {
  const t = useTranslations('cashPolicy.setCountry');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
  const refresh = useRefreshCurrentOrganization();
  const organizationId = useAuthStore((s) => s.currentOrganization?.organizationId ?? '');
  const [country, setCountry] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const save = async () => {
    setPending(true);
    try {
      await organizationsApi.setCountry(organizationId, country);
      await refresh();
      toast.success(t('saved', { country: countryName(country, locale) }));
      setConfirming(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, tCommon('error')));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="cash-policy__form">
      <label className="auth-field cash-policy__field">
        <span>{t('label')}</span>
        <CountrySelect value={country} onChange={setCountry} />
      </label>
      <button type="button" className="btn btn--primary" disabled={!country} onClick={() => setConfirming(true)}>
        {t('submit')}
      </button>
      {confirming && (
        <ConfirmDialog
          id="set-country-dialog"
          title={t('confirmTitle')}
          confirmLabel={t('confirm')}
          pending={pending}
          onConfirm={() => void save()}
          onCancel={() => setConfirming(false)}
        >
          <p>{t('confirmText', { country: countryName(country, locale) })}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

/* ── Deutschland, Bestand: drei Wege ───────────────────────────────── */

function GermanLegacyBody({ isAdmin, docsLink }: { isAdmin: boolean; docsLink: ReactNode }) {
  const t = useTranslations('cashPolicy.deLegacy');
  const tRoot = useTranslations('cashPolicy');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
  const refresh = useRefreshCurrentOrganization();
  const organizationId = useAuthStore((s) => s.currentOrganization?.organizationId ?? '');
  // Eigene Installation: der Verein betreibt das System selbst — einen
  // Wechsel mit Herstellerbescheinigung gibt es dort nicht.
  const selfHosted = useDeployment().mode === 'selfhosted';
  const [confirming, setConfirming] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!confirming) setUnderstood(false);
  }, [confirming]);

  const switchPolicy = async () => {
    setPending(true);
    try {
      await organizationsApi.switchCashPolicy(organizationId);
      await refresh();
      toast.success(t('switched'));
      setConfirming(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, tCommon('error')));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <p className="cash-policy__p">{t('text')}</p>
      <ol className="cash-policy__options">
        <li>
          <strong>{t('keep.title')}</strong> {t('keep.text')}
        </li>
        {!selfHosted && (
        <li>
          <strong>{t('switch.title')}</strong> {t('switch.text')}
          {isAdmin ? (
            <div>
              <button type="button" className="btn btn--secondary cash-policy__switch" onClick={() => setConfirming(true)}>
                {t('switch.button')}
              </button>
            </div>
          ) : (
            <span className="cash-policy__muted"> {t('switch.adminOnly')}</span>
          )}
        </li>
        )}
        <li>
          <strong>{t('wait.title')}</strong> {t('wait.text')}
        </li>
      </ol>
      <p className="cash-policy__p cash-policy__muted">
        {tRoot('noTaxAdvice')} {docsLink} ·{' '}
        <a href={tseFaqUrl(locale)} target="_blank" rel="noopener noreferrer" className="cash-tse-notice__link">
          {tRoot('faqLink')}
        </a>
      </p>
      {confirming && (
        <ConfirmDialog
          id="switch-cash-policy-dialog"
          title={t('confirmTitle')}
          confirmLabel={t('confirm')}
          danger
          pending={pending}
          confirmDisabled={!understood}
          onConfirm={() => void switchPolicy()}
          onCancel={() => setConfirming(false)}
        >
          <p>{t('confirmText')}</p>
          <label className="cash-policy__check">
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
            <span>{t('confirmCheck')}</span>
          </label>
        </ConfirmDialog>
      )}
    </>
  );
}

/* ── Deutschland ohne Bargeld ──────────────────────────────────────── */

function GermanBlockedBody({
  organizationId,
  isAdmin,
  docsLink,
}: {
  organizationId: string;
  isAdmin: boolean;
  docsLink: ReactNode;
}) {
  const t = useTranslations('cashPolicy.deBlocked');
  const tRoot = useTranslations('cashPolicy');
  const apiErrorMessage = useApiErrorMessage();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadCashPolicyCertificate(organizationId);
    } catch (error) {
      toast.error(apiErrorMessage(error, t('certificateFailed')));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <p className="cash-policy__p">{t('text')}</p>
      <p className="cash-policy__p cash-policy__muted">
        {tRoot('noTaxAdvice')} {docsLink}
      </p>
      {isAdmin && (
        <div>
          <button type="button" className="btn btn--secondary cash-policy__switch" onClick={() => void download()} disabled={downloading}>
            <Icon name="download" />
            {t('certificate')}
          </button>
        </div>
      )}
    </>
  );
}

/* ── Rückfrage ─────────────────────────────────────────────────────── */

function ConfirmDialog({
  id,
  title,
  confirmLabel,
  children,
  pending,
  danger,
  confirmDisabled,
  onConfirm,
  onCancel,
}: {
  id: string;
  title: string;
  confirmLabel: string;
  children: ReactNode;
  pending: boolean;
  danger?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const tCommon = useTranslations('common');
  const close = pending ? () => {} : onCancel;

  useEffect(() => {
    if (pending) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pending, onCancel]);

  return (
    <div className="modal__overlay" onClick={close}>
      <ModalPanel titleId={`${id}-title`} className="modal__panel--sm">
        <div className="modal__head">
          <h2 id={`${id}-title`}>{title}</h2>
          <DialogCloseButton onClick={close} />
        </div>
        <div className="modal__body cash-policy__dialog">{children}</div>
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={pending}>
            {tCommon('cancel')}
          </button>
          <button
            type="button"
            className={danger ? 'btn btn--danger' : 'btn btn--primary'}
            onClick={onConfirm}
            disabled={pending || confirmDisabled}
          >
            {pending ? tCommon('saving') : confirmLabel}
          </button>
        </div>
      </ModalPanel>
    </div>
  );
}
