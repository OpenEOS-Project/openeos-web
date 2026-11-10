'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { Banner, Button, Icon, Input, Spinner, Textarea } from '@openeos/ui';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useFormatPrice } from '@/hooks/use-format-price';
import { deviceApi } from '@/lib/api-client';
import { looksLikeEmail } from '@/lib/receipt';
import type { HospitalityCheck, HospitalityReceipt } from '@/types/receipt';

import { usePosToast } from './pos-toast';

interface HospitalityPanelProps {
  orderIds: string[];
  onBack: () => void;
}

/**
 * Bewirtungsbeleg an der Kasse: prüfen (Stammdaten, Artikelnamen, über
 * 250 € Name des Bewirtenden), ausstellen, dann drucken, als QR-Code oder
 * per E-Mail ausgeben. Jede weitere Ausgabe ist eine „Kopie“.
 */
export function HospitalityPanel({ orderIds, onBack }: HospitalityPanelProps) {
  const t = useTranslations('pos.hospitality');
  const locale = useLocale();
  const toast = usePosToast();
  const formatPrice = useFormatPrice();
  const apiErrorMessage = useApiErrorMessage();

  const [check, setCheck] = useState<HospitalityCheck | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<HospitalityReceipt | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'issue' | 'print' | 'qr' | 'email' | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    let alive = true;
    deviceApi
      .hospitalityCheck(orderIds)
      .then((res) => {
        if (!alive || !res.data) return;
        setCheck(res.data);
        setReceipt(res.data.existing);
        setServiceDate(res.data.serviceDate);
      })
      .catch((err) => alive && setLoadError(apiErrorMessage(err)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIds.join(',')]);

  const date = (value: string) =>
    new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const issue = async () => {
    if (!check) return;
    if (check.recipientRequired && !recipientName.trim()) {
      setError(t('recipientRequired'));
      return;
    }
    setError(null);
    setBusy('issue');
    try {
      const res = await deviceApi.hospitalityIssue({
        orderIds,
        recipientName: recipientName.trim() || undefined,
        recipientAddress: recipientAddress.trim() || undefined,
        serviceDate: serviceDate || undefined,
      });
      if (res.data) {
        setReceipt(res.data.receipt);
        toast(res.data.receipt.number ? t('issued', { number: res.data.receipt.number }) : t('issuedTest'));
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const print = async () => {
    if (!receipt) return;
    setBusy('print');
    try {
      const res = await deviceApi.hospitalityPrint(receipt.id);
      if (res.data?.printed) toast(res.data.copy ? t('printedCopy') : t('printed'));
      else toast(t('noPrinter'), 'danger');
    } catch (err) {
      toast(apiErrorMessage(err), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const qr = async () => {
    if (!receipt) return;
    setBusy('qr');
    try {
      const res = await deviceApi.hospitalityLink(receipt.id);
      if (res.data) setLink(res.data.url);
    } catch (err) {
      toast(apiErrorMessage(err), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (!receipt) return;
    if (!looksLikeEmail(email)) {
      setError(t('emailInvalid'));
      return;
    }
    setError(null);
    setBusy('email');
    try {
      await deviceApi.hospitalityEmail(receipt.id, email.trim());
      toast(t('emailSent'));
      setEmail('');
      setEmailOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <div className="pos-hosp__head">
      <Button variant="ghost" onClick={onBack} aria-label={t('back')}>
        <Icon name="chevron-left" />
      </Button>
      <b>{t('title')}</b>
    </div>
  );

  if (loadError) {
    return (
      <div className="pos-handout pos-hosp" data-testid="hospitality-panel">
        {header}
        <Banner tone="danger">{loadError}</Banner>
      </div>
    );
  }
  if (!check) {
    return (
      <div className="pos-handout pos-hosp" data-testid="hospitality-panel">
        {header}
        <div className="pos-center">
          <Spinner />
        </div>
      </div>
    );
  }

  // Ausgestellt: ausgeben.
  if (receipt) {
    return (
      <div className="pos-handout pos-hosp" data-testid="hospitality-panel">
        {header}
        <p className="pos-hosp__issued" data-testid="hospitality-issued">
          {receipt.number
            ? t('issuedInfo', { number: receipt.number, date: date(receipt.issuedAt) })
            : t('testInfo')}
        </p>
        {link && (
          <div className="pos-handout__qr">
            <QRCodeSVG value={link} size={210} level="M" marginSize={2} title={t('qrTitle')} />
          </div>
        )}
        {emailOpen ? (
          <form
            className="pos-hosp__email"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Input
              label={t('emailLabel')}
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              hint={t('emailHint')}
              maxLength={254}
              autoFocus
              fieldClassName="pos-handout__field"
            />
            <div className="pos-handout__row">
              <Button type="button" variant="ghost" onClick={() => setEmailOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" variant="primary" className="oe-grow" loading={busy === 'email'}>
                {busy !== 'email' && <Icon name="send" />}
                {t('emailSend')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="pos-handout__choices">
            <Button variant="primary" loading={busy === 'print'} onClick={() => void print()}>
              {busy !== 'print' && <Icon name="print" />}
              {t('print')}
            </Button>
            <Button variant="secondary" loading={busy === 'qr'} onClick={() => void qr()}>
              {busy !== 'qr' && <Icon name="qr" />}
              {t('qr')}
            </Button>
            <Button variant="secondary" onClick={() => setEmailOpen(true)}>
              <Icon name="mail" />
              {t('email')}
            </Button>
          </div>
        )}
        {error && <p className="pos-handout__warn">{error}</p>}
        <p className="pos-handout__fine">{t('handHint')}</p>
      </div>
    );
  }

  const blocked = check.missingMasterData.length > 0 || check.collectiveItems.length > 0;
  return (
    <form
      className="pos-handout pos-hosp"
      data-testid="hospitality-panel"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void issue();
      }}
    >
      {header}
      <p className="pos-hosp__sum">
        {t('amount', { amount: formatPrice(check.total) })}
        {check.tip > 0 && ` · ${t('tip', { amount: formatPrice(check.tip) })}`}
      </p>
      {check.isTest && <Banner tone="warn">{t('testNote')}</Banner>}
      {check.missingMasterData.length > 0 && (
        <div data-testid="hospitality-master-data">
          <Banner tone="danger">
            {t('masterDataMissing', {
              fields: check.missingMasterData.map((f) => t(`fields.${f}`)).join(', '),
            })}{' '}
            <a href="/settings?tab=org-tax" target="_blank" rel="noreferrer">
              {t('masterDataLink')}
            </a>
          </Banner>
        </div>
      )}
      {check.collectiveItems.length > 0 && (
        <Banner tone="danger">{t('collective', { items: check.collectiveItems.join(', ') })}</Banner>
      )}
      <div className="pos-handout__fields">
        <Input
          label={check.recipientRequired ? t('recipientLabelRequired') : t('recipientLabel')}
          value={recipientName}
          onChange={(e) => {
            setRecipientName(e.target.value);
            if (error) setError(null);
          }}
          hint={check.recipientRequired ? t('recipientHintRequired') : t('recipientHint')}
          maxLength={200}
          autoComplete="off"
          required={check.recipientRequired}
          fieldClassName="pos-handout__field"
        />
        <Textarea
          label={t('addressLabel')}
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          rows={2}
          maxLength={500}
          hint={t('addressHint')}
        />
        <Input
          label={t('serviceDate')}
          type="date"
          value={serviceDate}
          min={check.serviceDateMin}
          max={check.serviceDateMax}
          onChange={(e) => setServiceDate(e.target.value)}
          hint={t('serviceDateHint')}
          fieldClassName="pos-handout__field"
        />
      </div>
      {error && <p className="pos-handout__warn" role="alert">{error}</p>}
      <Button type="submit" variant="primary" loading={busy === 'issue'} disabled={blocked}>
        {busy !== 'issue' && <Icon name="utensils" />}
        {t('issue')}
      </Button>
    </form>
  );
}
