'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';
import { useQuery } from '@tanstack/react-query';
import { devicesApi } from '@/lib/api-client';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useActiveEvent } from '@/hooks/use-events';
import { useProductionStations } from '@/hooks/use-production-stations';
import { useTableAreas } from '@/hooks/use-tables';
import type { Device } from '@/types/device';
import '@/styles/device-settings.css';

interface DeviceOverviewProps {
  device: Device;
  organizationId: string;
}

const statusBadgeClass: Record<string, string> = {
  verified: 'badge badge--success',
  pending: 'badge badge--warning',
  blocked: 'badge badge--error',
};

/**
 * "vor 3 Minuten" statt "3m ago".
 *
 * Die Zeitangabe stand fest auf Englisch, mitten in einer deutschen
 * Oberflaeche. Intl kennt die Formulierung je Sprache — und die Regeln
 * dafuer (Einzahl, Mehrzahl, Wortstellung) sind nichts, was man je
 * Sprache selbst nachbauen sollte.
 */
function formatRelativeTime(dateStr: string | null | undefined, locale: string): string {
  if (!dateStr) return '-';

  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minuten = Math.floor(diffMs / 60000);
  const stunden = Math.floor(diffMs / 3600000);
  const tage = Math.floor(diffMs / 86400000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (minuten < 1) return rtf.format(0, 'minute');
  if (minuten < 60) return rtf.format(-minuten, 'minute');
  if (stunden < 24) return rtf.format(-stunden, 'hour');
  return rtf.format(-tage, 'day');
}

function StatCard({
  label,
  value,
  sub,
  children,
}: {
  label: string;
  value: string | number;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="app-card" style={{ padding: '20px 24px' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-.02em' }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', marginTop: 4, margin: 0 }}>
          {sub}
        </p>
      )}
      {children}
    </div>
  );
}

export function DeviceOverview({ device, organizationId }: DeviceOverviewProps) {
  const t = useTranslations();
  const { formatCurrency, formatDateTime, locale } = useLocaleFormat();

  const { data: statsData } = useQuery({
    queryKey: ['device-stats', organizationId, device.id],
    queryFn: () => devicesApi.getStats(organizationId, device.id),
    enabled: !!organizationId && !!device.id,
  });

  const { data: onlineIdsData } = useQuery({
    queryKey: ['devices-online', organizationId],
    queryFn: () => devicesApi.getOnlineIds(organizationId),
    enabled: !!organizationId,
    refetchInterval: 5000,
  });

  const stats = statsData?.data;
  const onlineDeviceIds = new Set(onlineIdsData?.data || []);
  const isOnline = onlineDeviceIds.has(device.id);

  /* Woran die Anzeige haengt. Fuer die Kundenanzeige ist das eine Kasse,
     deren Namen wir nachschlagen — die Geraete-ID allein sagt niemandem
     etwas. */
  const { data: geschwisterData } = useQuery({
    queryKey: ['devices', organizationId],
    queryFn: () => devicesApi.list(organizationId),
    enabled: !!organizationId && device.type === 'display',
  });

  /* Stationsanzeige: die zugewiesene Station (`settings.stationId`, wie in
     den Einstellungen) — Stationen gehoeren zur aktiven Veranstaltung. */
  const isStation = device.type === 'display' && device.settings?.displayMode === 'station';
  const stationId = (device.settings?.stationId as string | undefined) || '';
  const { data: aktivesEvent } = useActiveEvent(isStation ? organizationId : '');
  const { data: stationen = [] } = useProductionStations(isStation && stationId ? (aktivesEvent?.id ?? '') : '');

  let verknuepftMit: string | null = null;
  if (isStation) {
    verknuepftMit = stationId
      ? (stationen.find((st) => st.id === stationId)?.name ?? t('devices.detail.stats.linkedStationUnknown'))
      : null;
  } else if (device.type === 'display') {
    const posId = device.settings?.posDeviceId;
    verknuepftMit = posId
      ? ((geschwisterData?.data ?? []).find((d) => d.id === posId)?.name ?? t('devices.detail.stats.linkedPosUnknown'))
      : null;
  }

  /* Kasse: Betriebsmodus und Tische (Standardbereich, Tischwahl). */
  const isPos = device.type === 'pos';
  const tableService = isPos && (device.settings?.serviceMode ?? 'table') === 'table';
  const areaId = device.settings?.tableAreaId ?? null;
  const { data: areas = [] } = useTableAreas(tableService && areaId ? organizationId : '');
  const areaName = areaId ? (areas.find((a) => a.id === areaId)?.name ?? null) : null;
  const selectView = device.settings?.tableSelectView;
  const posSub = tableService
    ? [
        areaName ? t('devices.detail.stats.posArea', { area: areaName }) : t('devices.detail.stats.posAreaNone'),
        selectView
          ? t('devices.detail.stats.posView', {
              view: t(`devices.detail.settings.tableSelectView.${selectView}`),
            })
          : t('devices.detail.stats.posViewAuto'),
      ].join(' · ')
    : undefined;

  const copyDeviceId = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(device.id);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = device.id;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {/* Eine Anzeige verkauft nichts — Bestellungen, Zahlungen und
            Umsatz stuenden dort auf ewig auf null und sagten nur, dass
            die Kacheln fuer die Kasse gebaut wurden. */}
        {device.type === 'display' ? (
          <>
            <StatCard
              label={t('devices.detail.stats.mode')}
              value={
                device.settings?.displayMode === 'station'
                  ? t('devices.list.displayStation')
                  : t('devices.list.displayCustomer')
              }
            />
            <StatCard
              label={isStation ? t('devices.detail.stats.linkedStation') : t('devices.detail.stats.linkedTo')}
              value={verknuepftMit ?? t('devices.detail.stats.linkedToNone')}
            >
              {!verknuepftMit && (
                /* Volle Navigation: der Reiter liest ?tab= beim Laden. */
                <a className="device-overview__link" href="?tab=settings">
                  {t('devices.detail.stats.linkedToSet')}
                  <Icon name="arrow-right" size={12} />
                </a>
              )}
            </StatCard>
          </>
        ) : (
          <>
            <StatCard
              label={t('devices.detail.stats.posMode')}
              value={t(`devices.detail.settings.serviceMode.${tableService ? 'table' : 'counter'}`)}
              sub={posSub}
            />
            <StatCard label={t('devices.detail.stats.orders')} value={stats?.ordersCount ?? 0} />
            <StatCard label={t('devices.detail.stats.payments')} value={stats?.paymentsCount ?? 0} />
            <StatCard label={t('devices.detail.stats.revenue')} value={formatCurrency(stats?.revenueTotal ?? 0)} />
          </>
        )}
        <StatCard
          label={t('devices.detail.stats.status')}
          value={isOnline ? t('devices.online') : t('devices.offline')}
          sub={device.lastSeenAt ? formatRelativeTime(device.lastSeenAt, locale) : undefined}
        />
      </div>

      {/* Device Details */}
      <div className="app-card">
        <div className="app-card__head">
          <div>
            <h2 className="app-card__title">{t('devices.detail.info.title')}</h2>
          </div>
        </div>
        <div className="app-card__body">
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px 24px', margin: 0 }}>
            <div>
              <dt style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 4 }}>
                {t('devices.detail.info.deviceId')}
              </dt>
              <dd style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {device.id}
                </span>
                <button
                  onClick={copyDeviceId}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, color: 'color-mix(in oklab, var(--ink) 40%, transparent)' }}
                  title={t('devices.detail.info.copyId')}
                  aria-label={t('devices.detail.info.copyId')}
                >
                  <Icon name="copy" size={14} />
                </button>
              </dd>
            </div>

            <div>
              <dt style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 4 }}>
                {t('devices.detail.info.deviceType')}
              </dt>
              <dd style={{ margin: 0 }}>
                <span className="badge badge--neutral">{t(`devices.class.${device.type}`)}</span>
              </dd>
            </div>

            <div>
              <dt style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 4 }}>
                {t('devices.detail.info.status')}
              </dt>
              <dd style={{ margin: 0 }}>
                <span className={statusBadgeClass[device.status] ?? 'badge badge--neutral'}>
                  {t(`devices.status.${device.status}`)}
                </span>
              </dd>
            </div>

            <div>
              <dt style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 4 }}>
                {t('devices.detail.info.createdAt')}
              </dt>
              <dd style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                {formatDateTime(device.createdAt)}
              </dd>
            </div>

            <div>
              <dt style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 4 }}>
                {t('devices.detail.info.verifiedAt')}
              </dt>
              <dd style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                {device.verifiedAt ? formatDateTime(device.verifiedAt) : t('devices.detail.info.notVerified')}
              </dd>
            </div>

            <div>
              <dt style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 4 }}>
                {t('devices.detail.info.userAgent')}
              </dt>
              <dd style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {device.userAgent || '-'}
              </dd>
            </div>

            <div>
              <dt style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 4 }}>
                {t('devices.detail.info.lastSeen')}
              </dt>
              <dd style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                {device.lastSeenAt ? formatRelativeTime(device.lastSeenAt, locale) : '-'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
