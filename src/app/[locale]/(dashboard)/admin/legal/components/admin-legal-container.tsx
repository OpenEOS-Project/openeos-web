'use client';

import { useMemo, useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import '@/styles/admin-legal.css';
import { Banner, Checkbox, Input, Textarea } from '@openeos/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ListError, ListLoading } from '@/components/shared/list-states';
import { ConfirmDialog } from '@/components/shared/operating-mode-notices';
import { toast } from '@/components/shared/toast';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';

import { legalApi } from '@/lib/legal-api';
import { formatLegalVersion } from '@/lib/legal-platform';

import type {
  LegalAnnouncement,
  LegalAnnouncementInput,
  LegalAnnouncementOverview,
  LegalAnnouncementPreview,
  LegalDocumentKey,
} from '@/types/legal';

const DOCUMENTS: LegalDocumentKey[] = ['agb', 'anlage1', 'avv', 'privacy', 'imprint'];
const CONTRACT: LegalDocumentKey[] = ['agb', 'anlage1', 'avv'];
const PATHS: Record<LegalDocumentKey, string> = {
  agb: 'agb',
  anlage1: 'leistungsbeschreibung',
  avv: 'avv',
  privacy: 'datenschutz',
  imprint: 'impressum',
};
const OVERVIEW_KEY = ['admin', 'legal-announcements'] as const;

interface FormState {
  documents: LegalDocumentKey[];
  version: string;
  summaryDe: string;
  summaryEn: string;
  shortNotice: boolean;
  explicitConsent: boolean;
}

const EMPTY: FormState = {
  documents: [],
  version: '',
  summaryDe: '',
  summaryEn: '',
  shortNotice: false,
  explicitConsent: false,
};

function toInput(form: FormState): LegalAnnouncementInput {
  const contract = form.documents.some((d) => CONTRACT.includes(d));
  return {
    documents: DOCUMENTS.filter((d) => form.documents.includes(d)),
    version: form.version,
    summaryDe: form.summaryDe,
    ...(form.summaryEn.trim() ? { summaryEn: form.summaryEn } : {}),
    shortNotice: contract && form.shortNotice,
    explicitConsent: contract && form.explicitConsent,
  };
}

/**
 * Neue Fassungen der Rechtstexte ankündigen (Super-Admin): Dokumente,
 * Datum des Inkrafttretens und Zusammenfassung eingeben, Vorschau der Mail
 * prüfen, ankündigen. Darunter alle Ankündigungen mit Versandstand.
 */
export function AdminLegalContainer() {
  const t = useTranslations('admin.legal');
  const query = useQuery({
    queryKey: OVERVIEW_KEY,
    queryFn: async () => (await legalApi.adminOverview()).data,
    // Solange Mails in der Warteschlange stehen, den Stand nachladen.
    refetchInterval: (q) =>
      q.state.data?.announcements.some((a) => a.stats.pending + a.stats.sending > 0) ? 5000 : false,
  });

  if (query.isLoading) return <ListLoading />;
  if (query.isError || !query.data) return <ListError onRetry={() => query.refetch()} />;
  const overview = query.data;

  return (
    <div className="admin-legal">
      {!overview.emailEnabled && (
        <Banner tone="warn" title={t('emailDisabled.title')}>
          {t('emailDisabled.text')}
        </Banner>
      )}
      <CurrentVersions overview={overview} />
      <AnnounceForm overview={overview} />
      <AnnouncementList announcements={overview.announcements} />
    </div>
  );
}

function CurrentVersions({ overview }: { overview: LegalAnnouncementOverview }) {
  const t = useTranslations('admin.legal');
  const locale = useLocale();
  return (
    <section className="app-card admin-legal__card" aria-labelledby="admin-legal-current">
      <div className="app-card__head">
        <h2 id="admin-legal-current" className="app-card__title">
          {t('current.title')}
        </h2>
      </div>
      <div className="app-card__body">
        <ul className="admin-legal__versions" data-testid="admin-legal-versions">
          {DOCUMENTS.map((d) => (
            <li key={d}>
              <span>{t(`documents.${d}`)}</span>
              <a
                href={`${overview.siteUrl}/${PATHS[d]}/${overview.versions[d]}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {formatLegalVersion(overview.versions[d], locale)}
              </a>
            </li>
          ))}
        </ul>
        <p className="admin-legal__muted">
          {t('current.baseline', { date: formatLegalVersion(overview.initialVersion, locale) })}
        </p>
      </div>
    </section>
  );
}

function AnnounceForm({ overview }: { overview: LegalAnnouncementOverview }) {
  const t = useTranslations('admin.legal');
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [preview, setPreview] = useState<{
    input: string;
    result: LegalAnnouncementPreview;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const input = useMemo(() => toInput(form), [form]);
  const inputKey = JSON.stringify(input);
  const current = preview && preview.input === inputKey ? preview.result : null;
  const contract = form.documents.some((d) => CONTRACT.includes(d));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const runPreview = useMutation({
    mutationFn: async () => (await legalApi.adminPreview(input)).data,
    onSuccess: (result) => setPreview({ input: inputKey, result }),
    onError: (err) => toast.error(apiErrorMessage(err, t('previewFailed'))),
  });

  const create = useMutation({
    mutationFn: async () => (await legalApi.adminCreate(input)).data,
    onSuccess: async () => {
      setConfirming(false);
      setPreview(null);
      setForm(EMPTY);
      toast.success(t('created'));
      await queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
    },
    onError: (err) => {
      setConfirming(false);
      toast.error(apiErrorMessage(err, t('createFailed')));
    },
  });

  const toggleDocument = (d: LegalDocumentKey, on: boolean) =>
    set('documents', on ? [...form.documents, d] : form.documents.filter((x) => x !== d));

  const earliest = formatLegalVersion(overview.earliestContractVersion, locale);

  return (
    <section className="app-card admin-legal__card" aria-labelledby="admin-legal-new">
      <div className="app-card__head">
        <h2 id="admin-legal-new" className="app-card__title">
          {t('form.title')}
        </h2>
      </div>
      <form
        className="app-card__body admin-legal__form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          runPreview.mutate();
        }}
      >
        <p className="admin-legal__muted">{t('form.intro')}</p>

        <fieldset className="admin-legal__fieldset">
          <legend className="auth-field__label">{t('form.documents')}</legend>
          {DOCUMENTS.map((d) => (
            <Checkbox
              key={d}
              checked={form.documents.includes(d)}
              onChange={(e) => toggleDocument(d, e.target.checked)}
              data-testid={`admin-legal-doc-${d}`}
            >
              {t(`documents.${d}`)}
            </Checkbox>
          ))}
        </fieldset>

        <Input
          type="date"
          label={t('form.version')}
          hint={
            contract ? t('form.versionHintContract', { date: earliest }) : t('form.versionHint')
          }
          value={form.version}
          min={overview.today}
          onChange={(e) => set('version', e.target.value)}
          data-testid="admin-legal-version"
        />

        {contract && (
          <div className="admin-legal__options">
            <Checkbox
              checked={form.shortNotice}
              onChange={(e) => set('shortNotice', e.target.checked)}
              data-testid="admin-legal-short-notice"
            >
              {t('form.shortNotice')}
            </Checkbox>
            <Checkbox
              checked={form.explicitConsent}
              onChange={(e) => set('explicitConsent', e.target.checked)}
              data-testid="admin-legal-explicit-consent"
            >
              {t('form.explicitConsent')}
            </Checkbox>
          </div>
        )}

        <Textarea
          label={t('form.summaryDe')}
          hint={t('form.summaryDeHint')}
          value={form.summaryDe}
          rows={5}
          maxLength={4000}
          onChange={(e) => set('summaryDe', e.target.value)}
          data-testid="admin-legal-summary-de"
        />
        <Textarea
          label={t('form.summaryEn')}
          hint={t('form.summaryEnHint')}
          value={form.summaryEn}
          rows={3}
          maxLength={4000}
          onChange={(e) => set('summaryEn', e.target.value)}
          data-testid="admin-legal-summary-en"
        />

        <div className="admin-legal__actions">
          <button
            type="submit"
            className="btn btn--ghost"
            disabled={runPreview.isPending || !form.documents.length}
            data-testid="admin-legal-preview"
          >
            {runPreview.isPending ? t('form.checking') : t('form.preview')}
          </button>
        </div>
      </form>

      {current && (
        <div
          className="app-card__body admin-legal__preview"
          data-testid="admin-legal-preview-result"
        >
          {current.valid ? (
            <Banner tone="success" title={t('preview.ok')}>
              {t('preview.recipients', { count: current.recipients })}
            </Banner>
          ) : (
            <Banner tone="danger" title={t('preview.problems')}>
              <ul className="admin-legal__problems" data-testid="admin-legal-problems">
                {current.problems.map((p, i) => (
                  <li key={i}>{p.message}</li>
                ))}
              </ul>
            </Banner>
          )}
          <p className="admin-legal__subject">
            <span>{t('preview.subject')}</span> {current.subject}
          </p>
          <iframe
            className="admin-legal__mail"
            title={t('preview.mailTitle')}
            srcDoc={current.html}
            sandbox=""
            data-testid="admin-legal-mail"
          />
          <div className="admin-legal__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!current.valid || create.isPending}
              onClick={() => setConfirming(true)}
              data-testid="admin-legal-send"
            >
              {t('preview.send', { count: current.recipients })}
            </button>
          </div>
        </div>
      )}
      {preview && !current && (
        <p className="app-card__body admin-legal__muted">{t('preview.stale')}</p>
      )}

      {confirming && current && (
        <ConfirmDialog
          id="admin-legal-confirm"
          title={t('confirm.title')}
          confirmLabel={t('confirm.send')}
          pending={create.isPending}
          onConfirm={() => create.mutate()}
          onCancel={() => setConfirming(false)}
        >
          <p style={{ margin: 0, fontSize: 14 }}>
            {t('confirm.text', {
              count: current.recipients,
              date: formatLegalVersion(input.version, locale),
            })}
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}

function AnnouncementList({ announcements }: { announcements: LegalAnnouncement[] }) {
  const t = useTranslations('admin.legal');
  const locale = useLocale();
  const { formatDateTime } = useLocaleFormat();
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: async (id: string) => (await legalApi.adminRetry(id)).data,
    onSuccess: async (result) => {
      toast.success(t('list.retried', { count: result.queued }));
      await queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('createFailed'))),
  });

  return (
    <section className="app-card admin-legal__card" aria-labelledby="admin-legal-list">
      <div className="app-card__head">
        <h2 id="admin-legal-list" className="app-card__title">
          {t('list.title')}
        </h2>
      </div>
      <div className="app-card__body">
        {announcements.length === 0 ? (
          <p className="admin-legal__muted">{t('list.empty')}</p>
        ) : (
          <ul className="admin-legal__list" data-testid="admin-legal-list">
            {announcements.map((a) => (
              <li key={a.id} className="admin-legal__item" data-testid="admin-legal-item">
                <div className="admin-legal__item-head">
                  <b>{a.documents.map((d) => t(`documents.${d}`)).join(', ')}</b>
                  <span className={a.inForce ? 'badge badge--success' : 'badge badge--info'}>
                    {a.inForce
                      ? t('list.inForce', { date: formatLegalVersion(a.version, locale) })
                      : t('list.upcoming', { date: formatLegalVersion(a.version, locale) })}
                  </span>
                  {a.shortNotice && (
                    <span className="badge badge--warning">{t('list.shortNotice')}</span>
                  )}
                  {a.explicitConsent && (
                    <span className="badge badge--neutral">{t('list.explicitConsent')}</span>
                  )}
                </div>
                <p className="admin-legal__muted">
                  {t('list.created', {
                    date: formatDateTime(a.createdAt),
                    email: a.createdByEmail,
                  })}
                </p>
                <p className="admin-legal__summary">{a.summaryDe}</p>
                <p className="admin-legal__stats" data-testid="admin-legal-stats">
                  {t('list.stats', {
                    sent: a.stats.sent,
                    total: a.stats.total,
                    open: a.stats.pending + a.stats.sending,
                    failed: a.stats.failed,
                  })}
                </p>
                {a.stats.failed > 0 && (
                  <details className="admin-legal__failures">
                    <summary>{t('list.failures', { count: a.stats.failed })}</summary>
                    <ul>
                      {a.failures.map((f) => (
                        <li key={f.email}>
                          <span className="tse-mono">{f.email}</span>
                          {f.error ? ` – ${f.error}` : ''}
                        </li>
                      ))}
                    </ul>
                    <p className="admin-legal__muted">{t('list.retryHint')}</p>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate(a.id)}
                    >
                      {t('list.retry')}
                    </button>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
