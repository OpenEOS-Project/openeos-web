'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth-store';
import { organizationsApi } from '@/lib/api-client';
import type { UpdateOrganizationData } from '@/types/organization';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveUploadUrl } from '@/utils/upload-url';
import { toast } from '@/components/shared/toast';
import { SettingToggle } from '@/components/shared/setting-toggle';

function createOrgGeneralSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('nameRequired')),
    description: z.string().optional(),
  });
}

type OrgGeneralFormData = z.infer<ReturnType<typeof createOrgGeneralSchema>>;

export function OrganizationGeneralSection() {
  const t = useTranslations('settings.organizationGeneral');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');
  const orgGeneralSchema = useMemo(() => createOrgGeneralSchema(tValidation), [tValidation]);
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const updateOrg = useMutation({
    mutationFn: async (data: UpdateOrganizationData) => {
      if (!currentOrganization) throw new Error('No organization');
      const response = await organizationsApi.update(currentOrganization.organizationId, data);
      return response.data;
    },
    onSuccess: (data) => {
      if (currentOrganization?.organization) {
        setCurrentOrganization({ ...currentOrganization, organization: data });
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      // Setzt das Formular auf die gerade gespeicherten Werte zurueck, sonst
      // bleibt der Speichern-Button nach Erfolg aktiv (isDirty bleibt true).
      reset({ name: data.name, description: data.settings?.description || '' });
    },
    // Ohne das blieb ein abgelehntes Speichern voellig stumm.
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : tCommon('error'));
    },
  });

  /* Der Steuer-Schalter speichert sofort und unabhaengig vom Formular.
     Eigene Mutation, damit sein Erfolg nicht ueber reset() noch nicht
     gespeicherte Eingaben in Name/Beschreibung verwirft. */
  const updateVatExempt = useMutation({
    mutationFn: async (vatExempt: boolean) => {
      if (!currentOrganization) throw new Error('No organization');
      const response = await organizationsApi.update(currentOrganization.organizationId, {
        settings: { vatExempt },
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (currentOrganization?.organization) {
        setCurrentOrganization({ ...currentOrganization, organization: data });
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : tCommon('error'));
    },
  });

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<OrgGeneralFormData>({
    resolver: zodResolver(orgGeneralSchema),
    defaultValues: {
      name: currentOrganization?.organization?.name || '',
      description: currentOrganization?.organization?.settings?.description || '',
    },
  });

  /* Die Beschreibung gehoert in `settings`. Oben auf der Organisation gibt
     es kein Feld dafuer, und die API lehnte das ganze Speichern deshalb ab
     ("property description should not exist") — auch den Namen. Die API
     fuehrt `settings` eine Ebene tief zusammen, der Rest bleibt stehen. */
  const onSubmit = (data: OrgGeneralFormData) => {
    updateOrg.mutate({ name: data.name, settings: { description: data.description ?? '' } });
  };

  const applyLogoUrl = (logoUrl: string | null) => {
    if (!currentOrganization?.organization) return;
    setCurrentOrganization({
      ...currentOrganization,
      organization: {
        ...currentOrganization.organization,
        logoUrl,
      },
    });
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentOrganization) return;
    setIsUploading(true);
    try {
      const response = await organizationsApi.uploadLogo(currentOrganization.organizationId, file);
      const newLogoUrl = response?.data?.logoUrl ?? null;
      applyLogoUrl(newLogoUrl);
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('uploadLogoFailed');
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogoDelete = async () => {
    if (!currentOrganization?.organization) return;
    setIsUploading(true);
    try {
      await organizationsApi.deleteLogo(
        currentOrganization.organizationId,
        currentOrganization.organization.logoUrl,
      );
      applyLogoUrl(null);
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('removeLogoFailed');
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  if (!currentOrganization) return null;

  const logoUrl = currentOrganization.organization?.logoUrl ?? null;

  return (
    <div className="app-card">
      <div className="app-card__head" style={{ display: 'block' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{t('title')}</h2>
        <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', margin: '4px 0 0' }}>{t('description')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="app-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div
              style={{
                width: 72, height: 72, borderRadius: 12,
                border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                background: logoUrl ? 'var(--paper)' : 'color-mix(in oklab, var(--ink) 5%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
              }}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveUploadUrl(logoUrl)} alt={currentOrganization.organization?.name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="color-mix(in oklab, var(--ink) 35%, transparent)" strokeWidth="1.5">
                  <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
                </svg>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: '1 1 200px' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t('logo')}</span>
              <span style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
                {t('logoHint')}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  style={{ fontSize: 12 }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? tCommon('saving') : logoUrl ? t('replaceLogo') : t('uploadLogo')}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ fontSize: 12, color: 'var(--red, var(--danger))' }}
                    onClick={handleLogoDelete}
                    disabled={isUploading}
                  >
                    {t('removeLogo')}
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleLogoChange} style={{ display: 'none' }} />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-field__label" htmlFor="org-name">{t('name')}</label>
            <input id="org-name" className="input" {...register('name')} />
            {errors.name && <span role="alert" className="auth-field__error">{errors.name.message}</span>}
          </div>

          <div className="auth-field">
            <label className="auth-field__label" htmlFor="org-description">{t('description_field')}</label>
            <textarea id="org-description" className="textarea" rows={3} {...register('description')} />
          </div>

          {/* Steuerpflicht. Bewusst hier und nicht bei den Produkten: sie
              gilt fuer die ganze Organisation, und aus ihr folgt, welche
              Saetze ein Produkt ueberhaupt tragen darf. Frueher stand der
              Schalter in der Fusszeile neben "Speichern" — er speichert
              aber sofort und gehoert deshalb zu den Feldern. */}
          <SettingToggle
            label={t('vatExempt.label')}
            hint={t('vatExempt.hint')}
            checked={currentOrganization.organization?.settings?.vatExempt !== false}
            disabled={updateVatExempt.isPending}
            onChange={(checked) => updateVatExempt.mutate(checked)}
          />
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '14px 20px',
          borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)',
        }}>
          <button type="submit" className="btn btn--primary" disabled={!isDirty || updateOrg.isPending}>
            {updateOrg.isPending ? t('saving') : t('saveChanges')}
          </button>
        </div>
      </form>
    </div>
  );
}
