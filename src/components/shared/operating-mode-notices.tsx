'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '@openeos/ui';

import { CountrySelect } from '@/components/shared/country-select';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { organizationsApi } from '@/lib/api-client';
import { countryName } from '@/lib/countries';
import {
  AT_RKSV_URL,
  countriesFaqUrl,
  operatingModeDocsUrl,
  tseFaqUrl,
  type CountryNoticeKind,
  type LegacyNoticeKind,
} from '@/lib/operating-mode';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Lädt die aktuelle Organisation neu (nach Land festlegen oder Wechsel der
 * Betriebsart), damit Dashboard, Einstellungen und Hinweise sofort den
 * neuen Stand zeigen.
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
    queryClient.invalidateQueries({ queryKey: ['operating-mode', current.organizationId] });
  }, [queryClient]);
}

/* ── Rahmen ────────────────────────────────────────────────────────── */

/**
 * Markup wie <Banner> aus @openeos/ui, aber mit <div> statt <p> um den
 * Inhalt: hier stehen Absätze, Listen und Formulare.
 */
export function NoticeBanner({
  tone,
  title,
  children,
  testId,
  onDismiss,
}: {
  tone: 'info' | 'warn';
  title: string;
  children: ReactNode;
  testId?: string;
  onDismiss?: () => void;
}) {
  const t = useTranslations('operatingMode');
  return (
    <div
      className={['mode-notice', onDismiss ? 'mode-notice--dismissible' : ''].filter(Boolean).join(' ')}
      data-testid={testId}
    >
      <div className={`oe-banner oe-banner--${tone}`} role="status">
        <span className="oe-banner__ico">
          <Icon name={tone === 'warn' ? 'alert' : 'info'} />
        </span>
        <div className="mode-notice__content">
          <b>{title}</b>
          {children}
        </div>
      </div>
      {onDismiss && (
        <button type="button" className="mode-notice__dismiss" onClick={onDismiss} aria-label={t('dismiss')}>
          <Icon name="x" />
        </button>
      )}
    </div>
  );
}

/* ── Länderhinweise ────────────────────────────────────────────────── */

/**
 * Länderhinweis (neutral, immer „keine Steuerberatung“): Deutschland (TSE),
 * Österreich (RKSV), Schweiz, alle anderen Länder.
 */
export function CountryNotice({ kind }: { kind: CountryNoticeKind }) {
  const t = useTranslations('operatingMode.countryNotice');
  const locale = useLocale();
  const link = (href: string, label: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="notice-link">
      {label}
    </a>
  );
  const docs = link(operatingModeDocsUrl(locale), t('docsLink'));
  const extra =
    kind === 'de'
      ? link(tseFaqUrl(locale), t('faqLink'))
      : kind === 'at'
        ? link(AT_RKSV_URL, t('at.sourceLink'))
        : kind === 'other'
          ? link(countriesFaqUrl(locale), t('faqLink'))
          : null;

  return (
    <NoticeBanner tone="info" title={t(`${kind}.title`)} testId={`country-notice-${kind}`}>
      <p className="mode-notice__p">{t(`${kind}.text`)}</p>
      <p className="mode-notice__p mode-notice__muted">
        {t('noTaxAdvice')} {docs}
        {extra ? <> · {extra}</> : null}
      </p>
    </NoticeBanner>
  );
}

/* ── Bestand ───────────────────────────────────────────────────────── */

/**
 * Bestand („Alle Funktionen (Bestand)“): in Deutschland oder ohne Land der
 * deutliche Hinweis auf die TSE-Pflicht mit der Bitte um Land und
 * Betriebsart, sonst die sanfte Bitte, die Betriebsart zu bestätigen. Kein
 * automatischer Wechsel.
 */
export function LegacyNotice({
  kind,
  hasCountry,
  isAdmin,
  action,
  onDismiss,
}: {
  kind: LegacyNoticeKind;
  hasCountry: boolean;
  isAdmin: boolean;
  /** z. B. Link zu den Einstellungen (Dashboard). */
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  const t = useTranslations('operatingMode.legacy');
  const locale = useLocale();

  if (kind === 'confirm') {
    return (
      <NoticeBanner tone="info" title={t('confirm.title')} testId="legacy-notice-confirm" onDismiss={onDismiss}>
        <p className="mode-notice__p">{t('confirm.text')}</p>
        {!isAdmin && <p className="mode-notice__p mode-notice__muted">{t('adminOnly')}</p>}
        {action ? <p className="mode-notice__p">{action}</p> : null}
      </NoticeBanner>
    );
  }

  return (
    <NoticeBanner tone="warn" title={t('de.title')} testId="legacy-notice-de" onDismiss={onDismiss}>
      <p className="mode-notice__p">{t('de.text')}</p>
      {!hasCountry && <p className="mode-notice__p">{t('de.noCountry')}</p>}
      {!isAdmin && <p className="mode-notice__p mode-notice__muted">{t('adminOnly')}</p>}
      <p className="mode-notice__p mode-notice__muted">
        {t('noTaxAdvice')}{' '}
        <a href={tseFaqUrl(locale)} target="_blank" rel="noopener noreferrer" className="notice-link">
          {t('faqLink')}
        </a>
        {action ? <> · {action}</> : null}
      </p>
    </NoticeBanner>
  );
}

/* ── Land festlegen (einmal) ───────────────────────────────────────── */

/** Bitte um das Land mit Formular (Admins) — einmal selbst, danach nur der Support. */
export function SetCountryNotice({ isAdmin, action }: { isAdmin: boolean; action?: ReactNode }) {
  const t = useTranslations('operatingMode.setCountry');
  return (
    <NoticeBanner tone="warn" title={t('title')} testId="set-country-notice">
      <p className="mode-notice__p">{t('text')}</p>
      {isAdmin ? <SetCountryForm /> : <p className="mode-notice__p mode-notice__muted">{t('adminOnly')}</p>}
      {action ? <p className="mode-notice__p">{action}</p> : null}
    </NoticeBanner>
  );
}

function SetCountryForm() {
  const t = useTranslations('operatingMode.setCountry');
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
    <div className="mode-notice__form">
      <label className="auth-field mode-notice__field">
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

/* ── Rückfrage ─────────────────────────────────────────────────────── */

export function ConfirmDialog({
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
        <div className="modal__body mode-dialog" data-testid={id}>
          {children}
        </div>
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
