'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useIntlLocale } from '@/hooks/use-locale-format';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useActivateEvent, useCreateEventCheckout, useOrderInvoice } from '@/hooks/use-events';
import { usePurchaseTermsAcceptance } from '@/hooks/use-legal';
import { billingApi } from '@/lib/api-client';
import { formatCurrency } from '@/utils/format';
import { DEFAULT_BUSINESS_DAY_START_HOUR } from '@/lib/event-schedule';
import { checkoutCancellationHint, formatUnlockDeadline } from '@/utils/event-unlock';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { toast } from '@/components/shared/toast';
import { ApiException } from '@/types/api';
import type { Event } from '@/types/event';
import type {
  CompanySearchResultItem,
  EventBilling,
  PurchaseMasterDataField,
  PurchaseMasterDataStatus,
} from '@/types/billing';
import { checkoutIncludesTse, checkoutTseSurcharge } from '@/utils/event-tse';
import { missingForCheckout, parseMissingParam } from '@/utils/purchase-master-data';
import { CheckoutTseSection } from './checkout-tse-section';
import { PurchaseMasterDataStep } from './purchase-master-data-step';
import { PurchaseSummary } from './purchase-summary';

const MASTER_DATA_FORM_ID = 'checkout-master-data-form';

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
  const apiErrorMessage = useApiErrorMessage();
  const locale = useIntlLocale();

  const orderInvoice = useOrderInvoice();
  const activateEvent = useActivateEvent();
  const createCheckout = useCreateEventCheckout();
  // AGB und AVV werden mit jeder Buchung angenommen (Nachweis je Kauf).
  const purchaseTerms = usePurchaseTermsAcceptance(organizationId);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bestand in Deutschland: Antwort auf „Mit Cloud-TSE?“ (keine Vorauswahl).
  const [withTse, setWithTse] = useState<boolean | null>(null);
  // Pflichtangaben vor dem Bezahlen: Stand der API, nach dem Speichern aktualisiert.
  const [masterData, setMasterData] = useState<PurchaseMasterDataStatus | undefined>(billing?.masterData);
  const [step, setStep] = useState<'pay' | 'masterData'>('pay');
  const [masterDataPending, setMasterDataPending] = useState(false);

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
    setWithTse(null);
    setMasterData(billing?.masterData);
    setStep('pay');
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

  const tse = billing.tse;
  // Im Bestand muss die Frage beantwortet sein — „Ja“ ist ein Wechsel ohne Rückweg.
  const tseAnswered = tse?.offer !== 'optional' || withTse !== null;
  const includesTse = checkoutIncludesTse(tse, withTse);
  // Erst die Pflichtangaben, dann die Zahlung (die Registrierung fragt sie nicht ab).
  const missing = missingForCheckout(masterData, tse, withTse);
  const needsMasterData = missing.length > 0;
  const tseAnswer = tse?.offer === 'optional' ? (withTse ?? undefined) : undefined;
  const tseSurcharge = checkoutTseSurcharge(tse, withTse);
  const total = Math.round((billing.finalPrice + tseSurcharge) * 100) / 100;

  const emailValid = EMAIL_RE.test(email.trim());
  const formValid =
    tseAnswered &&
    name.trim().length > 0 &&
    emailValid &&
    street.trim().length > 0 &&
    zip.trim().length > 0 &&
    city.trim().length > 0 &&
    confirmed;

  const isSubmitting =
    orderInvoice.isPending ||
    activateEvent.isPending ||
    createCheckout.isPending ||
    masterDataPending ||
    purchaseTerms.isPending;

  /** Die API meldet fehlende Angaben (z. B. veralteter Stand): zum Formular. */
  const handleMissingFromApi = (err: unknown): boolean => {
    if (!(err instanceof ApiException) || err.code !== 'PURCHASE_MASTER_DATA_REQUIRED') return false;
    const fields = parseMissingParam(err.params?.missing);
    setMasterData((prev) => {
      const base: PurchaseMasterDataStatus = prev ?? {
        values: { legalName: '', street: '', zip: '', city: '', taxNumber: '', vatId: '' },
        missing: [],
        missingWithTse: [],
        country: null,
      };
      return includesTse ? { ...base, missingWithTse: fields } : { ...base, missing: fields };
    });
    setStep('masterData');
    return true;
  };

  const handleMasterDataSaved = (status: PurchaseMasterDataStatus) => {
    setMasterData(status);
    // Rechnungsformular mit den gespeicherten Angaben vorbelegen.
    setName((prev) => (!prev.trim() || prev === billing.organizationName ? status.values.legalName : prev));
    setStreet(status.values.street);
    setZip(status.values.zip);
    setCity(status.values.city);
    setStep('pay');
    toast.success(t('masterData.saved'));
  };

  // Die Rechnung ist die Ausnahme, nicht der Regelweg: nur Organisationen,
  // denen sie ausdrücklich eingeräumt wurde, sehen das Adressformular.
  const payByInvoice = billing.billingMode === 'invoice';
  const payOnline = !payByInvoice && billing.onlinePaymentAvailable;

  const handlePayOnline = async () => {
    setError(null);
    try {
      await purchaseTerms.accept();
      const { checkoutUrl } = await createCheckout.mutateAsync({ organizationId, id: event.id, withTse: tseAnswer });
      // Vollständiger Seitenwechsel statt Router-Navigation — das Ziel liegt
      // bei Stripe, nicht in dieser Anwendung.
      window.location.href = checkoutUrl;
    } catch (err) {
      if (handleMissingFromApi(err)) return;
      setError(apiErrorMessage(err, tErrors('generic')));
    }
  };

  const handleSubmit = async () => {
    if (!formValid) return;
    setError(null);
    try {
      await purchaseTerms.accept();
      await orderInvoice.mutateAsync({
        organizationId,
        id: event.id,
        data: {
          billingName: name.trim(),
          billingEmail: email.trim(),
          billingAddress: { street: street.trim(), zip: zip.trim(), city: city.trim() },
          ...(tseAnswer !== undefined ? { withTse: tseAnswer } : {}),
        },
      });
      await activateEvent.mutateAsync({ organizationId, id: event.id });
      toast.success(t('success'));
      onClose();
    } catch (err) {
      if (handleMissingFromApi(err)) return;
      setError(
        err instanceof ApiException && err.code === 'EVENT_NOT_PAID'
          ? t('errors.notPaid')
          : apiErrorMessage(err, tErrors('generic')),
      );
    }
  };

  const dateFormat = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const startsOn = event.startDate ? dateFormat.format(new Date(event.startDate)) : null;
  const endsOn = event.endDate ? dateFormat.format(new Date(event.endDate)) : null;
  // Über Mitternacht endet die Veranstaltung formal am Folgetag. Für den Beleg
  // zählt der Zeitraum, den der Kunde bucht — also die Veranstaltungstage.
  const eventDate =
    startsOn && endsOn && endsOn !== startsOn && billing.days > 1
      ? `${startsOn} – ${endsOn}`
      : startsOn;
  // Bis wann sich die Freischaltung nach dem Bezahlen kostenlos stornieren
  // ließe — wer erst kurz vor Beginn bezahlt, soll vorher wissen, dass es
  // dann keinen kostenlosen Rückweg mehr gibt.
  const cancellationHint = checkoutCancellationHint(billing);

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

          {step === 'masterData' && masterData ? (
            <PurchaseMasterDataStep
              organizationId={organizationId}
              status={masterData}
              missing={missing}
              withTse={includesTse}
              formId={MASTER_DATA_FORM_ID}
              onSaved={handleMasterDataSaved}
              onPendingChange={setMasterDataPending}
            />
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '12px 14px',
                  background: 'color-mix(in oklab, var(--ink) 4%, var(--paper))',
                  border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
                  borderRadius: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
                  {billing.discountPercent > 0 && (
                    <span
                      style={{
                        fontSize: 13,
                        textDecoration: 'line-through',
                        color: 'color-mix(in oklab, var(--ink) 45%, transparent)',
                      }}
                    >
                      {formatCurrency(billing.price, locale)}
                    </span>
                  )}
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>
                    {formatCurrency(billing.finalPrice, locale)}
                  </span>
                  {billing.discountPercent > 0 && (
                    <span className="badge badge--success">
                      {billing.discountReason === 'first-event'
                        ? t('discountFirstEvent', { percent: billing.discountPercent })
                        : t('discount', { percent: billing.discountPercent })}
                    </span>
                  )}
                </div>
                {/* Bei einer eintägigen Veranstaltung sagt "1 × 25 €" nichts, was der
                    Betrag darüber nicht schon zeigt. */}
                {billing.days > 1 && (
                  <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
                    {t('breakdown', {
                      days: billing.days,
                      pricePerDay: formatCurrency(billing.pricePerDay, locale),
                    })}
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
                  {t('dayRule', {
                    hour: billing.businessDayStartHour ?? DEFAULT_BUSINESS_DAY_START_HOUR,
                  })}
                </div>
                {/* Nur mit eingestelltem Zuschlag — derzeit ist die TSE inklusive. */}
                {tseSurcharge > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--ink)' }} data-testid="checkout-tse-total">
                    {t('tse.total', {
                      surcharge: formatCurrency(tseSurcharge, locale),
                      total: formatCurrency(total, locale),
                    })}
                  </div>
                )}
              </div>

              {tse?.offer && (
                <CheckoutTseSection
                  tse={tse}
                  answer={withTse}
                  onAnswer={setWithTse}
                  locale={locale}
                  disabled={isSubmitting}
                />
              )}

              <p
                style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', margin: 0 }}
                data-testid="checkout-cancellation-hint"
              >
                {cancellationHint?.kind === 'until'
                  ? t('cancellationUntil', {
                      deadline: formatUnlockDeadline(cancellationHint.deadline, locale, billing.cancellation.timezone),
                    })
                  : cancellationHint?.kind === 'too_late'
                    ? t('cancellationTooLate')
                    : t('cancellationRule')}
              </p>

              {needsMasterData ? (
                <MissingMasterDataNotice missing={missing} withTse={includesTse} />
              ) : !payByInvoice ? (
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
                  {payOnline ? t('onlineNotice') : t('unavailableNotice')}
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', margin: 0 }}>
                    {/* Mit Stripe kommt die Rechnung sofort und nennt ein
                        Zahlungsziel; ohne Stripe stellt sie der Betreiber von Hand. */}
                    {billing.invoiceViaStripe
                      ? t('invoiceNoticeStripe', { days: billing.invoiceDaysUntilDue ?? 14 })
                      : t('invoiceNotice')}
                  </p>

                  <div style={{ position: 'relative' }}>
                    <label className="auth-field">
                      <span>
                        {t('form.name')} <span className="auth-field__req">*</span>
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
                      <p className="auth-field__hint" style={{ marginTop: 4 }}>
                        {t('companySearchHint')}
                      </p>
                    )}
                  </div>

                  <label className="auth-field">
                    <span>
                      {t('form.email')} <span className="auth-field__req">*</span>
                    </span>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </label>

                  <label className="auth-field">
                    <span>
                      {t('form.street')} <span className="auth-field__req">*</span>
                    </span>
                    <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} />
                  </label>

                  <div className="field-row field-row--narrow-start">
                    <label className="auth-field">
                      <span>
                        {t('form.zip')} <span className="auth-field__req">*</span>
                      </span>
                      <input type="text" value={zip} onChange={(e) => setZip(e.target.value)} />
                    </label>
                    <label className="auth-field">
                      <span>
                        {t('form.city')} <span className="auth-field__req">*</span>
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

              {!needsMasterData && (payByInvoice || payOnline) && (
                <PurchaseSummary
                  eventName={event.name}
                  eventDate={eventDate}
                  billing={billing}
                  includesTse={includesTse}
                  tseSurcharge={tseSurcharge}
                  total={total}
                  locale={locale}
                />
              )}
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
          {step === 'masterData' ? (
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setStep('pay')} disabled={isSubmitting}>
                {tCommon('back')}
              </button>
              <button
                type="submit"
                form={MASTER_DATA_FORM_ID}
                className="btn btn--primary"
                disabled={isSubmitting}
                data-testid="checkout-master-data-save"
              >
                {masterDataPending ? tCommon('saving') : t('masterData.saveAndContinue')}
              </button>
            </>
          ) : needsMasterData ? (
            <>
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isSubmitting}>
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setError(null);
                  setStep('masterData');
                }}
                disabled={!tseAnswered || isSubmitting}
                data-testid="checkout-master-data-continue"
              >
                {t('masterData.continue')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isSubmitting}>
                {tCommon('cancel')}
              </button>
              {payByInvoice && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleSubmit}
                  disabled={!formValid || isSubmitting}
                >
                  {isSubmitting ? tCommon('saving') : t('submit')}
                </button>
              )}
              {payOnline && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handlePayOnline}
                  disabled={isSubmitting || !tseAnswered}
                >
                  {isSubmitting ? t('redirecting') : t('payOnline')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Was vor dem Bezahlen noch fehlt (Hinweis vor dem Formularschritt). */
function MissingMasterDataNotice({ missing, withTse }: { missing: PurchaseMasterDataField[]; withTse: boolean }) {
  const t = useTranslations('events.checkout.masterData');
  const items: string[] = [];
  if (missing.includes('legalName')) items.push(t('missing.legalName'));
  if (missing.some((f) => f === 'street' || f === 'zip' || f === 'city')) items.push(t('missing.address'));
  const taxMissing = missing.includes('taxNumber') || missing.includes('vatId');
  if (taxMissing) items.push(t('missing.tax'));
  return (
    <div
      role="status"
      data-testid="checkout-master-data-notice"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '12px 14px',
        borderRadius: 10,
        background: 'color-mix(in oklab, var(--ink) 4%, var(--paper))',
        border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
        fontSize: 13,
        color: 'var(--ink)',
      }}
    >
      <b>{t('noticeTitle')}</b>
      <span>{t('noticeText', { items: items.join(' · ') })}</span>
      {withTse && taxMissing && (
        <span style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 60%, transparent)' }}>{t('noticeTse')}</span>
      )}
    </div>
  );
}
