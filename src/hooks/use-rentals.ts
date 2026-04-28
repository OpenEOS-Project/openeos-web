'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api-client';
import type {
  RentalHardware,
  RentalAssignment,
  CreateRentalHardwareData,
  UpdateRentalHardwareData,
  CreateRentalAssignmentData,
} from '@/types/rental';

export function useRentalHardware(params?: { type?: string; status?: string }) {
  return useQuery({
    queryKey: ['admin', 'rental-hardware', params],
    queryFn: async () => {
      const res = await adminApi.listRentalHardware(params);
      return res.data as unknown as RentalHardware[];
    },
  });
}

export function useCreateRentalHardware() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRentalHardwareData) =>
      adminApi.createRentalHardware(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rental-hardware'] });
    },
  });
}

export function useUpdateRentalHardware() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRentalHardwareData }) =>
      adminApi.updateRentalHardware(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rental-hardware'] });
    },
  });
}

export function useDeleteRentalHardware() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.deleteRentalHardware(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rental-hardware'] });
    },
  });
}

export function useRentalAssignments(params?: { status?: string }) {
  return useQuery({
    queryKey: ['admin', 'rental-assignments', params],
    queryFn: async () => {
      const res = await adminApi.listRentalAssignments(params);
      return res.data as unknown as RentalAssignment[];
    },
  });
}

export function useCreateRentalAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRentalAssignmentData) =>
      adminApi.createRentalAssignment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rental-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'rental-hardware'] });
    },
  });
}

export function useActivateRental() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.activateRental(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rental-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'rental-hardware'] });
    },
  });
}

export function useReturnRental() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.returnRental(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rental-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'rental-hardware'] });
    },
  });
}
