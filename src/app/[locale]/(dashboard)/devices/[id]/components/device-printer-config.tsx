'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesApi, printersApi } from '@/lib/api-client';
import { usePrinters } from '@/hooks/use-printers';
import type { Device, PrinterMode } from '@/types/device';

interface DevicePrinterConfigProps {
  device: Device;
  organizationId: string;
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="app-card">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{title}</h2>
          {description && <p className="app-card__sub">{description}</p>}
        </div>
      </div>
      <div className="app-card__body">
        {children}
      </div>
    </div>
  );
}

/** Normalize legacy routing values to the new canonical set. */
function normalizePrinterMode(raw: PrinterMode | undefined): 'fixed' | 'dynamic' {
  if (raw === 'fixed') return 'fixed';
  // 'device', 'category', 'product' and undefined all map to 'dynamic'
  return 'dynamic';
}

const ROUTING_MODES: { value: 'fixed' | 'dynamic'; label: string; description: string }[] = [
  {
    value: 'fixed',
    label: 'Fester Drucker',
    description:
      'Bons gehen immer auf den unten ausgewählten Drucker — ohne Rücksicht auf Produkt- oder Kategoriezuordnung. Empfohlen für Geräte, die direkt an einem Drucker hängen.',
  },
  {
    value: 'dynamic',
    label: 'Dynamisches Routing',
    description:
      'Folge der Routing-Kette: Produkt-Station → Kategorie-Station → Standard-Drucker dieses Geräts (Fallback). Empfohlen, wenn mehrere Stationen mit eigenen Druckern existieren.',
  },
];

export function DevicePrinterConfig({ device, organizationId }: DevicePrinterConfigProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const [defaultPrinterId, setDefaultPrinterId] = useState((device.settings?.defaultPrinterId as string) || '');
  const [printerMode, setPrinterMode] = useState<'fixed' | 'dynamic'>(
    normalizePrinterMode(device.settings?.printerMode),
  );
  const [cashDrawerPrinterId, setCashDrawerPrinterId] = useState((device.settings?.cashDrawerPrinterId as string) || '');

  // test-print feedback state
  const [testFeedback, setTestFeedback] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    setDefaultPrinterId((device.settings?.defaultPrinterId as string) || '');
    setPrinterMode(normalizePrinterMode(device.settings?.printerMode));
    setCashDrawerPrinterId((device.settings?.cashDrawerPrinterId as string) || '');
  }, [device]);

  const { data: printersList } = usePrinters(organizationId);
  const printers = printersList || [];

  const updateMutation = useMutation({
    mutationFn: () =>
      devicesApi.update(organizationId, device.id, {
        settings: {
          ...device.settings,
          defaultPrinterId: defaultPrinterId || undefined,
          printerMode,
          cashDrawerPrinterId: cashDrawerPrinterId || undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', organizationId, device.id] });
    },
  });

  const testPrintMutation = useMutation({
    mutationFn: () => printersApi.testPrint(organizationId, defaultPrinterId),
    onSuccess: () => {
      setTestFeedback('success');
      window.setTimeout(() => setTestFeedback(null), 2500);
    },
    onError: () => {
      setTestFeedback('error');
      window.setTimeout(() => setTestFeedback(null), 2500);
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionCard title={t('devices.detail.printer.defaultPrinter.title')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            {t('devices.detail.printer.defaultPrinter.title')}
          </label>
          <select
            className="select"
            value={defaultPrinterId}
            onChange={(e) => setDefaultPrinterId(e.target.value)}
          >
            <option value="">{t('devices.detail.printer.defaultPrinter.noPrinter')}</option>
            {printers.map((printer) => (
              <option key={printer.id} value={printer.id}>
                {printer.isOnline ? '● ' : '○ '}{printer.name}
              </option>
            ))}
          </select>

          {/* Test-print button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!defaultPrinterId || testPrintMutation.isPending}
              onClick={() => testPrintMutation.mutate()}
              style={{ fontSize: 13 }}
            >
              {testPrintMutation.isPending ? '...' : 'Testdruck'}
            </button>
            {testFeedback === 'success' && (
              <span style={{ fontSize: 12, color: 'var(--green-ink)' }}>✓ Testdruck wurde gesendet</span>
            )}
            {testFeedback === 'error' && (
              <span style={{ fontSize: 12, color: 'var(--danger)' }}>✗ Fehler beim Senden</span>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={t('devices.detail.printer.routing.title')}
        description={t('devices.detail.printer.routing.description')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ROUTING_MODES.map((mode) => (
            <label
              key={mode.value}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                cursor: 'pointer',
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${printerMode === mode.value ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 10%, transparent)'}`,
                background: printerMode === mode.value
                  ? 'color-mix(in oklab, var(--green-soft) 35%, var(--paper))'
                  : 'var(--paper)',
                transition: 'border-color 0.12s, background 0.12s',
              }}
            >
              <input
                type="radio"
                name="printerMode"
                value={mode.value}
                checked={printerMode === mode.value}
                onChange={() => setPrinterMode(mode.value)}
                style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--green-ink)' }}
              />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{mode.label}</p>
                <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', margin: '2px 0 0' }}>
                  {mode.description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title={t('devices.detail.printer.cashDrawer.title')}
        description={t('devices.detail.printer.cashDrawer.description')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            {t('devices.detail.printer.cashDrawer.selectPrinter')}
          </label>
          {printers.filter((p) => p.hasCashDrawer).length === 0 ? (
            <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', margin: 0 }}>
              {t('devices.detail.printer.cashDrawer.noPrintersAvailable')}
            </p>
          ) : (
            <select
              className="select"
              value={cashDrawerPrinterId}
              onChange={(e) => setCashDrawerPrinterId(e.target.value)}
            >
              <option value="">{t('devices.detail.printer.cashDrawer.noPrinter')}</option>
              {printers.filter((p) => p.hasCashDrawer).map((printer) => (
                <option key={printer.id} value={printer.id}>
                  {printer.isOnline ? '● ' : '○ '}{printer.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </SectionCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
        {updateMutation.isSuccess && (
          <span style={{ fontSize: 13, color: 'var(--green-ink)' }}>{t('devices.detail.saved')}</span>
        )}
        {updateMutation.isError && (
          <span style={{ fontSize: 13, color: 'var(--danger)' }}>{t('devices.detail.saveFailed')}</span>
        )}
        <button
          className="btn btn--primary"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? '...' : t('common.save')}
        </button>
      </div>
    </div>
  );
}
