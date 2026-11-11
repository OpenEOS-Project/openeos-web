'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { DataColumn } from '@openeos/ui';

import type { VatReport, VatReportRow } from '@/types/report';
import { formatCurrency } from '@/utils/format';
import { AdminTable } from '@/components/shared/admin-table';
import { downloadCsv } from './csv-export';
import { PhoneLabel, ReportCardHead, ReportLoading } from './report-table';

/** Zeile der Tabelle: ein Steuersatz oder (rate = null) die Summe. */
type VatLine = Omit<VatReportRow, 'rate'> & { rate: number | null };

interface ReportsVatTableProps {
  data: VatReport | undefined;
  isLoading: boolean;
  /** „Nur Bons“: keine Beträge — die Karte entfällt. */
  orderOnly?: boolean;
}

/**
 * Umsatz und Umsatzsteuer je Steuersatz. Pfand gehört zum Entgelt
 * (Abschn. 10.1 Abs. 8 UStAE) und steht beim Satz seiner Pfandart;
 * Rückgaben mindern Umsatz und Steuer zum selben Satz (gegen den
 * Pfand-Altsaldo bei 0 %). Trinkgeld an den Verein ist Entgelt und steht
 * anteilig beim Satz der Ware; Trinkgeld angestellter Bedienungen nur als
 * Vermerk darunter. Ware, Pfand, Rückgaben und Trinkgeld stehen getrennt,
 * damit nachvollziehbar bleibt, woraus sich die Summe je Satz ergibt.
 */
export function ReportsVatTable({ data, isLoading, orderOnly = false }: ReportsVatTableProps) {
  const t = useTranslations('reports');
  const locale = useLocale();

  if (orderOnly) return null;

  const money = (value: number) => formatCurrency(value, locale);
  const rows = data?.rows ?? [];
  const hasLegacyDeposit = rows.some((r) => r.rate === 0 && (r.deposits !== 0 || r.depositReturns !== 0));
  const employeeTips = data?.employeeTips ?? 0;

  const handleExport = () => {
    if (!data || rows.length === 0) return;
    const headers = [
      t('vat.columns.rate'),
      t('vat.columns.goods'),
      t('vat.columns.deposits'),
      t('vat.columns.depositReturns'),
      t('vat.columns.tips'),
      t('vat.columns.gross'),
      t('vat.columns.net'),
      t('vat.columns.tax'),
    ];
    const csvRows = [
      ...rows.map((r) => [r.rate, r.goods, r.deposits, r.depositReturns, r.tips ?? 0, r.gross, r.net, r.tax]),
      [
        t('vat.total'),
        data.total.goods,
        data.total.deposits,
        data.total.depositReturns,
        data.total.tips ?? 0,
        data.total.gross,
        data.total.net,
        data.total.tax,
      ],
    ];
    downloadCsv(t('export.filenames.vat'), headers, csvRows);
  };

  /* Die Summe bleibt wie bisher die letzte Zeile der Tabelle (DataTable
     kennt keine Summenzeile im Fuß); so steht jede Summe unter ihrer Spalte. */
  const lines: VatLine[] = data ? [...rows, { ...data.total, rate: null }] : [];
  const amount = (line: VatLine, key: keyof Omit<VatReportRow, 'rate'>) => money(line[key] ?? 0);

  const columns: DataColumn<VatLine>[] = [
    {
      id: 'rate',
      header: t('vat.columns.rate'),
      mobile: 'title',
      cell: (line) => (line.rate === null ? t('vat.total') : t('vat.rate', { rate: line.rate })),
    },
    { id: 'goods', header: t('vat.columns.goods'), num: true, priority: 2, cell: (line) => amount(line, 'goods') },
    { id: 'deposits', header: t('vat.columns.deposits'), num: true, priority: 3, cell: (line) => amount(line, 'deposits') },
    {
      id: 'depositReturns',
      header: t('vat.columns.depositReturns'),
      num: true,
      priority: 3,
      cell: (line) => amount(line, 'depositReturns'),
    },
    {
      id: 'tips',
      header: <span title={t('vat.columns.tipsHint')}>{t('vat.columns.tips')}</span>,
      num: true,
      priority: 2,
      cell: (line) => amount(line, 'tips'),
    },
    { id: 'gross', header: t('vat.columns.gross'), num: true, mobile: 'trailing', cell: (line) => amount(line, 'gross') },
    {
      id: 'net',
      header: t('vat.columns.net'),
      num: true,
      mobile: 'meta',
      cell: (line) => <PhoneLabel label={t('vat.columns.net')}>{amount(line, 'net')}</PhoneLabel>,
    },
    {
      id: 'tax',
      header: t('vat.columns.tax'),
      num: true,
      mobile: 'meta',
      cell: (line) => <PhoneLabel label={t('vat.columns.tax')}>{amount(line, 'tax')}</PhoneLabel>,
    },
  ];

  return (
    <div className="app-card app-card--flat" data-testid="reports-vat">
      <ReportCardHead
        title={t('vat.title')}
        subtitle={t('vat.subtitle')}
        onExport={handleExport}
        exportDisabled={rows.length === 0}
      />

      {isLoading ? (
        <ReportLoading />
      ) : !data || rows.length === 0 ? (
        <div className="empty-state">
          <h3 className="empty-state__title">{t('vat.empty')}</h3>
        </div>
      ) : (
        <>
          {data.vatExempt && (
            <p className="app-card__sub" style={{ padding: '12px 20px' }}>
              {t('vat.exempt')}
            </p>
          )}
          <AdminTable
            className="report-dt"
            caption={t('vat.title')}
            rows={lines}
            rowKey={(line) => (line.rate === null ? 'total' : String(line.rate))}
            columns={columns}
            rowClassName={(line) => (line.rate === null ? 'report-dt__total' : undefined)}
          />
          {hasLegacyDeposit && !data.vatExempt && (
            <p className="app-card__sub" style={{ padding: '12px 20px' }}>
              {t('vat.legacyHint')}
            </p>
          )}
          {employeeTips > 0 && (
            <p className="app-card__sub" style={{ padding: '0 20px 12px' }} data-testid="reports-vat-employee-tips">
              {t('vat.employeeTips', { amount: money(employeeTips) })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
