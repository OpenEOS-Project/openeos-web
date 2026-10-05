import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

import type {
  SalesReport,
  ProductReport,
  PaymentReport,
  HourlyReport,
  ChannelReport,
  CategoryReport,
  DeviceReport,
} from '@/types/report';
import { formatCurrency, formatPercent } from '@/utils/format';
import type { ReportsFilter } from './reports-filter-bar';
import { formatReportDay, getChannelLabel, getMethodLabel, type ReportsT } from './report-labels';

export interface PdfExportInput {
  organizationName?: string;
  eventName?: string;
  filter: ReportsFilter;
  sales?: SalesReport;
  products?: ProductReport[];
  payments?: PaymentReport[];
  hourly?: HourlyReport[];
  channels?: ChannelReport[];
  categories?: CategoryReport[];
  devices?: DeviceReport[];
}

/** Sprache des Berichts: t = useTranslations('reports') und die UI-Sprache. */
export interface PdfExportI18n {
  t: ReportsT;
  locale: string;
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_LIMIT = PAGE_HEIGHT - 25;

// #1b5e20-Ton, passend zu var(--green-ink) der App
const GREEN_INK: [number, number, number] = [27, 94, 32];
const GREEN_BAR: [number, number, number] = [46, 125, 50];
const GREEN_ZEBRA: [number, number, number] = [240, 245, 241];

function formatShortDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function slugify(value: string, fallback: string): string {
  const combiningDiacritics = new RegExp('[\\u0300-\\u036f]', 'g');
  const slug = value
    .normalize('NFKD')
    .replace(combiningDiacritics, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return slug || fallback;
}

function buildFilename(input: PdfExportInput, { t }: PdfExportI18n): string {
  if (input.eventName) {
    return t('pdf.filename.event', { slug: slugify(input.eventName, t('pdf.filename.fallbackSlug')) });
  }
  const { timeRange, startDate, endDate } = input.filter;
  if (timeRange === 'today') {
    return t('pdf.filename.today', { date: new Date().toISOString().split('T')[0] });
  }
  if (timeRange === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return t('pdf.filename.yesterday', { date: yesterday.toISOString().split('T')[0] });
  }
  if (timeRange === 'all') {
    return t('pdf.filename.all');
  }
  const s = startDate ? startDate.split('T')[0] : t('pdf.filename.openStart');
  const e = endDate ? endDate.split('T')[0] : t('pdf.filename.openEnd');
  return t('pdf.filename.range', { start: s, end: e });
}

function formatPeriodLabel(input: PdfExportInput, { t, locale }: PdfExportI18n): string {
  const parts: string[] = [];
  if (input.eventName) parts.push(input.eventName);

  const { timeRange, startDate, endDate } = input.filter;
  if (timeRange === 'all') {
    parts.push(t('pdf.period.all'));
  } else if (timeRange === 'today') {
    parts.push(t('pdf.period.today', { date: formatShortDate(new Date(), locale) }));
  } else if (timeRange === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    parts.push(t('pdf.period.yesterday', { date: formatShortDate(yesterday, locale) }));
  } else if (startDate || endDate) {
    const s = startDate ? formatShortDate(new Date(startDate), locale) : '…';
    const e = endDate ? formatShortDate(new Date(endDate.split('T')[0]), locale) : '…';
    parts.push(t('pdf.period.range', { start: s, end: e }));
  }
  return parts.join(' · ');
}

async function loadImageAsDataUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function ensureSpace(doc: jsPDF, cursorY: number, needed: number): number {
  if (cursorY + needed > BOTTOM_LIMIT) {
    doc.addPage();
    return MARGIN;
  }
  return cursorY;
}

async function drawHeader(doc: jsPDF, input: PdfExportInput, i18n: PdfExportI18n): Promise<number> {
  const cursorY = MARGIN;
  const logoDataUrl = await loadImageAsDataUrl('/logo_dark.png');
  const logoWidth = 42;
  const logoHeight = logoWidth * (150 / 500);

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', MARGIN, cursorY, logoWidth, logoHeight);
    } catch {
      // Broken/undecodable image — continue without it rather than failing the export.
    }
  }

  const textX = logoDataUrl ? MARGIN + logoWidth + 8 : MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text(i18n.t('title'), textX, cursorY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  if (input.organizationName) {
    doc.text(input.organizationName, textX, cursorY + 15);
  }

  doc.setFontSize(9);
  doc.text(formatPeriodLabel(input, i18n), textX, cursorY + 20.5);

  const afterHeaderY = MARGIN + Math.max(logoHeight, 22) + 5;

  doc.setDrawColor(...GREEN_INK);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, afterHeaderY, PAGE_WIDTH - MARGIN, afterHeaderY);

  return afterHeaderY + 8;
}

function drawKpiBoxes(
  doc: jsPDF,
  cursorY: number,
  sales: SalesReport | undefined,
  { t, locale }: PdfExportI18n,
): number {
  cursorY = ensureSpace(doc, cursorY, 26);

  const boxes: { label: string; value: string }[] = [
    { label: t('pdf.kpi.revenue'), value: sales ? formatCurrency(sales.totalRevenue, locale) : '–' },
    { label: t('pdf.kpi.orders'), value: sales ? String(sales.totalOrders) : '–' },
    { label: t('pdf.kpi.avgReceipt'), value: sales ? formatCurrency(sales.averageOrderValue, locale) : '–' },
    { label: t('pdf.kpi.pfand'), value: sales ? formatCurrency(sales.pfandBalance, locale) : '–' },
    { label: t('pdf.kpi.cancellationRate'), value: sales ? formatPercent(sales.cancellationRate, locale) : '–' },
  ];

  const gap = 4;
  const boxWidth = (CONTENT_WIDTH - gap * (boxes.length - 1)) / boxes.length;
  const boxHeight = 20;

  boxes.forEach((box, i) => {
    const x = MARGIN + i * (boxWidth + gap);
    doc.setDrawColor(220, 225, 220);
    doc.setFillColor(247, 250, 247);
    doc.roundedRect(x, cursorY, boxWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 100, 90);
    doc.text(box.label, x + 3, cursorY + 6.5, { maxWidth: boxWidth - 6 });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(box.value, x + 3, cursorY + 15, { maxWidth: boxWidth - 6 });
  });

  return cursorY + boxHeight + 10;
}

// Zeichnet ein 24h-Balkendiagramm für genau einen Tag ab cursorY.
function drawSingleDayChart(doc: jsPDF, cursorY: number, rows: HourlyReport[]): number {
  const chartHeight = 40;
  const chartTop = cursorY;
  const chartBottom = chartTop + chartHeight;

  const hours = Array.from({ length: 24 }, (_, h) => rows.find((r) => r.hour === h) ?? { date: '', hour: h, orders: 0, revenue: 0 });
  const maxRevenue = Math.max(...hours.map((h) => h.revenue), 1);
  const barGap = 0.6;
  const barWidth = CONTENT_WIDTH / 24 - barGap;

  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, chartBottom, MARGIN + CONTENT_WIDTH, chartBottom);

  hours.forEach((h, i) => {
    const barHeight = (h.revenue / maxRevenue) * (chartHeight - 4);
    if (barHeight <= 0) return;
    const x = MARGIN + i * (barWidth + barGap);
    doc.setFillColor(...GREEN_BAR);
    doc.rect(x, chartBottom - barHeight, barWidth, barHeight, 'F');
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(130, 130, 130);
  for (let h = 0; h < 24; h += 3) {
    const x = MARGIN + h * (barWidth + barGap) + barWidth / 2;
    doc.text(`${h}`, x, chartBottom + 4, { align: 'center' });
  }

  return chartBottom + 10;
}

function drawHourlyChart(doc: jsPDF, cursorY: number, hourly: HourlyReport[], { t, locale }: PdfExportI18n): number {
  cursorY = ensureSpace(doc, cursorY, 58);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(t('pdf.hourlyTitle'), MARGIN, cursorY);
  cursorY += 6;

  const hasData = hourly.length > 0 && hourly.some((h) => h.revenue > 0);
  if (!hasData) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(t('pdf.hourlyEmpty'), MARGIN, cursorY + 20);
    return cursorY + 50;
  }

  // Nach Tag gruppieren — mehrtägige Veranstaltungen bekommen ein Diagramm je Tag.
  const byDate = new Map<string, HourlyReport[]>();
  for (const r of hourly) {
    const date = r.date ?? '';
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(r);
  }
  const dates = Array.from(byDate.keys()).sort();
  const isMultiDay = dates.length > 1;

  for (const date of dates) {
    // Tageskopf + Diagramm nicht über den Seitenumbruch reißen
    cursorY = ensureSpace(doc, cursorY, isMultiDay ? 56 : 50);
    if (isMultiDay) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(90, 90, 90);
      doc.text(formatReportDay(date, locale), MARGIN, cursorY);
      cursorY += 5;
    }
    cursorY = drawSingleDayChart(doc, cursorY, byDate.get(date)!);
  }

  return cursorY;
}

function addTableSection(
  doc: jsPDF,
  cursorY: number,
  title: string,
  head: string[],
  body: string[][],
  emptyLabel: string,
  rightAlignCols: number[] = [],
): number {
  cursorY = ensureSpace(doc, cursorY, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(title, MARGIN, cursorY);
  cursorY += 4;

  if (body.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(emptyLabel, MARGIN, cursorY + 4);
    return cursorY + 14;
  }

  const columnStyles: Record<number, { halign: 'right' }> = {};
  rightAlignCols.forEach((i) => {
    columnStyles[i] = { halign: 'right' };
  });

  autoTable(doc, {
    startY: cursorY,
    head: [head],
    body,
    margin: { left: MARGIN, right: MARGIN, bottom: 20 },
    styles: { fontSize: 9, cellPadding: 2.5, textColor: [30, 30, 30] },
    headStyles: { fillColor: GREEN_INK, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: GREEN_ZEBRA },
    columnStyles,
    theme: 'striped',
  });

  // jspdf-autotable sets this on the document instance after each call.
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;
  return finalY + 10;
}

function addFooters(doc: jsPDF, { t, locale }: PdfExportI18n): void {
  const pageCount = doc.getNumberOfPages();
  const generatedAt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(t('pdf.generatedAt', { date: generatedAt }), MARGIN, PAGE_HEIGHT - 10);
    doc.text(t('pdf.page', { page: i, total: pageCount }), PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10, { align: 'right' });
  }
}

/**
 * Builds a multi-page A4 PDF report from the same data already loaded on the
 * reports page and triggers a browser download. Safe to call with empty/
 * undefined report data — sections render a "no data" note instead of a table.
 */
export async function generateReportsPdf(input: PdfExportInput, i18n: PdfExportI18n): Promise<void> {
  const { t, locale } = i18n;
  const money = (amount: number) => formatCurrency(amount, locale);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  let cursorY = await drawHeader(doc, input, i18n);
  cursorY = drawKpiBoxes(doc, cursorY, input.sales, i18n);
  cursorY = drawHourlyChart(doc, cursorY, input.hourly ?? [], i18n);

  cursorY = addTableSection(
    doc,
    cursorY,
    t('payments.title'),
    [
      t('payments.columns.method'),
      t('payments.columns.count'),
      t('payments.columns.total'),
      t('payments.columns.percentage'),
    ],
    (input.payments ?? []).map((p) => [
      getMethodLabel(p.method, t),
      String(p.count),
      money(p.total),
      formatPercent(p.percentage, locale),
    ]),
    t('payments.empty'),
    [1, 2, 3],
  );

  cursorY = addTableSection(
    doc,
    cursorY,
    t('products.title'),
    [
      t('products.columns.product'),
      t('products.columns.category'),
      t('products.columns.quantity'),
      t('products.columns.revenue'),
      t('products.columns.avgPrice'),
    ],
    (input.products ?? []).map((p) => [
      p.productName,
      p.categoryName,
      String(p.quantitySold),
      money(p.revenue),
      money(p.averagePrice),
    ]),
    t('products.empty'),
    [2, 3, 4],
  );

  cursorY = addTableSection(
    doc,
    cursorY,
    t('channels.title'),
    [
      t('channels.columns.channel'),
      t('channels.columns.orders'),
      t('channels.columns.revenue'),
      t('channels.columns.avgReceipt'),
    ],
    (input.channels ?? []).map((c) => [
      getChannelLabel(c.channel, t),
      String(c.orders),
      money(c.revenue),
      money(c.avgReceipt),
    ]),
    t('channels.empty'),
    [1, 2, 3],
  );

  cursorY = addTableSection(
    doc,
    cursorY,
    t('categories.title'),
    [t('categories.columns.category'), t('categories.columns.quantity'), t('categories.columns.revenue')],
    (input.categories ?? []).map((c) => [c.name, String(c.quantity), money(c.revenue)]),
    t('categories.empty'),
    [1, 2],
  );

  cursorY = addTableSection(
    doc,
    cursorY,
    t('devices.title'),
    [t('devices.columns.device'), t('devices.columns.orders'), t('devices.columns.revenue')],
    (input.devices ?? []).map((d) => [d.name, String(d.orders), money(d.revenue)]),
    t('devices.empty'),
    [1, 2],
  );

  addFooters(doc, i18n);

  doc.save(buildFilename(input, i18n));
}
