/**
 * Rechtstexte von OpenEOS (AGB, AVV, Datenschutzerklärung, Impressum) und
 * deren Annahme durch die Admins einer Organisation.
 *
 * Die Texte selbst liegen auf der Website (openeos.de bzw. staging); die
 * API nennt nur die gültige Fassung und die Adressen dazu.
 */

export type LegalDocumentKey = 'agb' | 'avv' | 'privacy' | 'imprint';

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

/** GET /legal/status, POST /legal/accept */
export interface LegalStatus {
  required: boolean;
  documents: Record<AcceptableLegalDocument, LegalAcceptanceState>;
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
