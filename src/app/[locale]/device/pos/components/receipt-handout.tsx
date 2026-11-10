'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { Button, Icon, Input } from '@openeos/ui';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { deviceApi } from '@/lib/api-client';
import { looksLikeEmail } from '@/lib/receipt';
import '@/styles/pos-receipt.css';

import { usePosToast } from './pos-toast';


export type HandoutView = 'menu' | 'qr' | 'email';

interface ReceiptHandoutProps {
  orderIds: string[];
  /** Bondrucker vorhanden? Sonst kein „Bon drucken“. */
  canPrint: boolean;
  /** Bon wurde schon automatisch gedruckt („Bon erneut drucken“). */
  autoPrinted?: boolean;
  onPrint: () => void;
  printing: boolean;
  /** Ein Beleg wurde ausgegeben (QR gezeigt, Mail verschickt, gedruckt). */
  onHandedOut?: () => void;
  /** Erste Interaktion (das Abschlussblatt schließt sich dann nicht mehr von selbst). */
  onInteract?: () => void;
  /** Weitere Knöpfe im Menü (z. B. „Bewirtungsbeleg“). */
  extra?: ReactNode;
  /** Ansicht von außen setzen (z. B. für den Bewirtungsbeleg). */
  view?: HandoutView;
  onViewChange?: (view: HandoutView) => void;
  /**
   * QR-Code sofort zeigen (nach der Zahlung): Der Beleg wird erstellt und
   * zum Abruf angeboten (AEAO zu § 146a Nr. 2.5.3/2.5.4).
   */
  autoQr?: boolean;
  /** „Kein Beleg“: der Gast möchte keinen — schließt nur das Blatt. */
  onNoReceipt?: () => void;
}

/**
 * „Beleg“ nach der Zahlung (Belegausgabepflicht § 146a Abs. 2 AO): QR-Code
 * zum Scannen, E-Mail oder Bon drucken. Ein elektronischer Beleg braucht
 * die Zustimmung des Gastes — deshalb wählt der Gast den Weg.
 */
export function ReceiptHandout({
  orderIds,
  canPrint,
  autoPrinted = false,
  onPrint,
  printing,
  onHandedOut,
  onInteract,
  extra,
  view: controlledView,
  onViewChange,
  autoQr = false,
  onNoReceipt,
}: ReceiptHandoutProps) {
  const t = useTranslations('pos.receiptHandout');
  const locale = useLocale();
  const toast = usePosToast();
  const apiErrorMessage = useApiErrorMessage();
  const [ownView, setOwnView] = useState<HandoutView>(autoQr ? 'qr' : 'menu');
  const view = controlledView ?? ownView;
  const setView = (next: HandoutView) => {
    setOwnView(next);
    onViewChange?.(next);
  };
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const openQr = async () => {
    onInteract?.();
    setView('qr');
    if (link) return;
    setLoadingLink(true);
    try {
      const res = await deviceApi.receiptLink(orderIds);
      if (res.data) setLink(res.data);
      onHandedOut?.();
    } catch (error) {
      toast(apiErrorMessage(error), 'danger');
      setView('menu');
    } finally {
      setLoadingLink(false);
    }
  };

  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoQr || autoStarted.current) return;
    autoStarted.current = true;
    void (async () => {
      setLoadingLink(true);
      try {
        const res = await deviceApi.receiptLink(orderIds);
        if (res.data) setLink(res.data);
      } catch {
        // Ohne Link bleibt „QR-Code“ als Knopf; Drucken/E-Mail gehen weiter.
        setView('menu');
      } finally {
        setLoadingLink(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoQr]);

  const send = async () => {
    const address = email.trim();
    if (!looksLikeEmail(address)) {
      setEmailError(t('emailInvalid'));
      return;
    }
    setEmailError(null);
    setSending(true);
    try {
      await deviceApi.receiptEmail(orderIds, address);
      toast(t('emailSent'));
      setEmail('');
      setView(link ? 'qr' : 'menu');
      onHandedOut?.();
    } catch (error) {
      setEmailError(apiErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const until = link
    ? new Date(link.expiresAt).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  /** Wege, den Beleg auszugeben (im QR-Blick ohne den QR-Knopf). */
  const choices = (withQr: boolean) => (
    <div className="pos-handout__choices">
      {withQr && (
        <Button variant="secondary" onClick={() => void openQr()}>
          <Icon name="qr" />
          {t('qr')}
        </Button>
      )}
      <Button
        variant="secondary"
        onClick={() => {
          onInteract?.();
          setView('email');
        }}
      >
        <Icon name="mail" />
        {t('email')}
      </Button>
      {canPrint && (
        <Button
          variant="secondary"
          loading={printing}
          onClick={() => {
            onInteract?.();
            onPrint();
            onHandedOut?.();
          }}
        >
          {!printing && <Icon name="print" />}
          {autoPrinted ? t('reprint') : t('print')}
        </Button>
      )}
      {extra}
      {onNoReceipt && (
        <Button variant="ghost" onClick={onNoReceipt} data-testid="receipt-none">
          <Icon name="x" />
          {t('none')}
        </Button>
      )}
    </div>
  );

  if (view === 'qr') {
    return (
      <div className="pos-handout pos-handout--qr" data-testid="receipt-handout-qr">
        <p className="pos-handout__lead">{t('qrLead')}</p>
        <div className="pos-handout__qr">
          {link ? (
            <QRCodeSVG value={link.url} size={220} level="M" marginSize={2} title={t('qrTitle')} />
          ) : (
            <span className="pos-handout__qr-wait" aria-busy={loadingLink}>
              {t('qrLoading')}
            </span>
          )}
        </div>
        {link && <p className="pos-handout__fine">{t('qrValid', { date: until })}</p>}
        {choices(false)}
      </div>
    );
  }

  if (view === 'email') {
    return (
      <form
        className="pos-handout pos-handout--email"
        data-testid="receipt-handout-email"
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
          placeholder={t('emailPlaceholder')}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          error={emailError ?? undefined}
          hint={emailError ? undefined : t('emailHint')}
          autoFocus
          maxLength={254}
          fieldClassName="pos-handout__field"
        />
        <div className="pos-handout__row">
          <Button type="button" variant="ghost" onClick={() => setView(link ? 'qr' : 'menu')}>
            <Icon name="chevron-left" />
            {t('back')}
          </Button>
          <Button type="submit" variant="primary" className="oe-grow" loading={sending}>
            {!sending && <Icon name="send" />}
            {t('emailSend')}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="pos-handout" data-testid="receipt-handout">
      <span className="pos-handout__title">{t('title')}</span>
      {choices(true)}
    </div>
  );
}
