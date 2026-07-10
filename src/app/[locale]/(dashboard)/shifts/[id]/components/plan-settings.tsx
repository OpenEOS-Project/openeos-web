'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { ToggleSwitch } from '@/components/shared/toggle-switch';
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
  verificationReminderEnabled: boolean;
  verificationReminderIntervalHours: number;
  verificationReminderMaxCount: number;
}

interface ToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  isLast?: boolean;
}

function ToggleRow({ title, description, checked, onChange, isLast }: ToggleRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingBottom: isLast ? 0 : 16,
        marginBottom: isLast ? 0 : 16,
        borderBottom: isLast ? 'none' : '1px solid color-mix(in oklab, var(--ink) 6%, transparent)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 2 }}>{description}</div>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} aria-label={title} />
    </div>
  );
}

interface SectionCardProps {
  title: string;
  subtitle?: string;
  danger?: boolean;
  children: React.ReactNode;
}

function SectionCard({ title, subtitle, danger, children }: SectionCardProps) {
  return (
    <div className="app-card" style={danger ? { borderColor: 'color-mix(in oklab, var(--danger) 30%, transparent)' } : undefined}>
      <div className="app-card__head" style={{ display: 'block' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: danger ? 'var(--danger)' : 'var(--ink)' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <div className="app-card__body">{children}</div>
    </div>
  );
}

export function PlanSettings({ plan }: PlanSettingsProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;
  const [linkCopied, setLinkCopied] = useState(false);

  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { isDirty },
  } = useForm<FormData>({
    defaultValues: {
      name: plan.name,
      description: plan.description || '',
      requireApproval: plan.settings.requireApproval,
      allowMultipleShifts: plan.settings.allowMultipleShifts,
      reminderDaysBefore: plan.settings.reminderDaysBefore,
      maxShiftsPerPerson: plan.settings.maxShiftsPerPerson || 0,
      verificationReminderEnabled: plan.settings.verificationReminderEnabled ?? true,
      verificationReminderIntervalHours: plan.settings.verificationReminderIntervalHours ?? 24,
      verificationReminderMaxCount: plan.settings.verificationReminderMaxCount ?? 5,
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
        verificationReminderEnabled: data.verificationReminderEnabled,
        verificationReminderIntervalHours: data.verificationReminderIntervalHours,
        verificationReminderMaxCount: data.verificationReminderMaxCount,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, plan.id] });
      queryClient.invalidateQueries({ queryKey: ['shift-plans', organizationId] });
      reset(variables);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => shiftsApi.deletePlan(organizationId!, plan.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-plans', organizationId] });
      router.push('/shifts');
    },
  });

  const onSubmit = (data: FormData) => updateMutation.mutate(data);

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/s/${plan.publicSlug}` : `/s/${plan.publicSlug}`;

  const copyPublicLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(publicUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = publicUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{t('shifts.settings.title')}</h2>
        <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', margin: '4px 0 0' }}>
          Grundeinstellungen für diesen Schichtplan
        </p>
      </div>

      <SectionCard title="Allgemein" subtitle="Name und Beschreibung — die Helfer sehen das auf der öffentlichen Seite.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="auth-field">
            <label className="auth-field__label">{t('shifts.form.name')}</label>
            <input className="input" placeholder={t('shifts.form.namePlaceholder')} {...register('name')} />
          </div>
          <div className="auth-field">
            <label className="auth-field__label">{t('shifts.form.description')}</label>
            <textarea className="textarea" rows={3} placeholder={t('shifts.form.descriptionPlaceholder')} {...register('description')} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Öffentlicher Link" subtitle="Diesen Link kannst du an die Helfer weitergeben.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <code
            style={{
              flex: '1 1 240px',
              minWidth: 0,
              fontFamily: 'var(--f-mono)',
              fontSize: 12,
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
              background: 'var(--paper)',
              color: 'var(--ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {publicUrl}
          </code>
          <button
            type="button"
            className="btn btn--ghost"
            style={{
              fontSize: 13,
              color: linkCopied ? 'var(--green-ink)' : undefined,
              borderColor: linkCopied ? 'var(--green-ink)' : undefined,
            }}
            onClick={copyPublicLink}
          >
            {linkCopied ? '✓ Kopiert!' : 'Link kopieren'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            style={{ fontSize: 13 }}
            onClick={() => window.open(`/s/${plan.publicSlug}`, '_blank')}
          >
            Vorschau
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Anmeldungs-Einstellungen" subtitle="Wie sich die Helfer eintragen können.">
        <Controller
          name="requireApproval"
          control={control}
          render={({ field }) => (
            <ToggleRow
              title={t('shifts.settings.requireApproval')}
              description={t('shifts.settings.requireApprovalDescription')}
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          name="allowMultipleShifts"
          control={control}
          render={({ field }) => (
            <ToggleRow
              title={t('shifts.settings.allowMultipleShifts')}
              description={t('shifts.settings.allowMultipleShiftsDescription')}
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          name="maxShiftsPerPerson"
          control={control}
          render={({ field }) => (
            <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{t('shifts.settings.maxShiftsPerPerson')}</div>
              <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 8 }}>{t('shifts.settings.maxShiftsPerPersonDescription')}</div>
              <input
                className="input"
                type="number"
                style={{ width: 120 }}
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
            <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{t('shifts.settings.reminderDays')}</div>
              <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 8 }}>{t('shifts.settings.reminderDaysDescription')}</div>
              <input
                className="input"
                type="number"
                style={{ width: 120 }}
                value={String(field.value)}
                onChange={(e) => field.onChange(Math.min(30, Math.max(0, parseInt(e.target.value) || 0)))}
                onBlur={field.onBlur}
              />
            </div>
          )}
        />

        <Controller
          name="verificationReminderEnabled"
          control={control}
          render={({ field }) => (
            <ToggleRow
              title="Verifizierungs-Erinnerungen"
              description="Schickt Helfern, die ihre E-Mail noch nicht bestätigt haben, regelmäßig eine Erinnerung."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          name="verificationReminderIntervalHours"
          control={control}
          render={({ field }) => (
            <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Intervall (Stunden)</div>
              <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 8 }}>Wie viele Stunden zwischen zwei Erinnerungen. Default 24.</div>
              <input
                className="input"
                type="number"
                style={{ width: 120 }}
                value={String(field.value)}
                onChange={(e) => field.onChange(Math.min(168, Math.max(1, parseInt(e.target.value) || 24)))}
                onBlur={field.onBlur}
              />
            </div>
          )}
        />

        <Controller
          name="verificationReminderMaxCount"
          control={control}
          render={({ field }) => (
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Maximale Anzahl Erinnerungen</div>
              <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 8 }}>Nach dieser Anzahl an Erinnerungen wird nicht weiter nachgehakt. Default 5.</div>
              <input
                className="input"
                type="number"
                style={{ width: 120 }}
                value={String(field.value)}
                onChange={(e) => field.onChange(Math.min(20, Math.max(0, parseInt(e.target.value) || 0)))}
                onBlur={field.onBlur}
              />
            </div>
          )}
        />
      </SectionCard>

      {/* Save bar */}
      {isDirty && (
        <div
          style={{
            position: 'sticky',
            bottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
            background: 'color-mix(in oklab, var(--paper) 92%, transparent)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 16px rgba(20, 18, 12, 0.08)',
          }}
        >
          <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)' }}>
            Du hast ungespeicherte Änderungen.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() =>
                reset({
                  name: plan.name,
                  description: plan.description || '',
                  requireApproval: plan.settings.requireApproval,
                  allowMultipleShifts: plan.settings.allowMultipleShifts,
                  reminderDaysBefore: plan.settings.reminderDaysBefore,
                  maxShiftsPerPerson: plan.settings.maxShiftsPerPerson || 0,
                  verificationReminderEnabled: plan.settings.verificationReminderEnabled ?? true,
                  verificationReminderIntervalHours: plan.settings.verificationReminderIntervalHours ?? 24,
                  verificationReminderMaxCount: plan.settings.verificationReminderMaxCount ?? 5,
                })
              }
            >
              Verwerfen
            </button>
            <button type="submit" className="btn btn--primary" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      )}

      <SectionCard
        title="Gefahrenzone"
        subtitle="Diese Aktion kann nicht rückgängig gemacht werden."
        danger
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 280px' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Plan löschen</div>
            <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 2 }}>
              Löscht den Schichtplan einschließlich aller Arbeiten, Schichten und Anmeldungen.
            </div>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            style={{ color: 'var(--danger)', borderColor: 'color-mix(in oklab, var(--danger) 40%, transparent)' }}
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (confirm(t('shifts.confirmDelete'))) {
                deleteMutation.mutate();
              }
            }}
          >
            {deleteMutation.isPending ? t('common.deleting') : 'Plan löschen'}
          </button>
        </div>
      </SectionCard>
    </form>
  );
}
