/**
 * Beschriftungen fuer Zahlarten und Bestellkanaele der Auswertung.
 *
 * Tabellen und PDF-Export zeigen dieselben Namen; sie kommen aus dem
 * Namespace `reports` (t = useTranslations('reports')). Markennamen
 * bleiben unuebersetzt, unbekannte Rohwerte werden durchgereicht.
 */
export type ReportsT = (key: string, values?: Record<string, string | number>) => string;

const BRAND_METHOD_LABELS: Record<string, string> = {
  paypal: 'PayPal',
  google_pay: 'Google Pay',
  apple_pay: 'Apple Pay',
};

export function getMethodLabel(method: string, t: ReportsT): string {
  switch (method) {
    case 'cash':
      return t('paymentMethods.cash');
    case 'card':
      return t('paymentMethods.card');
    case 'sumup_terminal':
      return t('paymentMethods.sumupTerminal');
    case 'sumup_online':
      return t('paymentMethods.sumupOnline');
    case 'voucher':
      return t('paymentMethods.voucher');
    case 'online':
      return t('paymentMethods.online');
    case 'free':
      return t('paymentMethods.free');
    default:
      return BRAND_METHOD_LABELS[method] ?? method;
  }
}

export function getChannelLabel(channel: string, t: ReportsT): string {
  switch (channel) {
    case 'pos':
      return t('channelLabels.pos');
    case 'online':
      return t('channelLabels.online');
    case 'qr_order':
      return t('channelLabels.qrOrder');
    default:
      return channel;
  }
}

/** 'YYYY-MM-DD' (bereits lokale Zeit vom Server) ohne TZ-Verschiebung parsen. */
export function formatReportDay(date: string, locale: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
