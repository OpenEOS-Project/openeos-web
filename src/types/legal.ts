/**
 * Rechtstexte von OpenEOS (AGB, AVV, Datenschutzerklärung, Impressum) und
 * deren Annahme durch die Admins einer Organisation.
 *
 * Die Texte selbst liegen auf der Website (openeos.de bzw. staging); die
 * API nennt nur die gültige Fassung und die Adressen dazu.
 */

/** `anlage1`: Anlage 1 zu den AGB (Leistungsbeschreibung und Preisliste). */
export type LegalDocumentKey = 'agb' | 'anlage1' | 'avv' | 'privacy' | 'imprint';

/** Dokumente, die bei Registrierung und Buchung angenommen werden. */
export type AcceptableLegalDocument = 'agb' | 'avv';

export interface LegalDocumentVersion {
  /** Stand der Fassung, JJJJ-MM-TT; leer, solange die API nichts geliefert hat. */
  version: string | null;
  /** Aktuelle Fassung auf der Website. */
  url: string;
  /** Genau diese Fassung (bleibt auch nach einer Änderung abrufbar). */
  versionUrl: string;
  pdfUrl: string | null;
}

/** GET /legal/versions */
export interface LegalVersions {
  /** Aus auf eigenen Installationen — dort gelten keine LUXCODE-Verträge. */
  enabled: boolean;
  siteUrl: string;
  documents: Record<LegalDocumentKey, LegalDocumentVersion>;
  /**
   * Einsatzbedingungen der Cloud-TSE (Umgebungsschutzkonzept); nur wenn die
   * Cloud-TSE auf diesem Server verfügbar ist, sonst `null`/fehlt.
   */
  tseConditions?: TseConditions | null;
}

export interface TseConditions {
  url: string | null;
  text: string | null;
}

export interface LegalAcceptanceState {
  currentVersion: string;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  upToDate: boolean;
  acceptedUrl: string | null;
  acceptedPdfUrl: string | null;
}

/** Angekündigte Änderung, mit der die geltende AGB-/AVV-Fassung kam. */
export interface LegalChange {
  /** Fassung = Tag des Inkrafttretens (JJJJ-MM-TT). */
  version: string;
  documents: LegalDocumentKey[];
  /** Zeitpunkt der Ankündigung (Mail). */
  announcedAt: string;
  summaryDe: string;
  summaryEn: string | null;
  /** Nur mit ausdrücklicher Zustimmung wirksam — dann nicht aufschiebbar. */
  explicitConsent: boolean;
}

/** GET /legal/status, POST /legal/accept */
export interface LegalStatus {
  required: boolean;
  documents: Record<AcceptableLegalDocument, LegalAcceptanceState>;
  /** Fehlt bei älteren API-Ständen. */
  change?: LegalChange | null;
}

/** GET /legal/announcements — angekündigt, noch nicht in Kraft. */
export interface UpcomingLegalChange {
  id: string;
  documents: LegalDocumentKey[];
  version: string;
  summaryDe: string;
  summaryEn: string | null;
  explicitConsent: boolean;
  announcedAt: string;
  links: Partial<Record<LegalDocumentKey, { versionUrl: string; pdfUrl: string; previousUrl: string | null }>>;
}

// ── Super-Admin: Ankündigungen ─────────────────────────────────────────

export interface LegalAnnouncementInput {
  documents: LegalDocumentKey[];
  version: string;
  summaryDe: string;
  summaryEn?: string;
  shortNotice?: boolean;
  explicitConsent?: boolean;
}

export interface LegalAnnouncementProblem {
  field: 'documents' | 'version' | 'summaryDe' | 'summaryEn' | 'website';
  message: string;
  document?: LegalDocumentKey;
}

/** POST /admin/legal-announcements/preview */
export interface LegalAnnouncementPreview {
  valid: boolean;
  problems: LegalAnnouncementProblem[];
  subject: string;
  html: string;
  recipients: number;
  previousVersions: Partial<Record<LegalDocumentKey, string>>;
}

export interface LegalAnnouncementStats {
  total: number;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
}

export interface LegalAnnouncement {
  id: string;
  documents: LegalDocumentKey[];
  version: string;
  previousVersions: Partial<Record<LegalDocumentKey, string>>;
  summaryDe: string;
  summaryEn: string | null;
  shortNotice: boolean;
  explicitConsent: boolean;
  createdAt: string;
  createdByEmail: string;
  inForce: boolean;
  stats: LegalAnnouncementStats;
  failures: { email: string; error: string | null }[];
}

/** GET /admin/legal-announcements */
export interface LegalAnnouncementOverview {
  initialVersion: string;
  siteUrl: string;
  versions: Record<LegalDocumentKey, string>;
  today: string;
  noticeDays: number;
  earliestContractVersion: string;
  emailEnabled: boolean;
  contactEmail: string;
  recipients: number;
  announcements: LegalAnnouncement[];
}

export type LegalAcceptContext = 'reacceptance' | 'purchase';

export interface LegalAcceptData {
  documents?: AcceptableLegalDocument[];
  context?: LegalAcceptContext;
  organizationId?: string;
}

export type ElsterTseState = 'creating' | 'active' | 'failed' | 'deactivated';

export interface ElsterTseUnit {
  serialNumber: string | null;
  certificationId: string | null;
  certificateExpiresAt: string | null;
  productType: string;
  clientId: string;
  state: ElsterTseState;
  /** Inbetriebnahme bzw. Leihdatum. */
  activatedAt: string | null;
  /** Außerbetriebnahme. */
  deactivatedAt: string | null;
  kind: string;
}

/** GET /organizations/:id/legal/elster */
export interface ElsterInfo {
  software: { name: string; manufacturer: string; version: string };
  register: { serialNumber: string; kind: string };
  location: { name: string; street: string; zip: string; city: string; complete: boolean };
  taxNumber: string | null;
  vatId: string | null;
  tseRequired: boolean;
  tse: ElsterTseUnit[];
}
