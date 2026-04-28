'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { useUpdateMember, useSetMemberPin, useRemoveMemberPin } from '@/hooks/use-members';
import type { OrganizationPermissions, UserOrganization } from '@/types/auth';

interface EditPermissionsModalProps {
  isOpen: boolean;
  organizationId: string;
  member: UserOrganization & { user?: { firstName: string; lastName: string; email: string } };
  onClose: () => void;
}

const PERMISSION_KEYS: (keyof OrganizationPermissions)[] = [
  'products',
  'events',
  'devices',
  'members',
  'shiftPlans',
];

export function EditPermissionsModal({ isOpen, organizationId, member, onClose }: EditPermissionsModalProps) {
  const t = useTranslations('members');
  const tCommon = useTranslations('common');

  const [isAdmin, setIsAdmin] = useState(member.role === 'admin');
  const [permissions, setPermissions] = useState<OrganizationPermissions>({
    products: false,
    events: false,
    devices: false,
    members: false,
    shiftPlans: false,
    ...member.permissions,
  });
  const [error, setError] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const updateMember = useUpdateMember(organizationId);
  const setMemberPin = useSetMemberPin(organizationId);
  const removeMemberPin = useRemoveMemberPin(organizationId);

  useEffect(() => {
    setIsAdmin(member.role === 'admin');
    setPermissions({
      products: false,
      events: false,
      devices: false,
      members: false,
      shiftPlans: false,
      ...member.permissions,
    });
    setError(null);
    setPinInput('');
    setPinError(null);
  }, [member]);

  const handleSave = async () => {
    setError(null);
    try {
      await updateMember.mutateAsync({
        userId: member.userId,
        role: isAdmin ? 'admin' : 'member',
        permissions: isAdmin ? {} : permissions,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    }
  };

  const handleClose = () => {
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
          <div>
            <h2 className="modal__title">{t('permissions.title')}</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-faint)', margin: 0 }}>
              {member.user?.firstName} {member.user?.lastName}
            </p>
          </div>
          <button type="button" className="btn btn--ghost" style={{ padding: '6px 8px', minWidth: 0 }} onClick={handleClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

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

          {/* PIN Section */}
          <div style={{ borderTop: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)', paddingTop: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('pin.title')}</p>
            <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 12 }}>{t('pin.hint')}</p>

            {member.hasPin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="badge badge--success">{t('pin.hasPin')}</span>
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={async () => {
                    setPinError(null);
                    try {
                      await removeMemberPin.mutateAsync(member.userId);
                    } catch (err) {
                      setPinError(err instanceof Error ? err.message : 'Error');
                    }
                  }}
                  disabled={removeMemberPin.isPending}
                >
                  {removeMemberPin.isPending ? '...' : t('pin.remove')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pinInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setPinInput(val);
                    setPinError(null);
                  }}
                  placeholder={t('pin.placeholder')}
                  className="input"
                  style={{ width: 120 }}
                />
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={async () => {
                    if (!/^\d{4,6}$/.test(pinInput)) {
                      setPinError(t('pin.invalid'));
                      return;
                    }
                    setPinError(null);
                    try {
                      await setMemberPin.mutateAsync({ userId: member.userId, pin: pinInput });
                      setPinInput('');
                    } catch (err) {
                      setPinError(err instanceof Error ? err.message : 'Error');
                    }
                  }}
                  disabled={setMemberPin.isPending || !pinInput}
                >
                  {setMemberPin.isPending ? '...' : t('pin.set')}
                </button>
              </div>
            )}

            {pinError && (
              <p style={{ marginTop: 6, fontSize: 12, color: 'var(--red, #dc2626)' }}>{pinError}</p>
            )}
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={handleClose}>
            {tCommon('cancel')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSave}
            disabled={updateMember.isPending}
          >
            {updateMember.isPending ? '...' : tCommon('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
