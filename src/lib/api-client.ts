import { ApiException, type ApiError, type ApiResponse } from '@/types/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_URL = `${API_BASE}/api`;
const TOKEN_STORAGE_KEY = 'openeos-access-token';
const DEVICE_TOKEN_STORAGE_KEY = 'openeos-device-token';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  useDeviceAuth?: boolean; // Use device token instead of user token
}

class ApiClient {
  private accessToken: string | null = null;
  private deviceToken: string | null = null;
  private initialized = false;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor() {
    // Initialize token from localStorage on client side
    if (typeof window !== 'undefined') {
      this.initializeToken();
    }
  }

  private initializeToken() {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) {
        this.accessToken = storedToken;
      }
      const storedDeviceToken = localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);
      if (storedDeviceToken) {
        this.deviceToken = storedDeviceToken;
      }
    } catch {
      // localStorage not available
    }
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      try {
        if (token) {
          localStorage.setItem(TOKEN_STORAGE_KEY, token);
        } else {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      } catch {
        // localStorage not available
      }
    }
  }

  getAccessToken() {
    // Ensure token is initialized
    if (typeof window !== 'undefined' && !this.initialized) {
      this.initializeToken();
    }
    return this.accessToken;
  }

  clearAccessToken() {
    this.accessToken = null;

    // Remove from localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      } catch {
        // localStorage not available
      }
    }
  }

  // Device token methods
  setDeviceToken(token: string | null) {
    this.deviceToken = token;

    if (typeof window !== 'undefined') {
      try {
        if (token) {
          localStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, token);
        } else {
          localStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY);
        }
      } catch {
        // localStorage not available
      }
    }
  }

  getDeviceToken() {
    if (typeof window !== 'undefined' && !this.initialized) {
      this.initializeToken();
    }
    return this.deviceToken;
  }

  clearDeviceToken() {
    this.deviceToken = null;

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY);
      } catch {
        // localStorage not available
      }
    }
  }

  // Attempt to refresh the access token
  private async refreshAccessToken(): Promise<boolean> {
    // If already refreshing, wait for that to complete
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Important: send cookies with the request
        });

        if (!response.ok) {
          return false;
        }

        const data = await response.json();
        if (data?.data?.accessToken) {
          this.setAccessToken(data.data.accessToken);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
    const { skipAuth = false, useDeviceAuth = false, ...fetchOptions } = options;

    // Ensure token is initialized before making request
    if (typeof window !== 'undefined' && !this.initialized) {
      this.initializeToken();
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers || {}),
    };

    if (!skipAuth) {
      if (useDeviceAuth && this.deviceToken) {
        (headers as Record<string, string>)['X-Device-Token'] = this.deviceToken;
      } else if (this.accessToken) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
      }
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      // Handle 401 Unauthorized
      if (response.status === 401 && !skipAuth) {
        if (useDeviceAuth) {
          // For device auth, clear device token and redirect to device registration
          this.clearDeviceToken();
          if (typeof window !== 'undefined') {
            window.location.href = '/device/register';
          }
        } else if (!isRetry) {
          // For user auth, try to refresh the token first
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            // Retry the original request with the new token
            return this.request<T>(endpoint, options, true);
          }
          // Refresh failed, redirect to login
          this.clearAccessToken();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        } else {
          // Already retried, redirect to login
          this.clearAccessToken();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      }

      const errorBody = await response.json().catch(() => null);

      // Handle different error response formats:
      // 1. { error: { code, message } } - wrapped format
      // 2. { code, message } - direct format
      // 3. { statusCode, message, error } - NestJS default format
      let code = 'UNKNOWN_ERROR';
      let message = 'An unknown error occurred';
      let details: import('@/types/api').ApiErrorDetail[] | undefined;

      if (errorBody) {
        if (errorBody.error?.code) {
          // Wrapped format: { error: { code, message } }
          code = errorBody.error.code;
          message = errorBody.error.message || message;
          details = errorBody.error.details;
        } else if (errorBody.code) {
          // Direct format: { code, message }
          code = errorBody.code;
          message = errorBody.message || message;
          details = errorBody.details;
        } else if (errorBody.message) {
          // NestJS default format: { statusCode, message, error }
          message = errorBody.message;
          code = errorBody.error || 'VALIDATION_ERROR';
        }
      }

      throw new ApiException(code, message, response.status, details);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();

// Auth API
export const authApi = {
  login: (credentials: { email: string; password: string }) =>
    apiClient.post<ApiResponse<import('@/types/auth').LoginResponse>>('/auth/login', credentials, {
      skipAuth: true,
    }),

  register: (data: import('@/types/auth').RegisterData) =>
    apiClient.post<ApiResponse<import('@/types/auth').AuthResponse>>('/auth/register', data, {
      skipAuth: true,
    }),

  logout: () => apiClient.post('/auth/logout'),

  refresh: () =>
    apiClient.post<ApiResponse<{ accessToken: string }>>('/auth/refresh', undefined, {
      skipAuth: true,
    }),

  me: () => apiClient.get<ApiResponse<{ user: import('@/types/auth').User }>>('/auth/me'),

  myInvitations: () =>
    apiClient.get<ApiResponse<import('@/types/auth').PendingInvitation[]>>('/auth/me/invitations'),

  acceptInvitation: (token: string) =>
    apiClient.post<ApiResponse<import('@/types/auth').UserOrganization>>(`/invitations/${token}/accept`),

  declineInvitation: (token: string) =>
    apiClient.post<{ message: string }>(`/invitations/${token}/decline`),

  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }, { skipAuth: true }),

  resetPassword: (token: string, password: string) =>
    apiClient.post('/auth/reset-password', { token, password }, { skipAuth: true }),
};

// Organizations API
export const organizationsApi = {
  list: () =>
    apiClient.get<ApiResponse<import('@/types/organization').Organization[]>>('/organizations'),

  get: (id: string) =>
    apiClient.get<ApiResponse<import('@/types/organization').Organization>>(`/organizations/${id}`),

  create: (data: import('@/types/organization').CreateOrganizationData) =>
    apiClient.post<ApiResponse<import('@/types/organization').Organization>>('/organizations', data),

  update: (id: string, data: import('@/types/organization').UpdateOrganizationData) =>
    apiClient.patch<ApiResponse<import('@/types/organization').Organization>>(`/organizations/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/organizations/${id}`),

  // Members
  getMembers: (id: string) =>
    apiClient.get<ApiResponse<import('@/types/auth').UserOrganization[]>>(`/organizations/${id}/members`),

  removeMember: (orgId: string, userId: string) =>
    apiClient.delete(`/organizations/${orgId}/members/${userId}`),

  updateMemberRole: (orgId: string, userId: string, role: string) =>
    apiClient.patch(`/organizations/${orgId}/members/${userId}`, { role }),

  // Invitations
  createInvitation: (orgId: string, data: { email: string; role: string }) =>
    apiClient.post(`/organizations/${orgId}/invitations`, data),

  getInvitations: (orgId: string) =>
    apiClient.get(`/organizations/${orgId}/invitations`),

  deleteInvitation: (orgId: string, invitationId: string) =>
    apiClient.delete(`/organizations/${orgId}/invitations/${invitationId}`),

  // Broadcasts
  broadcast: (orgId: string, data: { message: string; type?: 'info' | 'warning' | 'success' | 'error'; title?: string; duration?: number }) =>
    apiClient.post(`/organizations/${orgId}/broadcast`, data),
};

// Events API
export const eventsApi = {
  list: (organizationId: string) =>
    apiClient.get<ApiResponse<import('@/types/event').Event[]>>(`/organizations/${organizationId}/events`),

  get: (organizationId: string, id: string) =>
    apiClient.get<ApiResponse<import('@/types/event').Event>>(`/organizations/${organizationId}/events/${id}`),

  create: (organizationId: string, data: import('@/types/event').CreateEventData) =>
    apiClient.post<ApiResponse<import('@/types/event').Event>>(`/organizations/${organizationId}/events`, data),

  update: (organizationId: string, id: string, data: import('@/types/event').UpdateEventData) =>
    apiClient.patch<ApiResponse<import('@/types/event').Event>>(`/organizations/${organizationId}/events/${id}`, data),

  delete: (organizationId: string, id: string) =>
    apiClient.delete(`/organizations/${organizationId}/events/${id}`),

  activate: (organizationId: string, id: string) =>
    apiClient.post<ApiResponse<import('@/types/event').Event>>(`/organizations/${organizationId}/events/${id}/activate`),

  complete: (organizationId: string, id: string) =>
    apiClient.post<ApiResponse<import('@/types/event').Event>>(`/organizations/${organizationId}/events/${id}/complete`),

  cancel: (organizationId: string, id: string) =>
    apiClient.post<ApiResponse<import('@/types/event').Event>>(`/organizations/${organizationId}/events/${id}/cancel`),

  copyProductsFrom: (
    organizationId: string,
    targetEventId: string,
    sourceEventId: string,
    options?: { categoryIds?: string[]; productIds?: string[]; copyStock?: boolean }
  ) =>
    apiClient.post<ApiResponse<{ categoriesCopied: number; productsCopied: number }>>(
      `/organizations/${organizationId}/events/${targetEventId}/copy-from/${sourceEventId}`,
      options || {}
    ),
};

// Categories API (now under events)
export const categoriesApi = {
  list: (eventId: string) =>
    apiClient.get<ApiResponse<import('@/types/category').Category[]>>(`/events/${eventId}/categories`),

  get: (eventId: string, id: string) =>
    apiClient.get<ApiResponse<import('@/types/category').Category>>(`/events/${eventId}/categories/${id}`),

  create: (eventId: string, data: import('@/types/category').CreateCategoryData) =>
    apiClient.post<ApiResponse<import('@/types/category').Category>>(`/events/${eventId}/categories`, data),

  update: (eventId: string, id: string, data: import('@/types/category').UpdateCategoryData) =>
    apiClient.patch<ApiResponse<import('@/types/category').Category>>(`/events/${eventId}/categories/${id}`, data),

  delete: (eventId: string, id: string) =>
    apiClient.delete(`/events/${eventId}/categories/${id}`),

  reorder: (eventId: string, items: { id: string; sortOrder: number }[]) =>
    apiClient.post(`/events/${eventId}/categories/reorder`, { items }),
};

// Products API (now under events)
export const productsApi = {
  list: (eventId: string, params?: { categoryId?: string; isActive?: boolean }) =>
    apiClient.get<ApiResponse<import('@/types/product').Product[]>>(
      `/events/${eventId}/products${params ? `?${new URLSearchParams(params as Record<string, string>)}` : ''}`
    ),

  get: (eventId: string, id: string) =>
    apiClient.get<ApiResponse<import('@/types/product').Product>>(`/events/${eventId}/products/${id}`),

  create: (eventId: string, data: import('@/types/product').CreateProductData) =>
    apiClient.post<ApiResponse<import('@/types/product').Product>>(`/events/${eventId}/products`, data),

  update: (eventId: string, id: string, data: import('@/types/product').UpdateProductData) =>
    apiClient.patch<ApiResponse<import('@/types/product').Product>>(`/events/${eventId}/products/${id}`, data),

  delete: (eventId: string, id: string) =>
    apiClient.delete(`/events/${eventId}/products/${id}`),

  updateStock: (eventId: string, id: string, quantity: number, reason?: string) =>
    apiClient.post(`/events/${eventId}/products/${id}/stock/adjust`, { quantity, reason }),

  reorder: (eventId: string, items: { id: string; sortOrder: number }[]) =>
    apiClient.post(`/events/${eventId}/products/reorder`, { items }),
};

// Workflows API
export const workflowsApi = {
  list: (organizationId: string) =>
    apiClient.get<ApiResponse<import('@/types/workflow').Workflow[]>>(`/organizations/${organizationId}/workflows`),

  get: (organizationId: string, id: string) =>
    apiClient.get<ApiResponse<import('@/types/workflow').Workflow>>(`/organizations/${organizationId}/workflows/${id}`),

  create: (organizationId: string, data: import('@/types/workflow').CreateWorkflowData) =>
    apiClient.post<ApiResponse<import('@/types/workflow').Workflow>>(`/organizations/${organizationId}/workflows`, data),

  update: (organizationId: string, id: string, data: import('@/types/workflow').UpdateWorkflowData) =>
    apiClient.patch<ApiResponse<import('@/types/workflow').Workflow>>(`/organizations/${organizationId}/workflows/${id}`, data),

  delete: (organizationId: string, id: string) =>
    apiClient.delete(`/organizations/${organizationId}/workflows/${id}`),

  activate: (organizationId: string, id: string) =>
    apiClient.post<ApiResponse<import('@/types/workflow').Workflow>>(`/organizations/${organizationId}/workflows/${id}/activate`),

  deactivate: (organizationId: string, id: string) =>
    apiClient.post<ApiResponse<import('@/types/workflow').Workflow>>(`/organizations/${organizationId}/workflows/${id}/deactivate`),

  test: (organizationId: string, id: string, testData?: Record<string, unknown>) =>
    apiClient.post<ApiResponse<import('@/types/workflow').WorkflowRun>>(`/organizations/${organizationId}/workflows/${id}/test`, { testData }),

  getRuns: (organizationId: string, id: string) =>
    apiClient.get<ApiResponse<import('@/types/workflow').WorkflowRun[]>>(`/organizations/${organizationId}/workflows/${id}/runs`),
};

// User Settings API
export const userSettingsApi = {
  // Profile
  updateProfile: (data: import('@/types/settings').UpdateProfileDto) =>
    apiClient.patch<ApiResponse<import('@/types/auth').User>>('/users/me', data),

  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_URL}/users/me/avatar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiClient.getAccessToken()}`,
      },
      body: formData,
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json() as Promise<ApiResponse<{ avatarUrl: string }>>;
  },

  deleteAvatar: () =>
    apiClient.delete<ApiResponse<void>>('/users/me/avatar'),

  // Password
  changePassword: (data: import('@/types/settings').ChangePasswordDto) =>
    apiClient.post<ApiResponse<void>>('/users/me/password', data),

  // Email
  requestEmailChange: (data: import('@/types/settings').ChangeEmailDto) =>
    apiClient.post<ApiResponse<void>>('/users/me/email/change', data),

  verifyEmailChange: (token: string) =>
    apiClient.post<ApiResponse<import('@/types/auth').User>>('/users/me/email/verify', { token }),

  // Preferences
  getPreferences: () =>
    apiClient.get<ApiResponse<import('@/types/settings').UserPreferences>>('/users/me/preferences'),

  updatePreferences: (data: import('@/types/settings').UpdatePreferencesDto) =>
    apiClient.patch<ApiResponse<import('@/types/settings').UserPreferences>>('/users/me/preferences', data),

  // Sessions
  getSessions: () =>
    apiClient.get<ApiResponse<import('@/types/settings').UserSession[]>>('/users/me/sessions'),

  revokeSession: (sessionId: string) =>
    apiClient.delete<ApiResponse<void>>(`/users/me/sessions/${sessionId}`),

  revokeAllOtherSessions: () =>
    apiClient.delete<ApiResponse<void>>('/users/me/sessions'),
};

// 2FA API
export const twoFactorApi = {
  getStatus: () =>
    apiClient.get<ApiResponse<import('@/types/settings').TwoFactorStatus>>('/auth/2fa/status'),

  // TOTP Setup
  setupTotp: () =>
    apiClient.post<ApiResponse<import('@/types/settings').TotpSetupResult>>('/auth/2fa/setup/totp'),

  verifyTotpSetup: (token: string) =>
    apiClient.post<ApiResponse<import('@/types/settings').RecoveryCodesResult>>('/auth/2fa/setup/totp/verify', { token }),

  // Email OTP Setup
  setupEmailOtp: () =>
    apiClient.post<ApiResponse<void>>('/auth/2fa/setup/email'),

  verifyEmailOtpSetup: (code: string) =>
    apiClient.post<ApiResponse<import('@/types/settings').RecoveryCodesResult>>('/auth/2fa/setup/email/verify', { code }),

  // 2FA Verification (login)
  verify2FA: (data: import('@/types/settings').Verify2FADto) =>
    apiClient.post<ApiResponse<import('@/types/auth').AuthResponse>>('/auth/2fa/verify', data),

  // Disable 2FA
  disable2FA: (password: string) =>
    apiClient.post<ApiResponse<void>>('/auth/2fa/disable', { password }),

  // Recovery Codes
  regenerateRecoveryCodes: (password: string) =>
    apiClient.post<ApiResponse<import('@/types/settings').RecoveryCodesResult>>('/auth/2fa/recovery/generate', { password }),

  // Trusted Devices
  getTrustedDevices: () =>
    apiClient.get<ApiResponse<import('@/types/settings').TrustedDevice[]>>('/auth/2fa/trusted-devices'),

  removeTrustedDevice: (deviceId: string) =>
    apiClient.delete<ApiResponse<void>>(`/auth/2fa/trusted-devices/${deviceId}`),
};

// Billing API
export const billingApi = {
  getOverview: (organizationId: string) =>
    apiClient.get<ApiResponse<import('@/types/settings').BillingOverview>>(`/organizations/${organizationId}/billing`),

  createCreditCheckout: (organizationId: string, data: import('@/types/settings').CreateCheckoutDto) =>
    apiClient.post<ApiResponse<{ url: string }>>(`/organizations/${organizationId}/billing/checkout/credits`, data),

  createSubscriptionCheckout: (organizationId: string, returnUrl: string) =>
    apiClient.post<ApiResponse<{ url: string }>>(`/organizations/${organizationId}/billing/checkout/subscription`, { returnUrl }),

  createPortalSession: (organizationId: string, returnUrl: string) =>
    apiClient.post<ApiResponse<{ url: string }>>(`/organizations/${organizationId}/billing/portal`, { returnUrl }),

  getPaymentHistory: (organizationId: string) =>
    apiClient.get<ApiResponse<import('@/types/settings').CreditPurchase[]>>(`/organizations/${organizationId}/billing/history`),
};

// Orders API
export const ordersApi = {
  list: (organizationId: string, params?: import('@/types/order').QueryOrdersParams) =>
    apiClient.get<ApiResponse<import('@/types/order').Order[]>>(
      `/organizations/${organizationId}/orders${params ? `?${new URLSearchParams(params as Record<string, string>)}` : ''}`
    ),

  get: (organizationId: string, orderId: string) =>
    apiClient.get<ApiResponse<import('@/types/order').Order>>(`/organizations/${organizationId}/orders/${orderId}`),

  create: (organizationId: string, data: import('@/types/order').CreateOrderData) =>
    apiClient.post<ApiResponse<import('@/types/order').Order>>(`/organizations/${organizationId}/orders`, data),

  update: (organizationId: string, orderId: string, data: import('@/types/order').UpdateOrderData) =>
    apiClient.patch<ApiResponse<import('@/types/order').Order>>(`/organizations/${organizationId}/orders/${orderId}`, data),

  delete: (organizationId: string, orderId: string) =>
    apiClient.delete(`/organizations/${organizationId}/orders/${orderId}`),

  // Order Items
  addItem: (organizationId: string, orderId: string, data: import('@/types/order').AddOrderItemData) =>
    apiClient.post<ApiResponse<import('@/types/order').Order>>(`/organizations/${organizationId}/orders/${orderId}/items`, data),

  updateItem: (organizationId: string, orderId: string, itemId: string, data: import('@/types/order').UpdateOrderItemData) =>
    apiClient.patch<ApiResponse<import('@/types/order').Order>>(`/organizations/${organizationId}/orders/${orderId}/items/${itemId}`, data),

  removeItem: (organizationId: string, orderId: string, itemId: string) =>
    apiClient.delete<ApiResponse<import('@/types/order').Order>>(`/organizations/${organizationId}/orders/${orderId}/items/${itemId}`),

  // Status Updates
  markItemReady: (organizationId: string, orderId: string, itemId: string) =>
    apiClient.post<ApiResponse<import('@/types/order').OrderItem>>(`/organizations/${organizationId}/orders/${orderId}/items/${itemId}/ready`),

  markItemDelivered: (organizationId: string, orderId: string, itemId: string) =>
    apiClient.post<ApiResponse<import('@/types/order').OrderItem>>(`/organizations/${organizationId}/orders/${orderId}/items/${itemId}/deliver`),

  complete: (organizationId: string, orderId: string) =>
    apiClient.post<ApiResponse<import('@/types/order').Order>>(`/organizations/${organizationId}/orders/${orderId}/complete`),

  cancel: (organizationId: string, orderId: string, data?: import('@/types/order').CancelOrderData) =>
    apiClient.post<ApiResponse<import('@/types/order').Order>>(`/organizations/${organizationId}/orders/${orderId}/cancel`, data || {}),
};

// Payments API
export const paymentsApi = {
  list: (organizationId: string, params?: import('@/types/payment').QueryPaymentsParams) =>
    apiClient.get<ApiResponse<import('@/types/payment').Payment[]>>(
      `/organizations/${organizationId}/payments${params ? `?${new URLSearchParams(params as Record<string, string>)}` : ''}`
    ),

  get: (organizationId: string, paymentId: string) =>
    apiClient.get<ApiResponse<import('@/types/payment').Payment>>(`/organizations/${organizationId}/payments/${paymentId}`),

  getByOrder: (organizationId: string, orderId: string) =>
    apiClient.get<ApiResponse<import('@/types/payment').Payment[]>>(`/organizations/${organizationId}/payments/order/${orderId}`),

  create: (organizationId: string, data: import('@/types/payment').CreatePaymentData) =>
    apiClient.post<ApiResponse<import('@/types/payment').Payment>>(`/organizations/${organizationId}/payments`, data),

  createSplit: (organizationId: string, data: import('@/types/payment').SplitPaymentData) =>
    apiClient.post<ApiResponse<import('@/types/payment').Payment>>(`/organizations/${organizationId}/payments/split`, data),

  refund: (organizationId: string, paymentId: string) =>
    apiClient.post<ApiResponse<import('@/types/payment').Payment>>(`/organizations/${organizationId}/payments/${paymentId}/refund`),
};

// Admin API (Super-Admin only)
export const adminApi = {
  // Users
  listUsers: (params?: { search?: string; page?: number; limit?: number }) =>
    apiClient.get<ApiResponse<import('@/types/admin').AdminUser[]> & { meta: import('@/types/api').PaginationMeta }>(
      `/admin/users${params ? `?${new URLSearchParams(params as Record<string, string>)}` : ''}`
    ),

  unlockUser: (userId: string) =>
    apiClient.post<ApiResponse<import('@/types/admin').AdminUser>>(`/admin/users/${userId}/unlock`),

  // Organizations (admin view)
  listOrganizations: (params?: { search?: string; page?: number; limit?: number }) =>
    apiClient.get<ApiResponse<import('@/types/organization').Organization[]> & { meta: import('@/types/api').PaginationMeta }>(
      `/admin/organizations${params ? `?${new URLSearchParams(params as Record<string, string>)}` : ''}`
    ),

  getOrganization: (id: string) =>
    apiClient.get<ApiResponse<import('@/types/organization').Organization>>(`/admin/organizations/${id}`),

  updateOrganization: (id: string, data: Partial<import('@/types/organization').Organization>) =>
    apiClient.patch<ApiResponse<import('@/types/organization').Organization>>(`/admin/organizations/${id}`, data),

  adjustCredits: (orgId: string, data: { amount: number; reason: string }) =>
    apiClient.patch<ApiResponse<import('@/types/organization').Organization>>(`/admin/organizations/${orgId}/credits`, data),

  // Stats
  getOverviewStats: () =>
    apiClient.get<ApiResponse<import('@/types/admin').AdminStats>>('/admin/stats/overview'),

  // Pricing Management
  getSubscriptionConfig: () =>
    apiClient.get<ApiResponse<import('@/types/settings').SubscriptionConfig>>('/admin/subscription-config'),

  updateSubscriptionConfig: (data: { priceMonthly?: number; creditsPerMonth?: number; name?: string; description?: string }) =>
    apiClient.patch<ApiResponse<import('@/types/settings').SubscriptionConfig>>('/admin/subscription-config', data),

  getCreditPackages: () =>
    apiClient.get<ApiResponse<import('@/types/settings').CreditPackage[]>>('/admin/credit-packages'),

  createCreditPackage: (data: { name: string; description?: string; credits: number; price: number; sortOrder?: number }) =>
    apiClient.post<ApiResponse<import('@/types/settings').CreditPackage>>('/admin/credit-packages', data),

  updateCreditPackage: (id: string, data: { name?: string; description?: string; credits?: number; price?: number; isActive?: boolean; sortOrder?: number }) =>
    apiClient.patch<ApiResponse<import('@/types/settings').CreditPackage>>(`/admin/credit-packages/${id}`, data),

  deleteCreditPackage: (id: string) =>
    apiClient.delete<void>(`/admin/credit-packages/${id}`),

  syncStripeProducts: () =>
    apiClient.post<ApiResponse<void>>('/admin/stripe/sync'),
};

// Devices API
export const devicesApi = {
  // Initialize device (public - for TV apps, no organization required)
  init: (data: import('@/types/device').InitDeviceData) =>
    apiClient.post<ApiResponse<import('@/types/device').InitDeviceResponse>>(
      '/devices/init',
      data,
      { skipAuth: true }
    ),

  // Legacy: Public device registration with organization (for POS devices)
  register: (data: import('@/types/device').RegisterDeviceData) =>
    apiClient.post<ApiResponse<import('@/types/device').DeviceRegistrationResponse>>(
      '/devices/register',
      data,
      { skipAuth: true }
    ),

  // Lookup pending device by verification code (public, no auth)
  lookup: (code: string) =>
    apiClient.get<ApiResponse<import('@/types/device').PendingDeviceLookup>>(
      `/devices/lookup?code=${code}`,
      { skipAuth: true }
    ),

  // Link a pending device to an organization (requires JWT auth)
  link: (data: import('@/types/device').LinkDeviceData) =>
    apiClient.post<ApiResponse<import('@/types/device').Device>>(
      '/devices/link',
      data
    ),

  // Device status check (public, uses X-Device-Token header)
  getStatus: () =>
    apiClient.get<ApiResponse<import('@/types/device').DeviceStatusResponse>>(
      '/devices/status',
      { useDeviceAuth: true }
    ),

  // Get current device info (public, uses X-Device-Token header)
  getMe: () =>
    apiClient.get<ApiResponse<import('@/types/device').DeviceInfo>>(
      '/devices/me',
      { useDeviceAuth: true }
    ),

  // Device logout (uses X-Device-Token header)
  logout: () =>
    apiClient.post<ApiResponse<void>>(
      '/devices/logout',
      {},
      { useDeviceAuth: true }
    ),

  // Admin: List devices for organization
  list: (organizationId: string, params?: import('@/types/device').QueryDevicesParams) =>
    apiClient.get<ApiResponse<import('@/types/device').Device[]>>(
      `/organizations/${organizationId}/devices${params ? `?${new URLSearchParams(params as Record<string, string>)}` : ''}`
    ),

  // Admin: Verify device with PIN
  verify: (organizationId: string, deviceId: string, data: import('@/types/device').VerifyDeviceData) =>
    apiClient.post<ApiResponse<import('@/types/device').Device>>(
      `/organizations/${organizationId}/devices/${deviceId}/verify`,
      data
    ),

  // Admin: Block device
  block: (organizationId: string, deviceId: string) =>
    apiClient.post<ApiResponse<import('@/types/device').Device>>(
      `/organizations/${organizationId}/devices/${deviceId}/block`
    ),

  // Admin: Unblock device
  unblock: (organizationId: string, deviceId: string) =>
    apiClient.post<ApiResponse<import('@/types/device').Device>>(
      `/organizations/${organizationId}/devices/${deviceId}/unblock`
    ),

  // Admin: Update device
  update: (organizationId: string, deviceId: string, data: { name?: string; type?: import('@/types/device').DeviceClass; isActive?: boolean; settings?: Record<string, unknown> }) =>
    apiClient.patch<ApiResponse<import('@/types/device').Device>>(
      `/organizations/${organizationId}/devices/${deviceId}`,
      data
    ),

  // Admin: Update device class (legacy)
  updateClass: (organizationId: string, deviceId: string, data: import('@/types/device').UpdateDeviceClassData) =>
    apiClient.put<ApiResponse<import('@/types/device').Device>>(
      `/organizations/${organizationId}/devices/${deviceId}/class`,
      data
    ),

  // Admin: Delete device
  delete: (organizationId: string, deviceId: string) =>
    apiClient.delete<void>(`/organizations/${organizationId}/devices/${deviceId}`),

  // Admin: Get online device IDs
  getOnlineIds: (organizationId: string) =>
    apiClient.get<ApiResponse<string[]>>(`/organizations/${organizationId}/devices/online/ids`),
};

// Device API (authenticated with device token)
export const deviceApi = {
  // Get organization info and settings
  getOrganization: () =>
    apiClient.get<ApiResponse<{ id: string; name: string; settings: import('@/types/organization').OrganizationSettings }>>(
      '/device-api/organization',
      { useDeviceAuth: true }
    ),

  // Get active events for device's organization
  getEvents: () =>
    apiClient.get<ApiResponse<import('@/types/event').Event[]>>(
      '/device-api/events',
      { useDeviceAuth: true }
    ),

  // Get single event
  getEvent: (eventId: string) =>
    apiClient.get<ApiResponse<import('@/types/event').Event>>(
      `/device-api/events/${eventId}`,
      { useDeviceAuth: true }
    ),

  // Get categories for event
  getCategories: (eventId: string) =>
    apiClient.get<ApiResponse<import('@/types/category').Category[]>>(
      `/device-api/events/${eventId}/categories`,
      { useDeviceAuth: true }
    ),

  // Get products for event
  getProducts: (eventId: string) =>
    apiClient.get<ApiResponse<import('@/types/product').Product[]>>(
      `/device-api/events/${eventId}/products`,
      { useDeviceAuth: true }
    ),

  // Get open orders (unpaid/partly paid)
  getOpenOrders: () =>
    apiClient.get<ApiResponse<import('@/types/order').Order[]>>(
      '/device-api/orders/open',
      { useDeviceAuth: true }
    ),

  // Create order
  createOrder: (data: import('@/types/order').CreateOrderData) =>
    apiClient.post<ApiResponse<import('@/types/order').Order>>(
      '/device-api/orders',
      data,
      { useDeviceAuth: true }
    ),

  // Create payment
  createPayment: (data: import('@/types/payment').CreatePaymentData) =>
    apiClient.post<ApiResponse<import('@/types/payment').Payment>>(
      '/device-api/payments',
      data,
      { useDeviceAuth: true }
    ),

  // Create split payment for specific items
  createSplitPayment: (data: {
    orderId: string;
    amount: number;
    paymentMethod: import('@/types/payment').PaymentMethod;
    items: Array<{ orderItemId: string; quantity: number }>;
  }) =>
    apiClient.post<ApiResponse<import('@/types/payment').Payment>>(
      '/device-api/payments/split',
      data,
      { useDeviceAuth: true }
    ),
};

// Shifts API (Admin)
export const shiftsApi = {
  // Shift Plans
  listPlans: (organizationId: string) =>
    apiClient.get<ApiResponse<import('@/types/shift').ShiftPlan[]>>(
      `/organizations/${organizationId}/shift-plans`
    ),

  getPlan: (organizationId: string, planId: string) =>
    apiClient.get<ApiResponse<import('@/types/shift').ShiftPlan>>(
      `/organizations/${organizationId}/shift-plans/${planId}`
    ),

  createPlan: (organizationId: string, data: import('@/types/shift').CreateShiftPlanDto) =>
    apiClient.post<ApiResponse<import('@/types/shift').ShiftPlan>>(
      `/organizations/${organizationId}/shift-plans`,
      data
    ),

  updatePlan: (organizationId: string, planId: string, data: Partial<import('@/types/shift').CreateShiftPlanDto>) =>
    apiClient.patch<ApiResponse<import('@/types/shift').ShiftPlan>>(
      `/organizations/${organizationId}/shift-plans/${planId}`,
      data
    ),

  deletePlan: (organizationId: string, planId: string) =>
    apiClient.delete<void>(`/organizations/${organizationId}/shift-plans/${planId}`),

  publishPlan: (organizationId: string, planId: string) =>
    apiClient.post<ApiResponse<import('@/types/shift').ShiftPlan>>(
      `/organizations/${organizationId}/shift-plans/${planId}/publish`
    ),

  closePlan: (organizationId: string, planId: string) =>
    apiClient.post<ApiResponse<import('@/types/shift').ShiftPlan>>(
      `/organizations/${organizationId}/shift-plans/${planId}/close`
    ),

  exportPdfUrl: (organizationId: string, planId: string) =>
    `${API_URL}/organizations/${organizationId}/shift-plans/${planId}/export/pdf`,

  // Jobs
  listJobs: (organizationId: string, planId: string) =>
    apiClient.get<ApiResponse<import('@/types/shift').ShiftJob[]>>(
      `/organizations/${organizationId}/shift-plans/${planId}/jobs`
    ),

  createJob: (organizationId: string, planId: string, data: import('@/types/shift').CreateShiftJobDto) =>
    apiClient.post<ApiResponse<import('@/types/shift').ShiftJob>>(
      `/organizations/${organizationId}/shift-plans/${planId}/jobs`,
      data
    ),

  updateJob: (organizationId: string, jobId: string, data: Partial<import('@/types/shift').CreateShiftJobDto>) =>
    apiClient.patch<ApiResponse<import('@/types/shift').ShiftJob>>(
      `/organizations/${organizationId}/shift-plans/jobs/${jobId}`,
      data
    ),

  deleteJob: (organizationId: string, jobId: string) =>
    apiClient.delete<void>(`/organizations/${organizationId}/shift-plans/jobs/${jobId}`),

  // Shifts
  listShifts: (organizationId: string, jobId: string) =>
    apiClient.get<ApiResponse<import('@/types/shift').Shift[]>>(
      `/organizations/${organizationId}/shift-plans/jobs/${jobId}/shifts`
    ),

  createShift: (organizationId: string, jobId: string, data: import('@/types/shift').CreateShiftDto) =>
    apiClient.post<ApiResponse<import('@/types/shift').Shift>>(
      `/organizations/${organizationId}/shift-plans/jobs/${jobId}/shifts`,
      data
    ),

  updateShift: (organizationId: string, shiftId: string, data: Partial<import('@/types/shift').CreateShiftDto>) =>
    apiClient.patch<ApiResponse<import('@/types/shift').Shift>>(
      `/organizations/${organizationId}/shift-plans/shifts/${shiftId}`,
      data
    ),

  deleteShift: (organizationId: string, shiftId: string) =>
    apiClient.delete<void>(`/organizations/${organizationId}/shift-plans/shifts/${shiftId}`),

  createShiftsBulk: (organizationId: string, jobId: string, shifts: Array<{
    date: string;
    startTime: string;
    endTime: string;
    requiredWorkers?: number;
    notes?: string;
  }>) =>
    apiClient.post<ApiResponse<import('@/types/shift').Shift[]>>(
      `/organizations/${organizationId}/shift-plans/jobs/${jobId}/shifts/bulk`,
      { shifts }
    ),

  // Registrations
  listRegistrations: (organizationId: string, planId: string) =>
    apiClient.get<ApiResponse<import('@/types/shift').ShiftRegistration[]>>(
      `/organizations/${organizationId}/shift-plans/${planId}/registrations`
    ),

  approveRegistration: (organizationId: string, registrationId: string, message?: string) =>
    apiClient.post<ApiResponse<import('@/types/shift').ShiftRegistration>>(
      `/organizations/${organizationId}/shift-plans/registrations/${registrationId}/approve`,
      { message }
    ),

  rejectRegistration: (organizationId: string, registrationId: string, reason?: string) =>
    apiClient.post<ApiResponse<import('@/types/shift').ShiftRegistration>>(
      `/organizations/${organizationId}/shift-plans/registrations/${registrationId}/reject`,
      { reason }
    ),

  sendMessage: (organizationId: string, registrationId: string, message: string) =>
    apiClient.post<void>(
      `/organizations/${organizationId}/shift-plans/registrations/${registrationId}/message`,
      { message }
    ),

  deleteRegistration: (organizationId: string, registrationId: string) =>
    apiClient.delete<void>(
      `/organizations/${organizationId}/shift-plans/registrations/${registrationId}`
    ),
};

// Shifts Public API (no auth)
export const shiftsPublicApi = {
  getPlan: (slug: string) =>
    apiClient.get<ApiResponse<{
      id: string;
      name: string;
      description: string | null;
      organization: {
        name: string;
        logoUrl: string | null;
      };
      event: {
        name: string;
        startDate: string;
        endDate: string;
      } | null;
      settings: { allowMultipleShifts: boolean; maxShiftsPerPerson?: number };
      jobs: Array<{
        id: string;
        name: string;
        description: string | null;
        color: string | null;
        shifts: Array<{
          id: string;
          date: string;
          startTime: string;
          endTime: string;
          requiredWorkers: number;
          confirmedCount: number;
          availableSpots: number;
          isFull: boolean;
        }>;
      }>;
    }>>(`/public/shifts/${slug}`, { skipAuth: true }),

  register: (slug: string, data: {
    name: string;
    email: string;
    shiftIds: string[];
    phone?: string;
    notes?: string;
  }) =>
    apiClient.post<ApiResponse<{
      success: boolean;
      message: string;
      registrationGroupId: string;
      shiftsCount: number;
    }>>(`/public/shifts/${slug}/register`, data, { skipAuth: true }),

  verifyEmail: (token: string) =>
    apiClient.get<ApiResponse<{
      success: boolean;
      status: string;
      message: string;
      planSlug: string;
    }>>(`/public/shifts/verify/${token}`, { skipAuth: true }),
};

// Setup API (Initial setup, no auth required)
export const setupApi = {
  // Check if setup is required
  getStatus: () =>
    apiClient.get<ApiResponse<import('@/types/setup').SetupStatus>>(
      '/setup/status',
      { skipAuth: true }
    ),

  // Complete initial setup (create first admin + organization)
  complete: (data: import('@/types/setup').CompleteSetupData) =>
    apiClient.post<ApiResponse<import('@/types/setup').SetupResponse>>(
      '/setup',
      data,
      { skipAuth: true }
    ),
};
