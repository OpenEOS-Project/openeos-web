'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart01, Check } from '@untitledui/icons';
import { Toggle } from '@/components/ui/toggle/toggle';
import { useAuthStore } from '@/stores/auth-store';
import { organizationsApi } from '@/lib/api-client';
import { cx } from '@/utils/cx';

export function OrganizationPosSection() {
  const t = useTranslations('settings.organizationPos');
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const queryClient = useQueryClient();

  const posSettings = currentOrganization?.organization?.settings?.pos;

  const defaultPosSettings: {
    requireTableNumber: boolean;
    autoPrintReceipt: boolean;
    soundEnabled: boolean;
    orderingMode: 'immediate' | 'tab';
  } = {
    requireTableNumber: false,
    autoPrintReceipt: false,
    soundEnabled: true,
    orderingMode: 'immediate',
  };

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<typeof defaultPosSettings>) => {
      if (!currentOrganization) throw new Error('No organization');
      const response = await organizationsApi.update(currentOrganization.organizationId, {
        settings: {
          ...currentOrganization.organization?.settings,
          pos: {
            ...defaultPosSettings,
            ...posSettings,
            ...settings,
          },
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (currentOrganization?.organization) {
        setCurrentOrganization({
          ...currentOrganization,
          organization: data,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  const orderingModes = [
    {
      id: 'immediate',
      label: t('orderingMode.immediate'),
      description: t('orderingMode.immediateDescription'),
    },
    {
      id: 'tab',
      label: t('orderingMode.tab'),
      description: t('orderingMode.tabDescription'),
    },
  ];

  const currentMode = posSettings?.orderingMode || 'immediate';

  const handleModeChange = async (mode: 'immediate' | 'tab') => {
    await updateSettings.mutateAsync({ orderingMode: mode });
  };

  const handleToggleChange = async (key: 'requireTableNumber' | 'autoPrintReceipt' | 'soundEnabled', value: boolean) => {
    await updateSettings.mutateAsync({ [key]: value });
  };

  if (!currentOrganization) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Ordering Mode */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="border-b border-secondary px-6 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart01 className="h-5 w-5 text-tertiary" />
            <h3 className="text-lg font-semibold text-primary">{t('orderingMode.title')}</h3>
          </div>
          <p className="text-sm text-tertiary mt-1">{t('orderingMode.description')}</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orderingModes.map((mode) => {
              const isActive = currentMode === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => handleModeChange(mode.id as 'immediate' | 'tab')}
                  disabled={updateSettings.isPending}
                  className={cx(
                    'relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all',
                    isActive
                      ? 'border-brand-primary bg-brand-primary_alt'
                      : 'border-secondary hover:border-primary hover:bg-secondary'
                  )}
                >
                  {isActive && (
                    <div className="absolute top-3 right-3">
                      <Check className="h-5 w-5 text-brand-primary" />
                    </div>
                  )}
                  <span
                    className={cx(
                      'text-md font-semibold',
                      isActive ? 'text-brand-primary' : 'text-primary'
                    )}
                  >
                    {mode.label}
                  </span>
                  <span
                    className={cx(
                      'text-sm',
                      isActive ? 'text-brand-secondary' : 'text-tertiary'
                    )}
                  >
                    {mode.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Other POS Settings */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="border-b border-secondary px-6 py-4">
          <h3 className="text-lg font-semibold text-primary">{t('options.title')}</h3>
        </div>

        <div className="divide-y divide-secondary">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="font-medium text-primary">{t('options.requireTableNumber')}</p>
              <p className="text-sm text-tertiary">{t('options.requireTableNumberDescription')}</p>
            </div>
            <Toggle
              isSelected={posSettings?.requireTableNumber ?? false}
              onChange={(isSelected) => handleToggleChange('requireTableNumber', isSelected)}
              isDisabled={updateSettings.isPending}
            />
          </div>

          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="font-medium text-primary">{t('options.autoPrintReceipt')}</p>
              <p className="text-sm text-tertiary">{t('options.autoPrintReceiptDescription')}</p>
            </div>
            <Toggle
              isSelected={posSettings?.autoPrintReceipt ?? false}
              onChange={(isSelected) => handleToggleChange('autoPrintReceipt', isSelected)}
              isDisabled={updateSettings.isPending}
            />
          </div>

          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="font-medium text-primary">{t('options.soundEnabled')}</p>
              <p className="text-sm text-tertiary">{t('options.soundEnabledDescription')}</p>
            </div>
            <Toggle
              isSelected={posSettings?.soundEnabled ?? true}
              onChange={(isSelected) => handleToggleChange('soundEnabled', isSelected)}
              isDisabled={updateSettings.isPending}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
