import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { discountVouchersApi } from '@/lib/api-client';
import type {
  CreateDiscountVoucherData,
  UpdateDiscountVoucherData,
} from '@/types/discount-voucher';

const keys = {
  list: (organizationId: string | undefined) =>
    ['organizations', organizationId, 'discount-vouchers'] as const,
};

export function useDiscountVouchers(organizationId: string | undefined) {
  return useQuery({
    queryKey: keys.list(organizationId),
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID required');
      const response = await discountVouchersApi.list(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
  });
}

export function useCreateDiscountVoucher(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDiscountVoucherData) =>
      discountVouchersApi.create(organizationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.list(organizationId) });
    },
  });
}

export function useUpdateDiscountVoucher(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDiscountVoucherData }) =>
      discountVouchersApi.update(organizationId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.list(organizationId) });
    },
  });
}

export function useDeleteDiscountVoucher(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => discountVouchersApi.delete(organizationId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.list(organizationId) });
    },
  });
}
