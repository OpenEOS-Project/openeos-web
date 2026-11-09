export interface PfandType {
  id: string;
  organizationId: string;
  name: string;
  /** Deposit amount in EUR charged per unit. */
  amount: number;
  /**
   * Umsatzsteuersatz des Pfands in Prozent (19, 7 oder 0; Standard 19):
   * Satz der Getränke/Waren, für die das Pfand gilt. Pfand gehört zum
   * Entgelt, die Rückgabe mindert Umsatz und Steuer zum selben Satz.
   */
  vatRate: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePfandTypeData {
  name: string;
  amount: number;
  vatRate?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdatePfandTypeData {
  name?: string;
  amount?: number;
  vatRate?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface PfandReturnLine {
  pfandTypeId: string;
  name: string;
  unitAmount: number;
  quantity: number;
  /** Satz der Pfandart bei der Rückgabe; fehlt bei Auszahlungen vor 2026-11. */
  vatRate?: number;
}

/** MwSt-Zeile einer Auszahlung (Beträge negativ). */
export interface PfandReturnTaxLine {
  rate: number;
  gross: number;
  net: number;
  tax: number;
}

export interface PfandReturn {
  id: string;
  organizationId: string;
  eventId: string | null;
  deviceId: string | null;
  totalAmount: number;
  lines: PfandReturnLine[];
  /** Belegnummer `P-JJJJMMTT-NNNN` (fehlt bei Auszahlungen vor 2026-11). */
  returnNumber?: string | null;
  /** MwSt je Satz (negativ); leer ohne Umsatzsteuer (Kleinunternehmer). */
  taxLines?: PfandReturnTaxLine[];
  /** Beleg automatisch gedruckt (Einstellung „Kassenbon nach Zahlung“). */
  printed?: boolean;
  createdAt: string;
  /** Kassenbeleg der Cloud-TSE (Auszahlung); null ohne aktive TSE. */
  tse?: import('@/types/tse').TseReceiptView | null;
}

/** Input line for recording a deposit payout at the POS. */
export interface CreatePfandReturnLine {
  pfandTypeId: string;
  quantity: number;
}
