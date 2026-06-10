export interface PfandType {
  id: string;
  organizationId: string;
  name: string;
  /** Deposit amount in EUR charged per unit. */
  amount: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePfandTypeData {
  name: string;
  amount: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdatePfandTypeData {
  name?: string;
  amount?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface PfandReturnLine {
  pfandTypeId: string;
  name: string;
  unitAmount: number;
  quantity: number;
}

export interface PfandReturn {
  id: string;
  organizationId: string;
  eventId: string | null;
  deviceId: string | null;
  totalAmount: number;
  lines: PfandReturnLine[];
  createdAt: string;
}

/** Input line for recording a deposit payout at the POS. */
export interface CreatePfandReturnLine {
  pfandTypeId: string;
  quantity: number;
}
