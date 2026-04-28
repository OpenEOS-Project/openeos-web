'use client';

import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
    register,
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

  const onSubmit = (data: FormData) => updateMutation.mutate(data);

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{t('shifts.settings.title')}</h2>
        <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>Grundeinstellungen für diesen Schichtplan</p>
      </div>

      {/* Basic info */}
      <div className="app-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="auth-field">
          <label className="auth-field__label">{t('shifts.form.name')}</label>
          <input className="input" placeholder={t('shifts.form.namePlaceholder')} {...register('name')} />
        </div>

        <div className="auth-field">
          <label className="auth-field__label">{t('shifts.form.description')}</label>
          <textarea className="textarea" rows={3} placeholder={t('shifts.form.descriptionPlaceholder')} {...register('description')} />
        </div>

        <div style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
          <strong>Öffentlicher Link:</strong>{' '}
          <code style={{ background: 'color-mix(in oklab, var(--ink) 6%, transparent)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--f-mono)', fontSize: 12 }}>
            {typeof window !== 'undefined' ? window.location.origin : ''}/s/{plan.publicSlug}
          </code>
        </div>
      </div>

      {/* Registration settings */}
      <div className="app-card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Anmeldungs-Einstellungen</div>

        <Controller
          name="requireApproval"
          control={control}
          render={({ field }) => (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t('shifts.settings.requireApproval')}</div>
                <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('shifts.settings.requireApprovalDescription')}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                onClick={() => field.onChange(!field.value)}
                style={{
                  width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: field.value ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 18%, transparent)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: field.value ? 21 : 3,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>
          )}
        />

        <Controller
          name="allowMultipleShifts"
          control={control}
          render={({ field }) => (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t('shifts.settings.allowMultipleShifts')}</div>
                <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('shifts.settings.allowMultipleShiftsDescription')}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                onClick={() => field.onChange(!field.value)}
                style={{
                  width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: field.value ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 18%, transparent)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: field.value ? 21 : 3,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>
          )}
        />

        <Controller
          name="maxShiftsPerPerson"
          control={control}
          render={({ field }) => (
            <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t('shifts.settings.maxShiftsPerPerson')}</div>
              <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 8 }}>{t('shifts.settings.maxShiftsPerPersonDescription')}</div>
              <input
                className="input"
                type="number"
                style={{ width: 100 }}
                value={String(field.value)}
                onChange={(e) => field.onChange(Math.max(0, parseInt(e.target.value) || 0))}
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
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t('shifts.settings.reminderDays')}</div>
              <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 8 }}>{t('shifts.settings.reminderDaysDescription')}</div>
              <input
                className="input"
                type="number"
                style={{ width: 100 }}
                value={String(field.value)}
                onChange={(e) => field.onChange(Math.min(30, Math.max(0, parseInt(e.target.value) || 0)))}
                onBlur={field.onBlur}
              />
            </div>
          )}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={!isDirty || updateMutation.isPending}
        >
          {updateMutation.isPending ? '...' : t('common.save')}
        </button>
      </div>
    </form>
  );
}
