export interface SumUpReaderDevice {
  identifier: string;
  model: 'solo' | 'virtual-solo';
}

export interface SumUpReader {
  id: string;
  name: string;
  status: 'unknown' | 'processing' | 'paired' | 'expired';
  device: SumUpReaderDevice;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SumUpReaderStatus {
  data: {
    battery_level?: number;
    connection_type?: string;
    firmware_version?: string;
    last_activity?: string;
    state?: string;
    status: 'ONLINE' | 'OFFLINE';
  };
}

export interface SumUpCheckoutResponse {
  data: {
    client_transaction_id: string;
  };
}
