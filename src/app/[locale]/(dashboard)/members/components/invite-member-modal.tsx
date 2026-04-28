'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

import { useCreateInvitation } from '@/hooks/use-members';
import type { OrganizationPermissions } from '@/types/auth';

interface InviteMemberModalProps {
  isOpen: boolean;
  organizationId: string;
  onClose: () => void;
}

const PERMISSION_KEYS: (keyof OrganizationPermissions)[] = [
  'products',
  'events',
  'devices',
  'members',
  'shiftPlans',
];

const inviteSchema = z.object({
  email: z.string().email(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

export function InviteMemberModal({ isOpen, organizationId, onClose }: InviteMemberModalProps) {
  const t = useTranslations('members');
  const tCommon = useTranslations('common');
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState<OrganizationPermissions>({
    products: false,
    events: false,
    devices: false,
    members: false,
    shiftPlans: false,
  });

  const createInvitation = useCreateInvitation(organizationId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: InviteFormData) => {
    setError(null);
    try {
      await createInvitation.mutateAsync({
        email: data.email,
        role: isAdmin ? 'admin' : 'member',
        permissions: isAdmin ? undefined : permissions,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    }
  };

  const handleClose = () => {
    reset();
    setIsAdmin(false);
    setPermissions({ products: false, events: false, devices: false, members: false, shiftPlans: false });
    setError(null);
    onClose();
  };

  const togglePermission = (key: keyof OrganizationPermissions) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal__overlay" style={{ display: 'flex' }} onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal__panel" style={{ maxWidth: 480 }}>
        <div className="modal__head">
          <h2 className="modal__title">{t('invite')}</h2>
          <button type="button" className="btn btn--ghost" style={{ padding: '6px 8px', minWidth: 0 }} onClick={handleClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{
                borderRadius: 8,
                background: 'color-mix(in oklab, var(--red, #dc2626) 10%, var(--paper))',
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--red, #dc2626)',
                border: '1px solid color-mix(in oklab, var(--red, #dc2626) 25%, transparent)',
              }}>
                {error}
              </div>
            )}

            <label className="auth-field">
              <span>{t('form.email')}</span>
              <input
                type="email"
                className={`input${errors.email ? ' input--error' : ''}`}
                placeholder={t('form.emailPlaceholder')}
                autoComplete="email"
                {...register('email', { required: true })}
              />
            </label>

            {/* Admin toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <div
                role="switch"
                aria-checked={isAdmin}
                tabIndex={0}
                onClick={() => setIsAdmin((v) => !v)}
                onKeyDown={(e) => e.key === ' ' && setIsAdmin((v) => !v)}
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  background: isAdmin ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 20%, var(--paper))',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: 3,
                  left: isAdmin ? 21 : 3,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.15s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t('form.isAdmin')}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{t('form.isAdminHint')}</div>
              </div>
            </label>

            {/* Module permissions */}
            {!isAdmin && (
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{t('permissions.title')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {PERMISSION_KEYS.map((key) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={!!permissions[key]}
                        onChange={() => togglePermission(key)}
                        style={{ width: 16, height: 16, accentColor: 'var(--green-ink)', cursor: 'pointer' }}
                      />
                      {t(`permissions.${key}`)}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {isAdmin && (
              <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{t('permissions.adminHint')}</p>
            )}
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose}>
              {tCommon('cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={createInvitation.isPending}>
              {createInvitation.isPending ? '...' : t('invite')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
