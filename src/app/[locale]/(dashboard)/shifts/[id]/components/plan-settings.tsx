'use client';

import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Textarea } from '@/components/ui/textarea/textarea';
import { Toggle } from '@/components/ui/toggle/toggle';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import type { ShiftPlan } from '@/types/shift';

interface PlanSettingsProps {
  plan: ShiftPlan;
}

interface FormData {
  name: string;
  description: string;
  requireApproval: boolean;
  allowMultipleShifts: boolean;
  reminderDaysBefore: number;
  maxShiftsPerPerson: number;
}

export function PlanSettings({ plan }: PlanSettingsProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<FormData>({
    defaultValues: {
      name: plan.name,
      description: plan.description || '',
      requireApproval: plan.settings.requireApproval,
      allowMultipleShifts: plan.settings.allowMultipleShifts,
      reminderDaysBefore: plan.settings.reminderDaysBefore,
      maxShiftsPerPerson: plan.settings.maxShiftsPerPerson || 0,
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      shiftsApi.updatePlan(organizationId!, plan.id, {
        name: data.name,
        description: data.description || undefined,
        requireApproval: data.requireApproval,
        allowMultipleShifts: data.allowMultipleShifts,
        reminderDaysBefore: data.reminderDaysBefore,
        maxShiftsPerPerson: data.maxShiftsPerPerson || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, plan.id] });
      queryClient.invalidateQueries({ queryKey: ['shift-plans', organizationId] });
    },
  });

  const onSubmit = (data: FormData) => {
    updateMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-medium text-primary">{t('shifts.settings.title')}</h2>
        <p className="text-sm text-tertiary">Grundeinstellungen für diesen Schichtplan</p>
      </div>

      <div className="space-y-4 rounded-xl border border-secondary bg-primary p-6">
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <Input
              label={t('shifts.form.name')}
              placeholder={t('shifts.form.namePlaceholder')}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />

        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              label={t('shifts.form.description')}
              placeholder={t('shifts.form.descriptionPlaceholder')}
              rows={3}
            />
          )}
        />

        <div className="pt-2 text-sm text-tertiary">
          <strong>Öffentlicher Link:</strong>{' '}
          <code className="bg-secondary px-2 py-1 rounded">
            {typeof window !== 'undefined' ? window.location.origin : ''}/s/{plan.publicSlug}
          </code>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-secondary bg-primary p-6">
        <h3 className="font-medium text-primary">Anmeldungs-Einstellungen</h3>

        <Controller
          name="requireApproval"
          control={control}
          render={({ field }) => (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-primary">{t('shifts.settings.requireApproval')}</p>
                <p className="text-sm text-tertiary">
                  {t('shifts.settings.requireApprovalDescription')}
                </p>
              </div>
              <Toggle
                isSelected={field.value}
                onChange={field.onChange}
              />
            </div>
          )}
        />

        <Controller
          name="allowMultipleShifts"
          control={control}
          render={({ field }) => (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-primary">{t('shifts.settings.allowMultipleShifts')}</p>
                <p className="text-sm text-tertiary">
                  {t('shifts.settings.allowMultipleShiftsDescription')}
                </p>
              </div>
              <Toggle
                isSelected={field.value}
                onChange={field.onChange}
              />
            </div>
          )}
        />

        <Controller
          name="maxShiftsPerPerson"
          control={control}
          render={({ field }) => (
            <div>
              <label className="block font-medium text-primary">
                {t('shifts.settings.maxShiftsPerPerson')}
              </label>
              <p className="text-sm text-tertiary mb-2">
                {t('shifts.settings.maxShiftsPerPersonDescription')}
              </p>
              <Input
                type="number"
                className="w-32"
                value={String(field.value)}
                onChange={(value) => field.onChange(Math.max(0, parseInt(value) || 0))}
                onBlur={field.onBlur}
              />
            </div>
          )}
        />

        <Controller
          name="reminderDaysBefore"
          control={control}
          render={({ field }) => (
            <div>
              <label className="block font-medium text-primary">
                {t('shifts.settings.reminderDays')}
              </label>
              <p className="text-sm text-tertiary mb-2">
                {t('shifts.settings.reminderDaysDescription')}
              </p>
              <Input
                type="number"
                className="w-32"
                value={String(field.value)}
                onChange={(value) => field.onChange(Math.min(30, Math.max(0, parseInt(value) || 0)))}
                onBlur={field.onBlur}
              />
            </div>
          )}
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          color="primary"
          isDisabled={!isDirty || updateMutation.isPending}
          isLoading={updateMutation.isPending}
        >
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
