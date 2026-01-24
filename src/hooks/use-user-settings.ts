import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userSettingsApi, twoFactorApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type {
  UpdateProfileDto,
  ChangePasswordDto,
  ChangeEmailDto,
  UpdatePreferencesDto,
  TwoFactorStatus,
  TotpSetupResult,
  RecoveryCodesResult,
  TrustedDevice,
  UserSession,
  UserPreferences,
} from '@/types/settings';

// Profile Hooks
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (data: UpdateProfileDto) => {
      const response = await userSettingsApi.updateProfile(data);
      return response.data;
    },
    onSuccess: (user) => {
      setUser(user);
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const response = await userSettingsApi.uploadAvatar(file);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useDeleteAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await userSettingsApi.deleteAvatar();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

// Password Hook
export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: ChangePasswordDto) => {
      await userSettingsApi.changePassword(data);
    },
  });
}

// Email Hooks
export function useRequestEmailChange() {
  return useMutation({
    mutationFn: async (data: ChangeEmailDto) => {
      await userSettingsApi.requestEmailChange(data);
    },
  });
}

export function useVerifyEmailChange() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (token: string) => {
      const response = await userSettingsApi.verifyEmailChange(token);
      return response.data;
    },
    onSuccess: (user) => {
      setUser(user);
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

// Preferences Hooks
export function usePreferences() {
  return useQuery<UserPreferences>({
    queryKey: ['user', 'preferences'],
    queryFn: async () => {
      const response = await userSettingsApi.getPreferences();
      return response.data;
    },
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdatePreferencesDto) => {
      const response = await userSettingsApi.updatePreferences(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'preferences'] });
    },
  });
}

// Sessions Hooks
export function useSessions() {
  return useQuery<UserSession[]>({
    queryKey: ['user', 'sessions'],
    queryFn: async () => {
      const response = await userSettingsApi.getSessions();
      return response.data;
    },
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      await userSettingsApi.revokeSession(sessionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'sessions'] });
    },
  });
}

export function useRevokeAllOtherSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await userSettingsApi.revokeAllOtherSessions();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'sessions'] });
    },
  });
}

// 2FA Hooks
export function use2FAStatus() {
  return useQuery<TwoFactorStatus>({
    queryKey: ['2fa', 'status'],
    queryFn: async () => {
      const response = await twoFactorApi.getStatus();
      return response.data;
    },
  });
}

export function useSetupTotp() {
  return useMutation<TotpSetupResult>({
    mutationFn: async () => {
      const response = await twoFactorApi.setupTotp();
      return response.data;
    },
  });
}

export function useVerifyTotpSetup() {
  const queryClient = useQueryClient();

  return useMutation<RecoveryCodesResult, Error, string>({
    mutationFn: async (token: string) => {
      const response = await twoFactorApi.verifyTotpSetup(token);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['2fa', 'status'] });
    },
  });
}

export function useSetupEmailOtp() {
  return useMutation({
    mutationFn: async () => {
      await twoFactorApi.setupEmailOtp();
    },
  });
}

export function useVerifyEmailOtpSetup() {
  const queryClient = useQueryClient();

  return useMutation<RecoveryCodesResult, Error, string>({
    mutationFn: async (code: string) => {
      const response = await twoFactorApi.verifyEmailOtpSetup(code);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['2fa', 'status'] });
    },
  });
}

export function useDisable2FA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (password: string) => {
      await twoFactorApi.disable2FA(password);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['2fa', 'status'] });
    },
  });
}

export function useRegenerateRecoveryCodes() {
  return useMutation<RecoveryCodesResult, Error, string>({
    mutationFn: async (password: string) => {
      const response = await twoFactorApi.regenerateRecoveryCodes(password);
      return response.data;
    },
  });
}

export function useTrustedDevices() {
  return useQuery<TrustedDevice[]>({
    queryKey: ['2fa', 'trusted-devices'],
    queryFn: async () => {
      const response = await twoFactorApi.getTrustedDevices();
      return response.data;
    },
  });
}

export function useRemoveTrustedDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deviceId: string) => {
      await twoFactorApi.removeTrustedDevice(deviceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['2fa', 'trusted-devices'] });
    },
  });
}
