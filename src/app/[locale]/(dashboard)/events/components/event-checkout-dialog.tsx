'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { useActivateEvent, useOrderInvoice } from '@/hooks/use-events';
import { billingApi } from '@/lib/api-client';
import { formatCurrency } from '@/utils/format';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { toast } from '@/components/shared/toast';
import { ApiException } from '@/types/api';
import type { Event } from '@/types/event';
import type { CompanySearchResultItem, EventBilling } from '@/types/billing';

interface EventCheckoutDialogProps {
  event: Event | null;
  billing: EventBilling | null;
  organizationId: string;
  onClose: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EventCheckoutDialog({ event, billing, organizationId, onClose }: EventCheckoutDialogProps) {
  const t = useTranslations('events.checkout');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const currencyLocale = locale === 'de' ? 'de-DE' : 'en-US';

  const orderInvoice = useOrderInvoice();
  const activateEvent = useActivateEvent();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyResults, setCompanyResults] = useState<CompanySearchResultItem[]>([]);
  const [companySearchEnabled, setCompanySearchEnabled] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prefill/reset whenever a new event is opened for checkout.
  useEffect(() => {
    setName(billing?.organizationName || '');
    setEmail(billing?.billingEmail || '');
    setStreet(billing?.billingAddress?.street || '');
    setZip(billing?.billingAddress?.zip || '');
    setCity(billing?.billingAddress?.city || '');
    setConfirmed(false);
    setError(null);
    setCompanyResults([]);
    setShowSuggestions(false);
    setCompanySearchEnabled(true);
  }, [event?.id, billing]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!companySearchEnabled || !organizationId || name.trim().length < 3) {
      setCompanyResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await billingApi.companySearch(organizationId, name.trim());
        if (!response.data.enabled) {
          setCompanySearchEnabled(false);
          setCompanyResults([]);
          return;
        }
        setCompanyResults(response.data.results);
        setShowSuggestions(true);
      } catch {
        // Best-effort feature — a failed lookup should never block the form.
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, organizationId, companySearchEnabled]);

  if (!event || !billing) return null;

  const handleSelectCompany = (result: CompanySearchResultItem) => {
    setName(result.name);
    setStreet(result.address.street);
    setZip(result.address.zip);
    setCity(result.address.city);
    setShowSuggestions(false);
  };

  const emailValid = EMAIL_RE.test(email.trim());
  const formValid =
    name.trim().length > 0 &&
    emailValid &&
    street.trim().length > 0 &&
    zip.trim().length > 0 &&
    city.trim().length > 0 &&
    confirmed;

  const isSubmitting = orderInvoice.isPending || activateEvent.isPending;

  const handleSubmit = async () => {
    if (!formValid) return;
    setError(null);
    try {
      await orderInvoice.mutateAsync({
        organizationId,
        id: event.id,
        data: {
          billingName: name.trim(),
          billingEmail: email.trim(),
          billingAddress: { street: street.trim(), zip: zip.trim(), city: city.trim() },
        },
      });
      await activateEvent.mutateAsync({ organizationId, id: event.id });
      toast.success(t('success'));
      onClose();
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.code === 'EVENT_NOT_PAID' ? t('errors.notPaid') : err.message);
      } else {
        setError(tErrors('generic'));
      }
    }
  };

  const eventDate = event.startDate
    ? new Intl.DateTimeFormat(currencyLocale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
        new Date(event.startDate)
      )
    : null;

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div className="modal__panel modal__panel--md" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{t('title')}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{event.name}</div>
            {eventDate && (
              <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>{eventDate}</div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: 10,
              padding: '12px 14px',
              background: 'color-mix(in oklab, var(--ink) 4%, var(--paper))',
              border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
              borderRadius: 10,
            }}
          >
            {billing.discountPercent > 0 && (
              <span
                style={{
                  fontSize: 13,
                  textDecoration: 'line-through',
                  color: 'color-mix(in oklab, var(--ink) 45%, transparent)',
                }}
              >
                {formatCurrency(billing.price, currencyLocale)}
              </span>
            )}
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>
              {formatCurrency(billing.finalPrice, currencyLocale)}
            </span>
            {billing.discountPercent > 0 && (
              <span className="badge badge--success">{t('discount', { percent: billing.discountPercent })}</span>
            )}
          </div>

          <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', margin: 0 }}>
            {t('noVat')}
          </p>

          {billing.billingMode === 'prepaid' ? (
            <div
              role="status"
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                background: 'color-mix(in oklab, var(--ink) 4%, var(--paper))',
                fontSize: 13,
                color: 'var(--ink)',
              }}
            >
              {t('prepaidNotice')}
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', margin: 0 }}>
                {t('invoiceNotice')}
              </p>

              <div style={{ position: 'relative' }}>
                <label className="auth-field">
                  <span>
                    {t('form.name')} <span style={{ color: 'var(--danger)' }}>*</span>
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setShowSuggestions(false);
                    }}
                    onFocus={() => companyResults.length > 0 && setShowSuggestions(true)}
                  />
                </label>
                {companySearchEnabled && showSuggestions && companyResults.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 20,
                      marginTop: 4,
                      background: 'var(--paper)',
                      border: '1px solid color-mix(in oklab, var(--ink) 12%, transparent)',
                      borderRadius: 8,
                      boxShadow: '0 8px 24px color-mix(in oklab, var(--ink) 12%, transparent)',
                      overflow: 'hidden',
                    }}
                  >
                    {companyResults.map((result, idx) => (
                      <button
                        key={`${result.name}-${idx}`}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectCompany(result);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 12px',
                          fontSize: 12,
                          background: 'transparent',
                          border: 'none',
                          borderBottom:
                            idx < companyResults.length - 1
                              ? '1px solid color-mix(in oklab, var(--ink) 6%, transparent)'
                              : 'none',
                          cursor: 'pointer',
                          color: 'var(--ink)',
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{result.name}</div>
                        <div style={{ opacity: 0.6 }}>
                          {result.address.street}, {result.address.zip} {result.address.city}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {companySearchEnabled && (
                  <p style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', marginTop: 4 }}>
                    {t('companySearchHint')}
                  </p>
                )}
              </div>

              <label className="auth-field">
                <span>
                  {t('form.email')} <span style={{ color: 'var(--danger)' }}>*</span>
                </span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>

              <label className="auth-field">
                <span>
                  {t('form.street')} <span style={{ color: 'var(--danger)' }}>*</span>
                </span>
                <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                <label className="auth-field">
                  <span>
                    {t('form.zip')} <span style={{ color: 'var(--danger)' }}>*</span>
                  </span>
                  <input type="text" value={zip} onChange={(e) => setZip(e.target.value)} />
                </label>
                <label className="auth-field">
                  <span>
                    {t('form.city')} <span style={{ color: 'var(--danger)' }}>*</span>
                  </span>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} />
                </label>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--green-ink)', flexShrink: 0 }}
                />
                <span style={{ fontSize: 13, color: 'var(--ink)' }}>{t('form.confirm')}</span>
              </label>
            </>
          )}

          {error && (
            <div
              role="alert"
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'color-mix(in oklab, var(--danger) 10%, var(--paper))',
                color: 'var(--danger)',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isSubmitting}>
            {tCommon('cancel')}
          </button>
          {billing.billingMode !== 'prepaid' && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSubmit}
              disabled={!formValid || isSubmitting}
            >
              {isSubmitting ? tCommon('saving') : t('submit')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
