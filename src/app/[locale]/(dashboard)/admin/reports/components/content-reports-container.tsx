'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ExternalLink, Mail, Save } from 'lucide-react';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useIntlLocale } from '@/hooks/use-locale-format';
import { contentReportsApi } from '@/lib/content-reports-api';
import { ApiException } from '@/types/api';
import {
  CONTENT_REPORT_ACTIONS,
  CONTENT_REPORT_STATUSES,
  type ContentReport,
  type ContentReportAction,
  type ContentReportStatus,
  type UpdateContentReportData,
} from '@/types/content-report';

import '@/styles/content-report.css';

const FILTER: (ContentReportStatus | 'all')[] = ['open', 'in_review', 'closed', 'all'];
const QUERY_KEY = ['admin-content-reports'] as const;

/**
 * Inhaltsmeldungen (Art. 16 DSA) prüfen, entscheiden und begründen
 * (Art. 17 DSA). Nur für die Plattform-Verwaltung.
 */
export function ContentReportsContainer() {
  const t = useTranslations('admin.reports');
  const params = useSearchParams();
  const focusId = params.get('id');
  const [filter, setFilter] = useState<(typeof FILTER)[number]>(focusId ? 'all' : 'open');
  const [openId, setOpenId] = useState<string | null>(focusId);

  const { data, isLoading, error } = useQuery({
    queryKey: [...QUERY_KEY, filter],
    queryFn: () => contentReportsApi.list(filter === 'all' ? undefined : filter),
    retry: (count, err) => !(err instanceof ApiException && err.status === 403) && count < 2,
  });

  const reports = data?.data ?? [];
  const errorText = !error
    ? null
    : error instanceof ApiException && error.status === 403
      ? t('forbidden')
      : t('error');

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div className="feedback-admin__filters" role="group" aria-label={t('filterLabel')}>
          {FILTER.map((value) => (
            <button
              key={value}
              type="button"
              className={`btn btn--sm ${filter === value ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {t(`filter.${value}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="widget-state">{t('loading')}</p>
      ) : errorText ? (
        <p className="widget-state widget-state--error">{errorText}</p>
      ) : reports.length === 0 ? (
        <p className="widget-state">{t('empty')}</p>
      ) : (
        <ul className="feedback-admin__list">
          {reports.map((report) => (
            <ReportItem
              key={report.id}
              report={report}
              open={openId === report.id}
              onToggle={() => setOpenId((current) => (current === report.id ? null : report.id))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportItem({ report, open, onToggle }: { report: ContentReport; open: boolean; onToggle: () => void }) {
  const t = useTranslations('admin.reports');
  const tReason = useTranslations('contentReport.reasons');
  const locale = useIntlLocale();
  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : null;

  const target =
    report.targetType === 'shop'
      ? t('target.shop', { event: report.eventName ?? '–', organization: report.organizationName ?? '–' })
      : report.targetType === 'helper_page'
        ? t('target.helper_page', { plan: report.shiftPlanName ?? '–', organization: report.organizationName ?? '–' })
        : t('target.unknown');

  return (
    <li className={`feedback-admin__item${report.status === 'closed' ? ' is-handled' : ''}`} data-testid="content-report">
      <div className="feedback-admin__meta">
        <span className={`content-report__status content-report__status--${report.status}`}>{t(`status.${report.status}`)}</span>
        <span className="feedback-admin__kind">{tReason(report.reason)}</span>
        <time dateTime={report.createdAt}>{when(report.createdAt)}</time>
        {!report.adminNotifiedAt && (
          <span className="feedback-admin__warn" title={t('notNotifiedHint')}>
            <Mail aria-hidden="true" />
            {t('notNotified')}
          </span>
        )}
      </div>

      <p className="content-report__target">
        {target} ·{' '}
        <a href={report.url} target="_blank" rel="noopener noreferrer nofollow">
          {report.url}
          <ExternalLink aria-hidden="true" />
        </a>
      </p>
      <p className="feedback-admin__message">{report.description}</p>

      <div className="feedback-admin__foot">
        <a href={`mailto:${report.reporterEmail}`} className="feedback-admin__from">
          {report.reporterName} &lt;{report.reporterEmail}&gt;
          {report.goodFaith ? ` · ${t('goodFaith')}` : ''}
        </a>
        <button type="button" className={`btn btn--sm ${open ? 'btn--ghost' : 'btn--primary'}`} onClick={onToggle} aria-expanded={open}>
          {open ? t('close') : t('handle')}
        </button>
      </div>

      {open && <ReportEditor report={report} />}
    </li>
  );
}

function ReportEditor({ report }: { report: ContentReport }) {
  const t = useTranslations('admin.reports');
  const locale = useIntlLocale();
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    status: report.status,
    action: (report.action ?? '') as ContentReportAction | '',
    decision: report.decision ?? '',
    facts: report.facts ?? '',
    ground: report.ground ?? '',
    redress: report.redress ?? '',
  });
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setForm({
      status: report.status,
      action: (report.action ?? '') as ContentReportAction | '',
      decision: report.decision ?? '',
      facts: report.facts ?? '',
      ground: report.ground ?? '',
      redress: report.redress ?? '',
    });
  }, [report]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const save = useMutation({
    mutationFn: () => {
      const body: UpdateContentReportData = {
        status: form.status,
        decision: form.decision,
        facts: form.facts,
        ground: form.ground,
        redress: form.redress,
      };
      if (form.action) body.action = form.action;
      return contentReportsApi.update(report.id, body);
    },
    onSuccess: () => {
      setMessage({ tone: 'ok', text: t('saved') });
      refresh();
    },
    onError: (err) => setMessage({ tone: 'error', text: apiErrorMessage(err, t('saveFailed')) }),
  });

  const notify = useMutation({
    mutationFn: (target: 'reporter' | 'organization') => contentReportsApi.notify(report.id, target),
    onSuccess: (_, target) => {
      setMessage({ tone: 'ok', text: t(target === 'reporter' ? 'notifiedReporter' : 'notifiedOrganization') });
      refresh();
    },
    onError: (err) => setMessage({ tone: 'error', text: apiErrorMessage(err, t('notifyFailed')) }),
  });

  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : null;
  const dirty =
    form.status !== report.status ||
    form.action !== (report.action ?? '') ||
    form.decision !== (report.decision ?? '') ||
    form.facts !== (report.facts ?? '') ||
    form.ground !== (report.ground ?? '') ||
    form.redress !== (report.redress ?? '');
  const canDisable = !!report.eventId || !!report.shiftPlanId;

  return (
    <div className="content-report__editor" data-testid="content-report-editor">
      <div className="content-report__editor-row">
        <label className="auth-field">
          <span className="auth-field__label">{t('fields.status')}</span>
          <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ContentReportStatus })}>
            {CONTENT_REPORT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="auth-field">
          <span className="auth-field__label">{t('fields.action')}</span>
          <select
            className="select"
            value={form.action}
            onChange={(e) => setForm({ ...form, action: e.target.value as ContentReportAction | '' })}
          >
            <option value="">{t('actions.undecided')}</option>
            {CONTENT_REPORT_ACTIONS.map((action) => (
              <option key={action} value={action} disabled={action === 'disable_shop' && !canDisable && report.action !== action}>
                {t(`actions.${action}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {form.action === 'disable_shop' && !report.actionAppliedAt && (
        <p className="content-report__hint">{t(report.shiftPlanId ? 'disableHintHelper' : 'disableHintShop')}</p>
      )}
      {form.action === 'hide_content' && <p className="content-report__hint">{t('hideHint')}</p>}
      {report.actionAppliedAt && (
        <p className="content-report__hint">{t('actionApplied', { date: when(report.actionAppliedAt) ?? '' })}</p>
      )}

      <label className="auth-field">
        <span className="auth-field__label">{t('fields.decision')}</span>
        <textarea className="input content-report__textarea--small" rows={2} value={form.decision} onChange={(e) => setForm({ ...form, decision: e.target.value })} placeholder={t('placeholders.decision')} />
      </label>
      <label className="auth-field">
        <span className="auth-field__label">{t('fields.facts')}</span>
        <textarea className="input content-report__textarea--small" rows={3} value={form.facts} onChange={(e) => setForm({ ...form, facts: e.target.value })} placeholder={t('placeholders.facts')} />
      </label>
      <label className="auth-field">
        <span className="auth-field__label">{t('fields.ground')}</span>
        <textarea className="input content-report__textarea--small" rows={2} value={form.ground} onChange={(e) => setForm({ ...form, ground: e.target.value })} placeholder={t('placeholders.ground')} />
      </label>
      <label className="auth-field">
        <span className="auth-field__label">{t('fields.redress')}</span>
        <textarea className="input content-report__textarea--small" rows={3} value={form.redress} onChange={(e) => setForm({ ...form, redress: e.target.value })} placeholder={report.effectiveRedress} />
      </label>

      {message && (
        <p className={message.tone === 'ok' ? 'content-report__ok' : 'content-report__error'} role="status">
          {message.text}
        </p>
      )}

      <div className="content-report__editor-actions">
        <button type="button" className="btn btn--sm btn--primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          <Save aria-hidden="true" />
          <span>{save.isPending ? t('saving') : t('save')}</span>
        </button>
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          disabled={dirty || notify.isPending || !report.action}
          title={dirty ? t('saveFirst') : undefined}
          onClick={() => notify.mutate('reporter')}
        >
          <Mail aria-hidden="true" />
          <span>{t('notifyReporter')}</span>
        </button>
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          disabled={dirty || notify.isPending || !report.action || !report.organizationId}
          title={dirty ? t('saveFirst') : undefined}
          onClick={() => notify.mutate('organization')}
        >
          <Mail aria-hidden="true" />
          <span>{t('notifyOrganization')}</span>
        </button>
      </div>
      <p className="content-report__hint">
        {[
          report.receiptSentAt ? t('sent.receipt', { date: when(report.receiptSentAt) ?? '' }) : t('sent.noReceipt'),
          report.reporterNotifiedAt ? t('sent.reporter', { date: when(report.reporterNotifiedAt) ?? '' }) : null,
          report.organizationNotifiedAt ? t('sent.organization', { date: when(report.organizationNotifiedAt) ?? '' }) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  );
}
