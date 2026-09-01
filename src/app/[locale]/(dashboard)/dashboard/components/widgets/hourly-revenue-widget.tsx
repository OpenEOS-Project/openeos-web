'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useHourlyReport } from '@/hooks/use-reports';
import { formatCurrency } from '@/utils/format';
import { useDashboardRange } from '../dashboard-range';

interface Props {
  organizationId: string;
}

interface Punkt {
  hour: string;
  /** Balken: Umsatz der Stunde. Null ab der Prognose. */
  revenue: number | null;
  /** Linie: derselbe Verlauf, damit die Spitzen ablesbar bleiben. */
  trend: number | null;
  /** Gestrichelte Fortschreibung nach der letzten belegten Stunde. */
  forecast: number | null;
}

/**
 * Fortschreibung der nächsten Stunde.
 *
 * Bewusst simpel: Mittel der Veränderung über die letzten drei belegten
 * Stunden, fortgeschrieben um einen Schritt und bei null gekappt. Das
 * ist keine Vorhersage im statistischen Sinn, sondern eine sichtbar
 * gestrichelte Verlängerung der Kurve — deshalb auch nur ein Schritt.
 * Mehr würde eine Genauigkeit vortäuschen, die die Datenlage nicht
 * hergibt.
 */
function fortschreibung(werte: number[]): number | null {
  if (werte.length < 3) return null;
  const letzte = werte.slice(-3);
  const deltas = letzte.slice(1).map((v, i) => v - letzte[i]!);
  const schnitt = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return Math.max(0, (letzte[letzte.length - 1] ?? 0) + schnitt);
}

export function HourlyRevenueWidget({ organizationId }: Props) {
  const t = useTranslations('dashboard');
  const range = useDashboardRange();

  const { data, isLoading } = useHourlyReport(organizationId, range.query);

  const chartData = useMemo<Punkt[]>(() => {
    if (!data || data.length === 0) return [];

    /* Mehrtägige Zeiträume liefern dieselbe Stunde mehrfach — hier
       aufsummieren, sonst stünde jede Stunde doppelt auf der Achse. */
    const proStunde = new Map<number, number>();
    for (const row of data) {
      proStunde.set(row.hour, (proStunde.get(row.hour) ?? 0) + row.revenue);
    }

    /* Auf die Stunden mit Umsatz eingrenzen. Die API liefert den
       ganzen Tag; die leeren Randstunden erzeugen sonst eine lange
       Nulllinie, die den eigentlichen Verlauf zusammenstaucht.
       Je eine Stunde Rand bleibt als Kontext stehen. */
    const belegt = [...proStunde.entries()]
      .filter(([, umsatz]) => umsatz > 0)
      .map(([h]) => h)
      .sort((a, b) => a - b);
    if (belegt.length === 0) return [];

    const von = Math.max(0, (belegt[0] ?? 0) - 1);
    const bis = Math.min(23, (belegt[belegt.length - 1] ?? 0) + 1);
    /* Die Prognose knuepft an die letzte Stunde MIT Umsatz an, nicht an
       das Ende der Reihe — sonst faellt sie bei einem vollen Tag weg. */
    const letzteMitUmsatz = belegt[belegt.length - 1] ?? 0;

    /* Lücken auffüllen: eine Stunde ohne Umsatz ist eine Null, keine
       fehlende Kategorie — sonst rückt die Achse zusammen und der
       Tagesverlauf wird unlesbar. */
    const reihe: Punkt[] = [];
    for (let h = von; h <= bis; h++) {
      const wert = proStunde.get(h) ?? 0;
      reihe.push({
        hour: `${String(h).padStart(2, '0')}:00`,
        revenue: wert,
        trend: wert,
        forecast: null,
      });
    }

    /* Fortschreibung aus den belegten Stunden, nicht aus der
       aufgefuellten Reihe — angehaengte Nullen wuerden den Trend nach
       unten ziehen. */
    const prognose = fortschreibung(belegt.map((h) => proStunde.get(h) ?? 0));
    if (prognose !== null && letzteMitUmsatz < 23) {
      const anknuepfung = reihe.find((p) => p.hour === `${String(letzteMitUmsatz).padStart(2, '0')}:00`);
      /* Am letzten echten Punkt ansetzen, sonst begaenne die
         gestrichelte Linie im Nichts. */
      if (anknuepfung) anknuepfung.forecast = anknuepfung.revenue;
      const naechste = `${String(letzteMitUmsatz + 1).padStart(2, '0')}:00`;
      const vorhanden = reihe.find((p) => p.hour === naechste);
      if (vorhanden) {
        vorhanden.forecast = prognose;
        vorhanden.revenue = null;
        vorhanden.trend = null;
      } else {
        reihe.push({ hour: naechste, revenue: null, trend: null, forecast: prognose });
      }
    }

    return reihe;
  }, [data]);

  const spitze = useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData.reduce((max, p) => ((p.revenue ?? 0) > (max.revenue ?? 0) ? p : max));
  }, [chartData]);

  return (
    <div className="app-card app-card--flat chart-card">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('widgets.hourlyRevenue.label')}</h2>
          <p className="app-card__sub">{t('widgets.hourlyRevenue.subtitle', { period: t(`range.period.${range.key}`) })}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="widget-state">
          <span className="oe-spinner" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="widget-state">
          <p className="empty-state__sub">{t('widgets.empty')}</p>
        </div>
      ) : (
        <>
          {/* Höhe aus dem Container statt fester Pixel: die Kachel ist
              in der Größe veränderbar, ein starres Diagramm darin nicht. */}
          <div className="chart-card__plot">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--oe-line)"
                  vertical={false}
                />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 11, fill: 'var(--mute)' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis
                  tickFormatter={(v: number) => formatCurrency(v)}
                  tick={{ fontSize: 11, fill: 'var(--mute)' }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(Number(value)),
                    name === 'forecast'
                      ? t('widgets.hourlyRevenue.forecastLabel')
                      : t('widgets.hourlyRevenue.revenueLabel'),
                  ]}
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--oe-line-2)',
                    borderRadius: 'var(--oe-r-sm)',
                    fontSize: 12,
                    color: 'var(--ink)',
                  }}
                  cursor={{ fill: 'color-mix(in oklab, var(--ink) 5%, transparent)' }}
                />
                {/* Weiche Fläche mit Kontur wie in der Vorlage — der
                    massive Block davor erschlug den Kurvenverlauf. */}
                <Bar
                  dataKey="revenue"
                  fill="var(--oe-green-soft)"
                  stroke="color-mix(in oklab, var(--oe-green-ink) 22%, transparent)"
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="trend"
                  stroke="var(--ink)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="forecast"
                  stroke="var(--mute)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 3, fill: 'var(--oe-green-ink)', stroke: 'none' }}
                  connectNulls
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card__legend">
            <span>
              <i style={{ background: 'var(--oe-green-soft)' }} />
              {t('widgets.hourlyRevenue.legendBars')}
            </span>
            <span>
              <i style={{ background: 'var(--ink)' }} />
              {t('widgets.hourlyRevenue.legendTrend')}
            </span>
            <span>
              <i style={{ background: 'var(--mute)' }} />
              {t('widgets.hourlyRevenue.legendForecast')}
            </span>
          </div>

          {spitze && (spitze.revenue ?? 0) > 0 && (
            <div className="app-card__foot">
              <span className="oe-small">
                {t('widgets.hourlyRevenue.peak', {
                  hour: spitze.hour,
                  amount: formatCurrency(spitze.revenue ?? 0),
                })}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
