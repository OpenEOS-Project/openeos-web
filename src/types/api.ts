// Standard API Response wrapper
export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

// Pagination metadata (matches NestJS camelCase format)
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Error response format
export interface ApiError {
  /** General error class (VALIDATION_ERROR, NOT_FOUND, …). */
  code: string;
  /** Specific case behind a general code, e.g. SHIFT_NOT_FOUND. */
  reason?: string;
  /** German message from the API — fallback only, see useApiErrorMessage. */
  message: string;
  /** Values contained in the message (names, amounts, limits). */
  params?: ApiErrorParams;
  details?: ApiErrorDetail[];
  requestId?: string;
  timestamp?: string;
}

export interface ApiErrorDetail {
  field?: string;
  code?: string;
  message: string;
}

export type ApiErrorParams = Record<string, string | number | boolean>;

// Error codes from API documentation
export type ApiErrorCode =
  // General errors
  | 'INTERNAL_ERROR'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  // Auth errors
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_INACTIVE'
  | 'EMAIL_NOT_VERIFIED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'REFRESH_TOKEN_REVOKED'
  // Business logic errors
  | 'ORDER_ALREADY_PAID'
  | 'ORDER_CANCELLED'
  | 'INSUFFICIENT_STOCK'
  | 'PAYMENT_FAILED'
  | 'PRINTER_OFFLINE'
  | 'EVENT_NOT_ACTIVE'
  | 'INVITATION_EXPIRED'
  | 'MEMBER_ALREADY_EXISTS'
  | 'INVENTORY_IN_PROGRESS'
  | 'INVENTORY_ALREADY_COMPLETED'
  // Credit & license errors
  | 'INSUFFICIENT_CREDITS'
  | 'CREDITS_REQUIRED'
  | 'EVENT_ACTIVATION_BLOCKED'
  | 'PAYMENT_PENDING'
  | 'PURCHASE_FAILED'
  | 'INVALID_PACKAGE'
  // Integrations
  | 'INTEGRATION_NOT_FOUND'
  | 'INTEGRATION_DISABLED';

export class ApiException extends Error {
  constructor(
    public code: ApiErrorCode | string,
    public override message: string,
    public status: number,
    public details?: ApiErrorDetail[],
    public reason?: string,
    public params?: ApiErrorParams
  ) {
    super(message);
    this.name = 'ApiException';
  }
}
