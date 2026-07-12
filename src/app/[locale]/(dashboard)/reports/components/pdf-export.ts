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
import { formatCurrency } from '@/utils/format';
import type { ReportsFilter } from './reports-filter-bar';

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

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_LIMIT = PAGE_HEIGHT - 25;

// #1b5e20-Ton, passend zu var(--green-ink) der App
const GREEN_INK: [number, number, number] = [27, 94, 32];
const GREEN_BAR: [number, number, number] = [46, 125, 50];
const GREEN_ZEBRA: [number, number, number] = [240, 245, 241];

const CHANNEL_LABELS: Record<string, string> = {
  pos: 'Kasse',
  online: 'Online-Shop',
  qr_order: 'QR-Bestellung',
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Bar',
  card: 'Karte',
  voucher: 'Gutschein',
  online: 'Online',
  free: 'Kostenlos',
};

function getChannelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

function getMethodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method;
}

function formatDateDe(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function slugify(value: string): string {
  const combiningDiacritics = new RegExp('[\\u0300-\\u036f]', 'g');
  const slug = value
    .normalize('NFKD')
    .replace(combiningDiacritics, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return slug || 'auswertung';
}

function buildFilename(input: PdfExportInput): string {
  if (input.eventName) {
    return `openeos-auswertung-${slugify(input.eventName)}.pdf`;
  }
  const { timeRange, startDate, endDate } = input.filter;
  if (timeRange === 'today') {
    return `openeos-auswertung-heute-${new Date().toISOString().split('T')[0]}.pdf`;
  }
  if (timeRange === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return `openeos-auswertung-gestern-${yesterday.toISOString().split('T')[0]}.pdf`;
  }
  if (timeRange === 'all') {
    return 'openeos-auswertung-gesamt.pdf';
  }
  const s = startDate ? startDate.split('T')[0] : 'start';
  const e = endDate ? endDate.split('T')[0] : 'ende';
  return `openeos-auswertung-${s}-bis-${e}.pdf`;
}

function formatPeriodLabel(input: PdfExportInput): string {
  const parts: string[] = [];
  if (input.eventName) parts.push(input.eventName);

  const { timeRange, startDate, endDate } = input.filter;
  if (timeRange === 'all') {
    parts.push('Gesamter Zeitraum');
  } else if (timeRange === 'today') {
    parts.push(`Heute (${formatDateDe(new Date())})`);
  } else if (timeRange === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    parts.push(`Gestern (${formatDateDe(yesterday)})`);
  } else if (startDate || endDate) {
    const s = startDate ? formatDateDe(new Date(startDate)) : '…';
    const e = endDate ? formatDateDe(new Date(endDate.split('T')[0])) : '…';
    parts.push(`${s} – ${e}`);
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

async function drawHeader(doc: jsPDF, input: PdfExportInput): Promise<number> {
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
  doc.text('Auswertung', textX, cursorY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  if (input.organizationName) {
    doc.text(input.organizationName, textX, cursorY + 15);
  }

  doc.setFontSize(9);
  doc.text(formatPeriodLabel(input), textX, cursorY + 20.5);

  const afterHeaderY = MARGIN + Math.max(logoHeight, 22) + 5;

  doc.setDrawColor(...GREEN_INK);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, afterHeaderY, PAGE_WIDTH - MARGIN, afterHeaderY);

  return afterHeaderY + 8;
}

function drawKpiBoxes(doc: jsPDF, cursorY: number, sales: SalesReport | undefined): number {
  cursorY = ensureSpace(doc, cursorY, 26);

  const boxes: { label: string; value: string }[] = [
    { label: 'Umsatz', value: sales ? formatCurrency(sales.totalRevenue) : '–' },
    { label: 'Bestellungen', value: sales ? String(sales.totalOrders) : '–' },
    { label: 'Ø Bon', value: sales ? formatCurrency(sales.averageOrderValue) : '–' },
    { label: 'Pfand', value: sales ? formatCurrency(sales.pfandBalance) : '–' },
    { label: 'Storno-Quote', value: sales ? `${sales.cancellationRate.toFixed(1)}%` : '–' },
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

function drawHourlyChart(doc: jsPDF, cursorY: number, hourly: HourlyReport[]): number {
  cursorY = ensureSpace(doc, cursorY, 58);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text('Stunden-Umsatz', MARGIN, cursorY);
  cursorY += 6;

  const chartHeight = 40;
  const chartTop = cursorY;
  const chartBottom = chartTop + chartHeight;

  const hasData = hourly.length > 0 && hourly.some((h) => h.revenue > 0);

  if (!hasData) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('Keine Umsatzdaten für den gewählten Zeitraum', MARGIN, chartTop + chartHeight / 2);
    return chartBottom + 10;
  }

  const hours = Array.from({ length: 24 }, (_, h) => hourly.find((r) => r.hour === h) ?? { hour: h, orders: 0, revenue: 0 });
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
    const y = chartBottom - barHeight;
    doc.setFillColor(...GREEN_BAR);
    doc.rect(x, y, barWidth, barHeight, 'F');
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

function addFooters(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const generatedAt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Erstellt am ${generatedAt} · OpenEOS`, MARGIN, PAGE_HEIGHT - 10);
    doc.text(`Seite ${i} / ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10, { align: 'right' });
  }
}

/**
 * Builds a multi-page A4 PDF report from the same data already loaded on the
 * reports page and triggers a browser download. Safe to call with empty/
 * undefined report data — sections render a "no data" note instead of a table.
 */
export async function generateReportsPdf(input: PdfExportInput): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  let cursorY = await drawHeader(doc, input);
  cursorY = drawKpiBoxes(doc, cursorY, input.sales);
  cursorY = drawHourlyChart(doc, cursorY, input.hourly ?? []);

  cursorY = addTableSection(
    doc,
    cursorY,
    'Zahlarten',
    ['Zahlart', 'Anzahl', 'Gesamt', 'Anteil'],
    (input.payments ?? []).map((p) => [
      getMethodLabel(p.method),
      String(p.count),
      formatCurrency(p.total),
      `${p.percentage.toFixed(1)}%`,
    ]),
    'Keine Zahlungsdaten vorhanden',
    [1, 2, 3],
  );

  cursorY = addTableSection(
    doc,
    cursorY,
    'Top-Produkte',
    ['Produkt', 'Kategorie', 'Menge', 'Umsatz', 'Ø-Preis'],
    (input.products ?? []).map((p) => [
      p.productName,
      p.categoryName,
      String(p.quantitySold),
      formatCurrency(p.revenue),
      formatCurrency(p.averagePrice),
    ]),
    'Keine Produktdaten vorhanden',
    [2, 3, 4],
  );

  cursorY = addTableSection(
    doc,
    cursorY,
    'Umsatz nach Kanal',
    ['Kanal', 'Bestellungen', 'Umsatz', 'Ø Bon'],
    (input.channels ?? []).map((c) => [
      getChannelLabel(c.channel),
      String(c.orders),
      formatCurrency(c.revenue),
      formatCurrency(c.avgReceipt),
    ]),
    'Keine Kanaldaten vorhanden',
    [1, 2, 3],
  );

  cursorY = addTableSection(
    doc,
    cursorY,
    'Top-Kategorien',
    ['Kategorie', 'Menge', 'Umsatz'],
    (input.categories ?? []).map((c) => [c.name, String(c.quantity), formatCurrency(c.revenue)]),
    'Keine Kategoriedaten vorhanden',
    [1, 2],
  );

  cursorY = addTableSection(
    doc,
    cursorY,
    'Umsatz je Kasse',
    ['Gerät', 'Bestellungen', 'Umsatz'],
    (input.devices ?? []).map((d) => [d.name, String(d.orders), formatCurrency(d.revenue)]),
    'Keine Gerätedaten vorhanden',
    [1, 2],
  );

  addFooters(doc);

  doc.save(buildFilename(input));
}
