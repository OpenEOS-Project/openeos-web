import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '@/lib/api-client';
import type { BillingOverview, CreditPurchase, CreateCheckoutDto } from '@/types/settings';

export function useBillingOverview(organizationId: string | undefined) {
  return useQuery<BillingOverview>({
    queryKey: ['billing', 'overview', organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID required');
      const response = await billingApi.getOverview(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
  });
}

export function usePaymentHistory(organizationId: string | undefined) {
  return useQuery<CreditPurchase[]>({
    queryKey: ['billing', 'history', organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID required');
      const response = await billingApi.getPaymentHistory(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
  });
}

export function useCreateCreditCheckout(organizationId: string | undefined) {
  return useMutation({
    mutationFn: async (data: CreateCheckoutDto) => {
      if (!organizationId) throw new Error('Organization ID required');
      const response = await billingApi.createCreditCheckout(organizationId, data);
      return response.data;
    },
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

export function useCreateSubscriptionCheckout(organizationId: string | undefined) {
  return useMutation({
    mutationFn: async (returnUrl: string) => {
      if (!organizationId) throw new Error('Organization ID required');
      const response = await billingApi.createSubscriptionCheckout(organizationId, returnUrl);
      return response.data;
    },
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

export function useCreatePortalSession(organizationId: string | undefined) {
  return useMutation({
    mutationFn: async (returnUrl: string) => {
      if (!organizationId) throw new Error('Organization ID required');
      const response = await billingApi.createPortalSession(organizationId, returnUrl);
      return response.data;
    },
    onSuccess: (data) => {
      // Redirect to Stripe billing portal
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}
