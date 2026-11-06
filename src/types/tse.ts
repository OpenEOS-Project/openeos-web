/**
 * Cloud-TSE (Swissbit Cloud-TSE 2) — Antworten der API, Vertrag in
 * tse-swissbit-plan.md §8. Eine TSE je Organisation, genau ein Client
 * (`OEOS-<12 Hex>` = Seriennummer der Kasse); die Geräte sind Terminals.
 */

export type TseUnitState = 'creating' | 'active' | 'failed' | 'deactivated';
export type TseTrigger = 'manual' | 'auto' | 'super_admin';
export type TseTransactionStatus = 'pending' | 'signed' | 'training' | 'failed';
export type TseTransactionKind =
  | 'receipt'
  | 'refund'
  | 'deposit_return'
  | 'order'
  | 'order_cancellation'
  | 'abort'
  /** Kassenbuch: Anfangsbestand, Einlage, Entnahme, Kassensturz-Differenz. */
  | 'cashbook';

/** Warum die TSE (noch) nicht angelegt werden kann; `null` = geht. */
export type TseEligibilityReason =
  | 'TSE_NOT_AVAILABLE'
  | 'TSE_COUNTRY_NOT_SUPPORTED'
  | 'INTEGRATION_DISABLED'
  | 'TSE_REQUIRES_PAID_EVENT'
  | 'TSE_TOO_EARLY'
  /** Steuernummer/USt-IdNr. oder Anschrift fehlen (DSFinV-K-Stammdaten). */
  | 'TSE_MASTER_DATA_REQUIRED';

/** Fehlende Stammdaten bei `TSE_MASTER_DATA_REQUIRED`. */
export type TseMasterDataField = 'taxNumber' | 'street' | 'zip' | 'city';

export interface TseEligibility {
  ok: boolean;
  reason: TseEligibilityReason | null;
  /** Frühester Tag der Anlage (YYYY-MM-DD, Berlin) bei `TSE_TOO_EARLY`. */
  availableFrom: string | null;
  event: { id: string; name: string; startDate: string } | null;
  /** Bei `TSE_MASTER_DATA_REQUIRED`: was noch fehlt. */
  missing?: TseMasterDataField[];
}

export interface TseUnit {
  id: string;
  provider: string;
  state: TseUnitState;
  /** 64 Hex-Zeichen; erst nach der Anlage bei Swissbit. */
  serialNumber: string | null;
  clientId: string;
  productType: string;
  trigger: TseTrigger;
  triggerEventId: string | null;
  createdAt: string | null;
  activatedAt: string | null;
  failedAt: string | null;
  deactivatedAt: string | null;
  deactivationReason: string | null;
  certificationId: string | null;
  certificateExpiresAt: string | null;
  signatureAlgorithm: string | null;
  logTimeFormat: string | null;
  publicKey: string | null;
  lastError: { code: string; message: string | null; at: string | null } | null;
  /** Lebenszyklus `monthly`: geplante Abmeldung (letzter Tag des Monats, 20:00 Berlin). */
  plannedDeactivationAt?: string | null;
  /** Verschiebungen, weil zum Termin eine bezahlte Veranstaltung lief. */
  postponements?: TsePostponement[];
  /** Behalten, weil im Folgemonat schon eine bezahlte Veranstaltung gebucht war (2026-11-06). */
  keeps?: TseKeep[];
  /**
   * Nur aktive TSE, Lebenszyklus `monthly` (GET …/tse und /admin/tse/units):
   * voraussichtliche Abmeldung und die Monate, in denen sie weiterläuft.
   */
  lifecycleOutlook?: TseLifecycleOutlook | null;
}

/** Behalten zum Monatsende (gebuchte Veranstaltung im Folgemonat). */
export interface TseKeep {
  at: string;
  from: string;
  to: string;
  reason: 'paid_event_next_month';
  /** Monat, in dem die TSE dadurch weiterläuft (`YYYY-MM`). */
  month: string;
  events: { id: string; name: string; startDate: string; endDate: string | null }[];
  recheckUntil: string;
  /** Veranstaltung vor dem Monatswechsel storniert/erstattet → doch abgemeldet. */
  revokedAt?: string | null;
}

export type TseKeepReason = 'paid_event_next_month' | 'paid_event_running';

export interface TseLifecycleOutlook {
  /** Voraussichtliche Abmeldung (letzter Tag eines Monats, 20:00 Berlin). */
  expectedDeactivationAt: string;
  /**
   * Monate, in denen die TSE über ihren Monat hinaus aktiv bleibt: zuerst
   * eine schon getroffene Entscheidung (`decided`), dann die Prognose.
   */
  months: {
    month: string;
    reason: TseKeepReason;
    decided: boolean;
    events: { id: string; name: string; startDate: string; endDate: string | null }[];
  }[];
}

export type TseLifecycle = 'persistent' | 'monthly';

/** Abmeldung verschoben (bezahlte Veranstaltung lief zum Monatsende). */
export interface TsePostponement {
  at: string;
  from: string;
  to: string;
  reason: 'paid_event_running';
  /** Monat, der dadurch zusätzlich berechnet wird (`YYYY-MM`). */
  extraMonth: string;
  events: { id: string; name: string; startDate: string; endDate: string | null }[];
}

/** Eine TSE in der Super-Admin-Liste (`GET /admin/tse/units`). */
export interface AdminTseUnit extends Omit<TseUnit, 'publicKey'> {
  organization: { id: string; name: string } | null;
  billedMonths: string[];
  deactivationAttempts: number;
  deactivationNextAttemptAt: string | null;
  deactivationAlertedAt: string | null;
  /** Um 22:00 (geplant + 2 h) noch aktiv. */
  deactivationOverdue: boolean;
}

export type TseHealthIssueKind = 'no_paid_event_this_month' | 'deactivation_overdue' | 'no_planned_deactivation';

export interface TseHealthIssue {
  unitId: string;
  organizationId: string;
  organizationName: string | null;
  serialNumber: string | null;
  kind: TseHealthIssueKind;
  month: string;
  plannedDeactivationAt: string | null;
}

/** `GET /admin/tse/alerts` */
export interface AdminTseAlerts {
  lifecycle: TseLifecycle;
  checkedAt: string;
  issues: TseHealthIssue[];
}

export interface TseProductTypeUsage {
  mode: 'unlimited' | 'slowdown' | 'topUp' | string;
  billingPeriodMonths: number | null;
  signaturesCurrentMonth: number | null;
  signatureDuration: number | null;
  signatureLimit: number | null;
  signaturesRemainingUntilNextLimit: number | null;
  topUpAmount: number | null;
  topUpsCurrentMonth: number | null;
  slowdownActive: boolean | null;
}

/** Live-Werte von Swissbit (60 s zwischengespeichert). */
export interface TseLive {
  fetchedAt: string | null;
  healthState: string | null;
  initializationState: string | null;
  storageUsed: number | null;
  storageCapacity: number | null;
  signaturesThisMonth: number | null;
  transactionSignaturesPerMonth: Record<string, number> | null;
  productTypeUsage: TseProductTypeUsage | null;
  numStartedTransactions: number | null;
  maxStartedTransactions: number | null;
  numRegisteredClients: number | null;
  maxRegisteredClients: number | null;
  certificationId: string | null;
  certificateExpiresAt: string | null;
  softwareVersion: string | null;
}

export interface TseOutageSummary {
  since: string;
  reason: string | null;
  failedCount: number;
}

/** Wie die Integration automatisch eingeschaltet wurde. */
export interface TseAutoEnabled {
  source: 'purchase' | 'operating_mode';
  eventId: string | null;
  eventName: string | null;
  path: 'checkout' | 'invoice' | 'waived' | null;
  at: string;
}

/** GET /organizations/:id/tse */
export interface TseStatus {
  available: boolean;
  integrationEnabled: boolean;
  /** Automatisch eingeschaltet (Kauf einer Veranstaltung bzw. Wechsel auf „Alle Funktionen“). */
  integrationEnabledAuto?: TseAutoEnabled | null;
  /** `monthly`: Abmeldung zum Monatsende (Standard), `persistent`: bleibt aktiv. */
  lifecycle: TseLifecycle;
  country: string | null;
  eligibility: TseEligibility;
  unit: TseUnit | null;
  live: TseLive | null;
  liveError: string | null;
  outage: TseOutageSummary | null;
  counts: { signed: number; training: number; failed: number; pending: number } | null;
  exports: { lastDownloadedAt: string | null; pending: number };
  history: TseUnit[];
}

/** TSE-Daten eines Vorgangs (Kasse, Verwaltung, Beleg). */
export interface TseReceiptView {
  id: string;
  kind: TseTransactionKind;
  status: TseTransactionStatus;
  training: boolean;
  /** `TSE ausgefallen`, `TRAININGSBUCHUNG – KEIN VERKAUF` oder null. */
  notice: string | null;
  processType: string;
  processData: string;
  serialNumber: string | null;
  clientId: string;
  transactionNumber: number | null;
  signatureCounter: number | null;
  /** UTC wie von der TSE geliefert (ISO mit Millisekunden). */
  startTime: string | null;
  finishTime: string | null;
  signatureValue: string | null;
  signatureAlgorithm: string | null;
  logTimeFormat: string | null;
  publicKey: string | null;
  /** QR-Code-Inhalt nach DSFinV-K Anhang I (V0); null wenn nicht signiert. */
  qrCode: string | null;
  errorCode: string | null;
  terminal: string | null;
  /** Bezug des Vorgangs (ältere API-Versionen liefern ihn nicht). */
  orderId?: string | null;
  paymentId?: string | null;
  refundId?: string | null;
  pfandReturnId?: string | null;
  /** Beleg-Nr. der Kasse (DSFinV-K BON_NR), fortlaufend je Organisation. */
  bonNumber?: number | null;
  createdAt: string;
}

export interface TseTransactionList {
  items: TseReceiptView[];
  total: number;
}

export interface TseOutage {
  id: string;
  tseUnitId: string;
  startedAt: string;
  endedAt: string | null;
  reason: string | null;
  lastErrorMessage: string | null;
  failedCount: number;
}

export type TseExportStatus = 'pending' | 'downloaded' | 'failed';
export type TseExportTrigger = 'scheduled' | 'manual' | 'final' | 'deactivation' | 'swissbit';

export interface TseExport {
  id: string;
  status: TseExportStatus;
  trigger: TseExportTrigger;
  serialNumber: string | null;
  swissbitExportId: string | null;
  filename: string | null;
  sha256: string | null;
  sizeBytes: number | null;
  periodFrom: string | null;
  periodTo: string | null;
  createdAt: string;
  downloadedAt: string | null;
  remoteDeletedAt: string | null;
  archivedAt: string | null;
  errorCode: string | null;
  downloadable: boolean;
}

/** `tse` in GET /organizations/:id und GET /device-api/organization. */
export interface OrganizationTseSummary {
  /** Bietet dieser Server eine Cloud-TSE an (TSE_PROVIDER)? */
  available: boolean;
  integrationEnabled: boolean;
  /** Integration an und TSE aktiv (= hasActiveTse). */
  active: boolean;
  state: TseUnitState | null;
  serialNumber: string | null;
  clientId: string | null;
}

/** `tse` in GET /device-api/status; `null` = Integration aus. */
export interface DeviceTseStatus {
  state: 'ok' | 'error' | 'creating' | 'inactive';
  active: boolean;
  serialNumber: string | null;
  clientId: string | null;
  outage: TseOutageSummary | null;
}

/** Echtzeit-Ereignis `tseStatusChanged`. */
export interface TseStatusChangedEvent {
  organizationId: string;
  state: 'ok' | 'error' | 'inactive';
  outage: TseOutageSummary | null;
  reason?: string | null;
}
