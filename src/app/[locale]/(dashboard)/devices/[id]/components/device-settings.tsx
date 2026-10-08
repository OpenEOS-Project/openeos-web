'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import '@/styles/device-settings.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { SettingToggle } from '@/components/shared/setting-toggle';
import { toast } from '@/components/shared/toast';

import { useActiveEvent } from '@/hooks/use-events';
import { useProductionStations } from '@/hooks/use-production-stations';
import { useTableAreas } from '@/hooks/use-tables';

import { devicesApi, sumupApi } from '@/lib/api-client';

import { useAuthStore } from '@/stores/auth-store';

import type {
  Device,
  DeviceClass,
  DisplayMode,
  ServiceMode,
  TableSelectView,
} from '@/types/device';
import type { RefundPermission } from '@/types/order-history';
import type { TableArea } from '@/types/table';

interface DeviceSettingsProps {
  device: Device;
  organizationId: string;
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="app-card">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{title}</h2>
          {description && <p className="app-card__sub">{description}</p>}
        </div>
      </div>
      <div className="app-card__body">
        <div className="device-settings__stack">{children}</div>
      </div>
    </section>
  );
}

function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="device-settings__row">
      <label className="auth-field">
        <span>{label}</span>
        {children}
      </label>
      {hint && <p className="device-settings__hint">{hint}</p>}
    </div>
  );
}

/**
 * Einstellungen, die nur in einer bestimmten Wahl gelten (z. B. Station nur
 * bei der Stationsanzeige), stehen direkt darunter, eingerückt und mit
 * eigener Überschrift — nicht irgendwo weiter unten.
 */
function Dependent({
  title,
  text,
  children,
}: {
  title: string;
  text?: string;
  children: ReactNode;
}) {
  return (
    <div className="device-settings__dependent" role="group" aria-label={title}>
      <p className="device-settings__dependent-title">{title}</p>
      {text && <p className="device-settings__hint">{text}</p>}
      <div className="device-settings__stack">{children}</div>
    </div>
  );
}

/** Hat ein Bereich einen Tischplan (nicht alle Tische auf 0/0)? Wie die Kasse. */
const hasFloorLayout = (area: TableArea) =>
  area.tables.some((table) => table.isActive && (table.x !== 0 || table.y !== 0));

const TABLE_SELECT_VIEWS: TableSelectView[] = ['number', 'list', 'map'];
const REFUND_PERMISSIONS: RefundPermission[] = ['allowed', 'pin', 'disabled'];

export function DeviceSettings({ device, organizationId }: DeviceSettingsProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();

  const sumupConfigured = !!currentOrganization?.organization?.settings?.sumup?.merchantCode;

  const [name, setName] = useState(device.name);
  const [type, setType] = useState<DeviceClass>(device.type);
  const [serviceMode, setServiceMode] = useState<ServiceMode>(
    device.settings?.serviceMode || 'table'
  );
  const [requirePin, setRequirePin] = useState(device.settings?.requirePin ?? false);
  /* Stornieren & Erstatten an der Kasse: erlaubt (Standard), nur mit PIN, aus. */
  const [refundPermission, setRefundPermission] = useState<RefundPermission>(
    device.settings?.refundPermission ?? 'allowed'
  );
  const [sumupReaderId, setSumupReaderId] = useState(
    (device.settings?.sumupReaderId as string) || ''
  );
  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    device.settings?.displayMode || 'customer'
  );
  /* Welche Station dieser Bildschirm zeigt (`settings.stationId`). */
  const [stationId, setStationId] = useState<string>(
    (device.settings?.stationId as string | undefined) || ''
  );

  /* Stationen gehoeren zur laufenden Veranstaltung — eine Kuechenanzeige
     ohne aktives Event hat nichts anzuzeigen. */
  const { data: aktivesEvent } = useActiveEvent(organizationId ?? '');
  const { data: stationen = [] } = useProductionStations(aktivesEvent?.id ?? '');
  const [posDeviceId, setPosDeviceId] = useState(device.settings?.posDeviceId || '');
  /* Standardbereich der Kasse im Tischbetrieb: Tischliste und Karte
     öffnen zuerst diesen Bereich. Leer heißt erster freigegebener. */
  const [tableAreaId, setTableAreaId] = useState(device.settings?.tableAreaId || '');
  /* Tischwahl an der Kasse (Nummer / Liste / Karte); leer = automatisch. */
  const [tableSelectView, setTableSelectView] = useState<TableSelectView | ''>(
    device.settings?.tableSelectView || ''
  );
  const { data: tableAreas = [] } = useTableAreas(type === 'pos' ? organizationId : '');
  /* Aussehen der Anzeige. Leere Zeichenkette heisst "nichts eigenes
     gesetzt" — dann greift die Vorgabe der Anzeige selbst. */
  const [theme, setTheme] = useState(device.settings?.display?.theme ?? 'dark');
  const [scale, setScale] = useState(device.settings?.display?.scale ?? 'normal');
  const [headline, setHeadline] = useState(device.settings?.display?.headline ?? '');
  const [showLogo, setShowLogo] = useState(device.settings?.display?.showLogo ?? true);
  const [idleText, setIdleText] = useState(device.settings?.display?.idleText ?? '');
  const [autoClearSeconds, setAutoClearSeconds] = useState(
    String(device.settings?.display?.autoClearSeconds ?? 0)
  );

  useEffect(() => {
    setName(device.name);
    setType(device.type);
    setServiceMode(device.settings?.serviceMode || 'table');
    setRequirePin(device.settings?.requirePin ?? false);
    setRefundPermission(device.settings?.refundPermission ?? 'allowed');
    setSumupReaderId((device.settings?.sumupReaderId as string) || '');
    setDisplayMode(device.settings?.displayMode || 'customer');
    setStationId((device.settings?.stationId as string | undefined) || '');
    setPosDeviceId(device.settings?.posDeviceId || '');
    setTableAreaId(device.settings?.tableAreaId || '');
    setTableSelectView(device.settings?.tableSelectView || '');
    setTheme(device.settings?.display?.theme ?? 'dark');
    setScale(device.settings?.display?.scale ?? 'normal');
    setHeadline(device.settings?.display?.headline ?? '');
    setShowLogo(device.settings?.display?.showLogo ?? true);
    setIdleText(device.settings?.display?.idleText ?? '');
    setAutoClearSeconds(String(device.settings?.display?.autoClearSeconds ?? 0));
  }, [device]);

  const readersQuery = useQuery({
    queryKey: ['sumup-readers', organizationId],
    queryFn: async () => {
      const response = await sumupApi.listReaders(organizationId);
      return response.data || [];
    },
    enabled: !!organizationId && type === 'pos' && sumupConfigured,
  });

  const posDevicesQuery = useQuery({
    // Own sub-key: ['devices', orgId] is already used by the devices list with the
    // RAW response shape — sharing it would poison this query's cache with a non-array.
    queryKey: ['devices', organizationId, 'pos-select'],
    queryFn: async () => {
      const response = await devicesApi.list(organizationId);
      return response.data || [];
    },
    enabled: !!organizationId && type === 'display' && displayMode === 'customer',
  });

  const posDevices = (posDevicesQuery.data || []).filter(
    (d) => d.type === 'pos' && d.status === 'verified' && d.id !== device.id
  );

  /* Tischbetrieb der aktiven Veranstaltung: bestimmt, welche Tischwahl
     sinnvoll ist. Ohne Angabe gilt wie in der Kasse „frei“. */
  const eventTableMode = aktivesEvent ? (aktivesEvent.settings?.tables?.mode ?? 'free') : null;
  const anyMap = tableAreas.some(hasFloorLayout);
  const defaultArea = tableAreas.find((area) => area.id === tableAreaId);
  const autoView: TableSelectView = defaultArea && hasFloorLayout(defaultArea) ? 'map' : 'list';

  const updateMutation = useMutation({
    mutationFn: () =>
      devicesApi.update(organizationId, device.id, {
        name,
        type,
        settings: {
          ...device.settings,
          serviceMode: type === 'pos' ? serviceMode : device.settings?.serviceMode,
          printerMode: device.settings?.printerMode,
          requirePin: type === 'pos' ? requirePin : device.settings?.requirePin,
          // „Erlaubt“ ist die Vorgabe: dann nichts speichern (null löscht).
          refundPermission:
            type === 'pos'
              ? refundPermission === 'allowed'
                ? null
                : refundPermission
              : device.settings?.refundPermission,
          sumupReaderId:
            type === 'pos' ? sumupReaderId || undefined : device.settings?.sumupReaderId,
          // null löscht den Wert (die API führt Einstellungen zusammen).
          tableAreaId:
            type === 'pos' && serviceMode === 'table'
              ? tableAreaId || null
              : device.settings?.tableAreaId,
          tableSelectView:
            type === 'pos' && serviceMode === 'table'
              ? tableSelectView || null
              : device.settings?.tableSelectView,
          displayMode: type === 'display' ? displayMode : device.settings?.displayMode,
          stationId:
            type === 'display' && displayMode === 'station'
              ? stationId || undefined
              : device.settings?.stationId,
          posDeviceId:
            type === 'display' && displayMode === 'customer'
              ? posDeviceId || undefined
              : device.settings?.posDeviceId,
          display:
            type === 'display'
              ? {
                  theme,
                  scale,
                  // Leeres Feld heisst "Vorgabe", nicht "leerer Text".
                  headline: headline.trim() || undefined,
                  showLogo,
                  idleText: idleText.trim() || undefined,
                  autoClearSeconds: Number(autoClearSeconds) || 0,
                }
              : device.settings?.display,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', organizationId, device.id] });
      queryClient.invalidateQueries({ queryKey: ['devices', organizationId] });
      toast.success(t('devices.detail.saved'));
    },
    onError: () => {
      toast.error(t('devices.detail.saveFailed'));
    },
  });

  /* 'admin' fehlt hier bewusst — der Wert wurde nirgends ausgewertet und
     schickte das Geraet in dieselbe Ansicht wie eine Kasse. Aus dem
     Kopplungsdialog ist er schon draussen; hier stand er noch. */
  const typeOptions: DeviceClass[] = ['pos', 'display'];
  const s = (key: string, values?: Record<string, string | number>) =>
    t(`devices.detail.settings.${key}`, values);

  /* ---------- Kasse: Tische (hängt am Betriebsmodus „Bedienung“) ---------- */

  const tablesBlock = (
    <Dependent title={s('tables.title')} text={s('tables.description')}>
      <FormRow
        label={s('tableArea')}
        hint={
          tableAreas.length === 0 ? (
            <>
              {s('tableAreaEmpty')}{' '}
              <Link href="/tables" className="device-settings__link">
                {s('tableAreaManage')}
              </Link>
            </>
          ) : (
            s('tableAreaHint')
          )
        }
      >
        <select
          className="select"
          value={tableAreaId}
          onChange={(e) => setTableAreaId(e.target.value)}
          disabled={tableAreas.length === 0}
        >
          <option value="">{s('tableAreaNone')}</option>
          {tableAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
          {/* Gelöschter Bereich: Wert sichtbar lassen statt still zu ändern. */}
          {tableAreaId &&
            !tableAreas.some((area) => area.id === tableAreaId) &&
            tableAreas.length > 0 && <option value={tableAreaId}>{s('tableAreaMissing')}</option>}
        </select>
      </FormRow>

      <FormRow
        label={s('tableSelectView.label')}
        hint={
          <>
            {eventTableMode === 'free'
              ? s('tableSelectView.hintFree')
              : eventTableMode === 'none'
                ? s('tableSelectView.hintNone')
                : s('tableSelectView.hint')}
            {!anyMap && (
              <>
                {' '}
                {s('tableSelectView.noMap')}{' '}
                <Link href="/tables" className="device-settings__link">
                  {s('tableAreaManage')}
                </Link>
              </>
            )}
          </>
        }
      >
        <select
          className="select"
          value={tableSelectView}
          onChange={(e) => setTableSelectView(e.target.value as TableSelectView | '')}
        >
          <option value="">
            {s('tableSelectView.auto', { view: s(`tableSelectView.${autoView}`) })}
          </option>
          {TABLE_SELECT_VIEWS.map((view) => (
            <option
              key={view}
              value={view}
              disabled={view === 'map' && !anyMap && tableSelectView !== 'map'}
            >
              {s(`tableSelectView.${view}`)}
            </option>
          ))}
        </select>
      </FormRow>
    </Dependent>
  );

  return (
    <div className="device-settings">
      <SectionCard title={s('basic.title')} description={s('basic.descriptionGeneral')}>
        <FormRow label={t('devices.edit.name')}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('devices.edit.namePlaceholder')}
          />
        </FormRow>

        <FormRow label={t('devices.edit.type')} hint={s('basic.typeHint')}>
          <select
            className="select"
            value={type}
            onChange={(e) => setType(e.target.value as DeviceClass)}
          >
            {typeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {t(`devices.class.${opt}`)}
              </option>
            ))}
          </select>
        </FormRow>
      </SectionCard>

      {/* ---------- Kasse ---------- */}

      {type === 'pos' && (
        <SectionCard title={s('serviceMode.title')} description={s('serviceMode.description')}>
          <div
            className="device-settings__choices"
            role="radiogroup"
            aria-label={s('serviceMode.title')}
          >
            {(['table', 'counter'] as ServiceMode[]).map((mode) => (
              <div key={mode} className="device-settings__choice-wrap">
                <label className="device-settings__choice">
                  <input
                    type="radio"
                    name="serviceMode"
                    value={mode}
                    checked={serviceMode === mode}
                    onChange={() => setServiceMode(mode)}
                  />
                  <span>
                    <b>{s(`serviceMode.${mode}`)}</b>
                    <small>{s(`serviceMode.${mode}Description`)}</small>
                  </span>
                </label>
                {mode === 'table' && serviceMode === 'table' && tablesBlock}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {type === 'pos' && (
        <SectionCard title={s('payment.title')} description={s('payment.description')}>
          {sumupConfigured ? (
            <FormRow label={t('devices.edit.sumupReader')}>
              <select
                className="select"
                value={sumupReaderId}
                onChange={(e) => setSumupReaderId(e.target.value)}
              >
                <option value="">{t('devices.edit.sumupReaderNone')}</option>
                {(readersQuery.data || []).map((reader) => (
                  <option key={reader.id} value={reader.id}>
                    {reader.name}
                  </option>
                ))}
              </select>
            </FormRow>
          ) : (
            <p className="device-settings__hint">{t('devices.edit.sumupNotConfigured')}</p>
          )}
        </SectionCard>
      )}

      {type === 'pos' && (
        <SectionCard title={s('auth.title')} description={s('auth.description')}>
          <SettingToggle
            label={s('auth.requirePin')}
            hint={s('auth.requirePinDescription')}
            checked={requirePin}
            onChange={setRequirePin}
          />
          <p className="device-settings__hint">{s('auth.pinManagedPerMember')}</p>
          <div className="device-settings__row">
            <span className="device-settings__label">{s('auth.refund')}</span>
            <p className="device-settings__hint">{s('auth.refundDescription')}</p>
            <div
              className="device-settings__choices"
              role="radiogroup"
              aria-label={s('auth.refund')}
            >
              {REFUND_PERMISSIONS.map((mode) => (
                <div key={mode} className="device-settings__choice-wrap">
                  <label className="device-settings__choice">
                    <input
                      type="radio"
                      name="refundPermission"
                      value={mode}
                      checked={refundPermission === mode}
                      onChange={() => setRefundPermission(mode)}
                    />
                    <span>
                      <b>{s(`auth.refund_${mode}`)}</b>
                      <small>{s(`auth.refund_${mode}Description`)}</small>
                    </span>
                  </label>
                  {mode === 'pin' && refundPermission === 'pin' && (
                    <Dependent title={s('auth.refund_pin')} text={s('auth.refund_pinHint')}>
                      <Link href="/members" className="device-settings__link">
                        {t('members.permissions.title')}
                      </Link>
                    </Dependent>
                  )}
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      {/* ---------- Anzeige ---------- */}

      {type === 'display' && (
        <SectionCard title={s('display.title')} description={s('display.description')}>
          <FormRow label={s('display.mode')}>
            <select
              className="select"
              value={displayMode}
              onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
            >
              <option value="customer">{s('display.modeCustomer')}</option>
              <option value="station">{s('display.modeStation')}</option>
            </select>
          </FormRow>

          {displayMode === 'customer' && (
            <Dependent title={s('display.customerTitle')} text={s('display.posDeviceHint')}>
              <FormRow label={s('display.posDevice')}>
                <select
                  className="select"
                  value={posDeviceId}
                  onChange={(e) => setPosDeviceId(e.target.value)}
                >
                  <option value="">{s('display.posDeviceNone')}</option>
                  {posDevices.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.name}
                    </option>
                  ))}
                </select>
              </FormRow>
            </Dependent>
          )}

          {displayMode === 'station' && (
            <Dependent title={s('display.stationTitle')} text={s('display.stationHint')}>
              <FormRow
                label={s('display.station')}
                hint={
                  !aktivesEvent
                    ? s('display.stationNoEvent')
                    : stationen.length === 0
                      ? s('display.stationEmpty')
                      : undefined
                }
              >
                <select
                  className="select"
                  value={stationId}
                  onChange={(e) => setStationId(e.target.value)}
                >
                  <option value="">{s('display.stationNone')}</option>
                  {stationen.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.name}
                    </option>
                  ))}
                  {stationId && !stationen.some((station) => station.id === stationId) && (
                    <option value={stationId}>{s('display.stationOther')}</option>
                  )}
                </select>
              </FormRow>
              <FormRow label={s('appearance.autoClear')} hint={s('appearance.autoClearHint')}>
                <select
                  className="select"
                  value={autoClearSeconds}
                  onChange={(e) => setAutoClearSeconds(e.target.value)}
                >
                  <option value="0">{s('appearance.autoClearOff')}</option>
                  {[10, 30, 60].map((seconds) => (
                    <option key={seconds} value={String(seconds)}>
                      {s('appearance.autoClearSeconds', { seconds })}
                    </option>
                  ))}
                </select>
              </FormRow>
            </Dependent>
          )}
        </SectionCard>
      )}

      {type === 'display' && (
        <SectionCard title={s('appearance.title')} description={s('appearance.description')}>
          <FormRow label={s('appearance.theme')}>
            <select
              className="select"
              value={theme}
              onChange={(e) => setTheme(e.target.value as typeof theme)}
            >
              <option value="dark">{s('appearance.themeDark')}</option>
              <option value="light">{s('appearance.themeLight')}</option>
              <option value="auto">{s('appearance.themeAuto')}</option>
            </select>
          </FormRow>

          <FormRow label={s('appearance.scale')}>
            <select
              className="select"
              value={scale}
              onChange={(e) => setScale(e.target.value as typeof scale)}
            >
              <option value="normal">{s('appearance.scaleNormal')}</option>
              <option value="large">{s('appearance.scaleLarge')}</option>
            </select>
          </FormRow>

          <FormRow label={s('appearance.headline')}>
            <input
              className="input"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder={s('appearance.headlinePlaceholder')}
            />
          </FormRow>

          <FormRow label={s('appearance.idleText')}>
            <input
              className="input"
              value={idleText}
              onChange={(e) => setIdleText(e.target.value)}
              placeholder={s('appearance.idleTextPlaceholder')}
            />
          </FormRow>

          <SettingToggle
            label={s('appearance.showLogo')}
            hint={s('appearance.showLogoHint')}
            checked={showLogo}
            onChange={setShowLogo}
          />
        </SectionCard>
      )}

      <div className="device-settings__actions">
        <button
          className="btn btn--primary"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );
}
