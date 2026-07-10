'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { organizationsApi } from '@/lib/api-client';
import { usePrinters } from '@/hooks/use-printers';
import { usePrintTemplates } from '@/hooks/use-print-templates';
import { ToggleSwitch } from '@/components/shared/toggle-switch';
import { toast } from '@/components/shared/toast';
import type { OrganizationSettings } from '@/types/organization';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type KitchenTicketMode = 'per_order' | 'per_item' | 'per_station';
type ReceiptTrigger = 'payment_received' | 'order_completed' | 'manual';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function WarningBanner({ text }: { text: string }) {
  return (
    <div style={{
      background: 'color-mix(in oklab, var(--warn) 12%, transparent)',
      border: '1px solid color-mix(in oklab, var(--warn) 35%, transparent)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
      color: 'color-mix(in oklab, var(--ink) 80%, transparent)',
      marginBottom: 12,
    }}>
      {text}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'color-mix(in oklab, var(--ink) 65%, transparent)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SaveStatus({ isPending }: { isPending: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginTop: 8 }}>
      {isPending && <span style={{ color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>Speichert…</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function OrderFlowTab() {
  const t = useTranslations();
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const orgId = currentOrganization?.organizationId ?? '';

  // Derive initial state from org settings
  const settings = currentOrganization?.organization?.settings ?? {} as OrganizationSettings;
  const orderFlow = settings.orderFlow ?? {};
  const kitchen = orderFlow.kitchenTicketPrinting ?? { enabled: false, printerId: null, templateId: null, mode: 'per_order' as KitchenTicketMode };
  const orderTicket = orderFlow.orderTicketPrinting ?? { enabled: false, printerId: null, templateId: null };
  const receipt = orderFlow.receiptPrinting ?? { enabled: false, trigger: 'payment_received' as ReceiptTrigger, printerId: null, templateId: null };

  // Kitchen card state
  const [kitchenEnabled, setKitchenEnabled] = useState(kitchen.enabled);
  const [kitchenMode, setKitchenMode] = useState<KitchenTicketMode>((kitchen.mode as KitchenTicketMode) || 'per_order');
  const [kitchenPrinterId, setKitchenPrinterId] = useState(kitchen.printerId ?? '');
  const [kitchenTemplateId, setKitchenTemplateId] = useState(kitchen.templateId ?? '');

  // Order ticket card state
  const [orderEnabled, setOrderEnabled] = useState(orderTicket.enabled);
  const [orderPrinterId, setOrderPrinterId] = useState(orderTicket.printerId ?? '');
  const [orderTemplateId, setOrderTemplateId] = useState(orderTicket.templateId ?? '');

  // Receipt card state
  const [receiptEnabled, setReceiptEnabled] = useState(receipt.enabled);
  const [receiptTrigger, setReceiptTrigger] = useState<ReceiptTrigger>(receipt.trigger ?? 'payment_received');
  const [receiptPrinterId, setReceiptPrinterId] = useState(receipt.printerId ?? '');
  const [receiptTemplateId, setReceiptTemplateId] = useState(receipt.templateId ?? '');

  // Shared data: printers + templates
  const { data: printersList } = usePrinters(orgId);
  const { data: templatesList } = usePrintTemplates(orgId);

  const printers = printersList ?? [];
  const templates = templatesList ?? [];

  const kitchenTemplates = templates.filter((tmpl) => tmpl.type === 'kitchen_ticket');
  const orderTemplates = templates.filter((tmpl) => tmpl.type === 'order_ticket');
  const receiptTemplates = templates.filter((tmpl) => tmpl.type === 'receipt');

  // Helper to build merged settings payload
  function buildPayload(patch: NonNullable<OrganizationSettings['orderFlow']>) {
    const current = currentOrganization?.organization?.settings ?? {} as OrganizationSettings;
    return {
      ...current,
      orderFlow: {
        ...(current.orderFlow ?? {}),
        ...patch,
      },
    } as OrganizationSettings;
  }

  const kitchenMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Organisation fehlt');
      const merged = buildPayload({
        kitchenTicketPrinting: {
          enabled: kitchenEnabled,
          mode: kitchenMode,
          printerId: kitchenPrinterId || null,
          templateId: kitchenTemplateId || null,
        },
      });
      const res = await organizationsApi.update(orgId, { settings: merged });
      return res.data;
    },
    onSuccess: (org) => {
      if (currentOrganization) setCurrentOrganization({ ...currentOrganization, organization: org });
      toast.success('Gespeichert');
    },
    onError: () => {
      toast.error(t('common.saveFailed'));
    },
  });

  const orderMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Organisation fehlt');
      const merged = buildPayload({
        orderTicketPrinting: {
          enabled: orderEnabled,
          printerId: orderPrinterId || null,
          templateId: orderTemplateId || null,
        },
      });
      const res = await organizationsApi.update(orgId, { settings: merged });
      return res.data;
    },
    onSuccess: (org) => {
      if (currentOrganization) setCurrentOrganization({ ...currentOrganization, organization: org });
      toast.success('Gespeichert');
    },
    onError: () => {
      toast.error(t('common.saveFailed'));
    },
  });

  const receiptMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Organisation fehlt');
      const merged = buildPayload({
        receiptPrinting: {
          enabled: receiptEnabled,
          trigger: receiptTrigger,
          printerId: receiptPrinterId || null,
          templateId: receiptTemplateId || null,
        },
      });
      const res = await organizationsApi.update(orgId, { settings: merged });
      return res.data;
    },
    onSuccess: (org) => {
      if (currentOrganization) setCurrentOrganization({ ...currentOrganization, organization: org });
      toast.success('Gespeichert');
    },
    onError: () => {
      toast.error(t('common.saveFailed'));
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ------------------------------------------------------------------ */}
      {/* Küchenbon                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="app-card">
        <div className="app-card__head">
          <div style={{ flex: 1 }}>
            <h2 className="app-card__title">Küchenbon</h2>
            <p className="app-card__sub">Bons, die bei neuen Bestellungen in der Küche gedruckt werden.</p>
          </div>
          <ToggleSwitch checked={kitchenEnabled} onChange={setKitchenEnabled} aria-label="Küchenbon" />
        </div>
        <div className="app-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!kitchenEnabled && (
            <WarningBanner text="Diese Bons werden nicht automatisch gedruckt." />
          )}

          {kitchenEnabled && (
            <FieldRow label="Modus">
              <select
                className="select"
                value={kitchenMode}
                onChange={(e) => setKitchenMode(e.target.value as KitchenTicketMode)}
              >
                <option value="per_order">1 Bon pro Bestellung</option>
                <option value="per_item">1 Bon pro Produkt mit Barcode</option>
                <option value="per_station">1 Bon pro Produktionsstation</option>
              </select>
            </FieldRow>
          )}

          <FieldRow label="Override-Drucker (optional, sonst Routing-Kette)">
            <select
              className="select"
              value={kitchenPrinterId}
              onChange={(e) => setKitchenPrinterId(e.target.value)}
            >
              <option value="">Routing-Kette verwenden (Standard)</option>
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.isOnline ? '● ' : '○ '}{p.name}
                </option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', margin: '2px 0 0' }}>
              Falls kein Override-Drucker gesetzt ist, wird die Routing-Kette verwendet: Produkt-Station → Kategorie-Station → Standard-Drucker des Geräts → globaler Override.
            </p>
          </FieldRow>

          <FieldRow label="Standard-Vorlage (leer = eingebaut)">
            <select
              className="select"
              value={kitchenTemplateId}
              onChange={(e) => setKitchenTemplateId(e.target.value)}
            >
              <option value="">Eingebaute Vorlage verwenden</option>
              {kitchenTemplates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
              ))}
            </select>
          </FieldRow>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
            <SaveStatus isPending={kitchenMutation.isPending} />
            <button
              className="btn btn--primary"
              onClick={() => kitchenMutation.mutate()}
              disabled={kitchenMutation.isPending}
            >
              Speichern
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Bestellbon                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="app-card">
        <div className="app-card__head">
          <div style={{ flex: 1 }}>
            <h2 className="app-card__title">Bestellbon</h2>
            <p className="app-card__sub">Bon für den Ausgabebereich oder zur Bestellbestätigung.</p>
          </div>
          <ToggleSwitch checked={orderEnabled} onChange={setOrderEnabled} aria-label="Bestellbon" />
        </div>
        <div className="app-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!orderEnabled && (
            <WarningBanner text="Diese Bons werden nicht automatisch gedruckt." />
          )}

          <FieldRow label="Override-Drucker (optional, sonst Routing-Kette)">
            <select
              className="select"
              value={orderPrinterId}
              onChange={(e) => setOrderPrinterId(e.target.value)}
            >
              <option value="">Routing-Kette verwenden (Standard)</option>
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.isOnline ? '● ' : '○ '}{p.name}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Standard-Vorlage (leer = eingebaut)">
            <select
              className="select"
              value={orderTemplateId}
              onChange={(e) => setOrderTemplateId(e.target.value)}
            >
              <option value="">Eingebaute Vorlage verwenden</option>
              {orderTemplates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
              ))}
            </select>
          </FieldRow>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
            <SaveStatus isPending={orderMutation.isPending} />
            <button
              className="btn btn--primary"
              onClick={() => orderMutation.mutate()}
              disabled={orderMutation.isPending}
            >
              Speichern
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Kassenbon                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="app-card">
        <div className="app-card__head">
          <div style={{ flex: 1 }}>
            <h2 className="app-card__title">Kassenbon</h2>
            <p className="app-card__sub">Bon, der nach einer Zahlung oder einem Bestellungsabschluss gedruckt wird.</p>
          </div>
          <ToggleSwitch checked={receiptEnabled} onChange={setReceiptEnabled} aria-label="Kassenbon" />
        </div>
        <div className="app-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!receiptEnabled && (
            <WarningBanner text="Diese Bons werden nicht automatisch gedruckt." />
          )}

          {receiptEnabled && (
            <FieldRow label="Auslöser">
              <select
                className="select"
                value={receiptTrigger}
                onChange={(e) => setReceiptTrigger(e.target.value as ReceiptTrigger)}
              >
                <option value="payment_received">Bei Zahlung</option>
                <option value="order_completed">Bei Bestellungsabschluss</option>
                <option value="manual">Manuell</option>
              </select>
            </FieldRow>
          )}

          <FieldRow label="Override-Drucker (optional, sonst Routing-Kette)">
            <select
              className="select"
              value={receiptPrinterId}
              onChange={(e) => setReceiptPrinterId(e.target.value)}
            >
              <option value="">Routing-Kette verwenden (Standard)</option>
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.isOnline ? '● ' : '○ '}{p.name}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Standard-Vorlage (leer = eingebaut)">
            <select
              className="select"
              value={receiptTemplateId}
              onChange={(e) => setReceiptTemplateId(e.target.value)}
            >
              <option value="">Eingebaute Vorlage verwenden</option>
              {receiptTemplates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
              ))}
            </select>
          </FieldRow>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
            <SaveStatus isPending={receiptMutation.isPending} />
            <button
              className="btn btn--primary"
              onClick={() => receiptMutation.mutate()}
              disabled={receiptMutation.isPending}
            >
              Speichern
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
