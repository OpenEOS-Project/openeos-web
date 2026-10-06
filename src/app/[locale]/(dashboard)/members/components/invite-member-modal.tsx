'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useAddMember, useCanCreateMemberAccount, useCreateInvitation } from '@/hooks/use-members';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { SettingToggle } from '@/components/shared/setting-toggle';
import { toast } from '@/components/shared/toast';
import { useAuthStore } from '@/stores/auth-store';
import { ApiException } from '@/types/api';
import type { OrganizationPermissions } from '@/types/auth';

interface InviteMemberModalProps {
  isOpen: boolean;
  organizationId: string;
  onClose: () => void;
}

type Mode = 'invite' | 'create';

const PERMISSION_KEYS: (keyof OrganizationPermissions)[] = [
  'products',
  'events',
  'devices',
  'members',
  'shiftPlans',
  'discounts',
  'pfand',
  'reports',
  'inventory',
];

const NO_PERMISSIONS: OrganizationPermissions = Object.fromEntries(
  PERMISSION_KEYS.map((key) => [key, false]),
);

interface FormState {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  passwordConfirm: string;
}

const EMPTY_FORM: FormState = {
  email: '',
  firstName: '',
  lastName: '',
  password: '',
  passwordConfirm: '',
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const TITLE_ID = 'invite-member-title';

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function InviteMemberModal({ isOpen, organizationId, onClose }: InviteMemberModalProps) {
  const t = useTranslations('members');
  const tAdd = useTranslations('memberAdd');
  const tErr = useTranslations('memberAdd.errors');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { currentOrganization, user } = useAuthStore();

  const actorIsAdmin = !!user?.isSuperAdmin || currentOrganization?.role === 'admin';
  const ownPermissions = currentOrganization?.permissions ?? {};
  // Im gehosteten Betrieb (und fuer Nicht-Admins) bleibt der Dialog beim Einladen.
  const canCreateAccount = useCanCreateMemberAccount();

  const [mode, setMode] = useState<Mode>('invite');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  /* Konto zur Adresse existiert schon: dann laesst es sich ohne Startpasswort
     hinzufuegen. Ohne Mailversand ist das der einzige Weg, denn eine
     Einladung nimmt man nur ueber den Link aus der E-Mail an. */
  const [existingAccount, setExistingAccount] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState<OrganizationPermissions>(NO_PERMISSIONS);

  const createInvitation = useCreateInvitation(organizationId);
  const addMember = useAddMember(organizationId);
  const isPending = createInvitation.isPending || addMember.isPending;

  const activeMode: Mode = canCreateAccount ? mode : 'invite';

  const update = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'email') setExistingAccount(false);
    if (errors[key]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[key];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    const email = form.email.trim();
    if (!email) next.email = tErr('required');
    else if (!isEmail(email)) next.email = tErr('emailInvalid');

    if (activeMode === 'create') {
      if (!form.firstName.trim()) next.firstName = tErr('required');
      else if (form.firstName.trim().length < 2) next.firstName = tErr('nameShort');
      if (!form.lastName.trim()) next.lastName = tErr('required');
      else if (form.lastName.trim().length < 2) next.lastName = tErr('nameShort');

      if (!form.password) next.password = tErr('required');
      else if (form.password.length < 8) next.password = tErr('passwordShort');
      else if (form.password.length > 72) next.password = tErr('passwordLong');
      else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password))
        next.password = tErr('passwordWeak');
      if (!form.passwordConfirm) next.passwordConfirm = tErr('required');
      else if (form.password !== form.passwordConfirm)
        next.passwordConfirm = tErr('passwordMismatch');
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const describeError = (err: unknown): string => {
    if (err instanceof ApiException) {
      switch (err.code) {
        case 'USER_EXISTS':
          return tErr('userExists');
        case 'MEMBER_ALREADY_EXISTS':
          return tErr('alreadyMember');
        case 'CONFLICT':
          return tErr('invitationPending');
        case 'FORBIDDEN':
          return tErr('forbidden');
        default:
          return apiErrorMessage(err, tErr('generic'));
      }
    }
    return tErr('generic');
  };

  const handleClose = () => {
    setMode('invite');
    setForm(EMPTY_FORM);
    setErrors({});
    setSubmitError(null);
    setExistingAccount(false);
    setIsAdmin(false);
    setPermissions(NO_PERMISSIONS);
    onClose();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitError(null);
    setExistingAccount(false);

    const email = form.email.trim();
    const role = isAdmin ? 'admin' : 'member';
    const grantedPermissions = isAdmin ? undefined : permissions;

    try {
      if (activeMode === 'create') {
        const firstName = form.firstName.trim();
        const lastName = form.lastName.trim();
        await addMember.mutateAsync({
          email,
          role,
          permissions: grantedPermissions,
          firstName,
          lastName,
          password: form.password,
        });
        toast.success(tAdd('created', { name: `${firstName} ${lastName}` }));
      } else {
        await createInvitation.mutateAsync({ email, role, permissions: grantedPermissions });
        toast.success(tAdd('invited', { email }));
      }
      handleClose();
    } catch (err) {
      setExistingAccount(err instanceof ApiException && err.code === 'USER_EXISTS');
      setSubmitError(describeError(err));
    }
  };

  const addExistingAccount = async () => {
    const email = form.email.trim();
    setSubmitError(null);
    setExistingAccount(false);
    try {
      await addMember.mutateAsync({
        email,
        role: isAdmin ? 'admin' : 'member',
        permissions: isAdmin ? undefined : permissions,
      });
      toast.success(tAdd('addedExisting', { email }));
      handleClose();
    } catch (err) {
      setSubmitError(describeError(err));
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setSubmitError(null);
    setExistingAccount(false);
  };

  const togglePermission = (key: keyof OrganizationPermissions) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isOpen) return null;

  const title = canCreateAccount ? tAdd('title') : t('invite');
  const submitLabel =
    activeMode === 'create' ? tAdd('submitCreate') : canCreateAccount ? tAdd('submitInvite') : t('invite');

  return (
    <div className="modal__overlay" style={{ display: 'flex' }} onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <ModalPanel titleId={TITLE_ID} className="modal__panel--sm">
        <div className="modal__head">
          <h2 id={TITLE_ID} className="modal__title">{title}</h2>
          <DialogCloseButton onClick={handleClose} />
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {canCreateAccount && (
              <div>
                <div className="tab-bar" role="tablist" aria-label={tAdd('modeLabel')} style={{ marginBottom: 10 }}>
                  {(['invite', 'create'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={activeMode === key}
                      className={`tab-bar__tab${activeMode === key ? ' tab-bar__tab--active' : ''}`}
                      onClick={() => switchMode(key)}
                    >
                      {key === 'invite' ? tAdd('modeInvite') : tAdd('modeCreate')}
                    </button>
                  ))}
                </div>
                <p className="auth-field__hint" style={{ margin: 0 }}>
                  {activeMode === 'create' ? tAdd('createHint') : tAdd('inviteHint')}
                </p>
              </div>
            )}

            {submitError && (
              <div role="alert" style={{
                borderRadius: 8,
                background: 'color-mix(in oklab, var(--red, var(--danger)) 10%, var(--paper))',
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--red, var(--danger))',
                border: '1px solid color-mix(in oklab, var(--red, var(--danger)) 25%, transparent)',
              }}>
                {submitError}
                {existingAccount && activeMode === 'create' && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={addExistingAccount}
                      disabled={isPending}
                    >
                      {tAdd('addExisting')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeMode === 'create' && (
              <div className="field-row">
                <TextField
                  label={tAdd('firstName')}
                  value={form.firstName}
                  error={errors.firstName}
                  autoComplete="off"
                  onChange={(v) => update('firstName', v)}
                />
                <TextField
                  label={tAdd('lastName')}
                  value={form.lastName}
                  error={errors.lastName}
                  autoComplete="off"
                  onChange={(v) => update('lastName', v)}
                />
              </div>
            )}

            <TextField
              label={t('form.email')}
              type="email"
              value={form.email}
              error={errors.email}
              placeholder={t('form.emailPlaceholder')}
              autoComplete="off"
              onChange={(v) => update('email', v)}
            />

            {activeMode === 'create' && (
              <>
                <TextField
                  label={tAdd('password')}
                  type="password"
                  value={form.password}
                  error={errors.password}
                  hint={tAdd('passwordHint')}
                  autoComplete="new-password"
                  onChange={(v) => update('password', v)}
                />
                <TextField
                  label={tAdd('passwordConfirm')}
                  type="password"
                  value={form.passwordConfirm}
                  error={errors.passwordConfirm}
                  autoComplete="new-password"
                  onChange={(v) => update('passwordConfirm', v)}
                />
                <p className="auth-field__hint" style={{ margin: 0 }}>{tAdd('handoverHint')}</p>
              </>
            )}

            {/* Die Admin-Rolle vergibt nur ein Admin; die API prueft das ebenfalls. */}
            {actorIsAdmin && (
              <SettingToggle
                label={t('form.isAdmin')}
                hint={t('form.isAdminHint')}
                checked={isAdmin}
                onChange={setIsAdmin}
              />
            )}

            {!isAdmin && (
              <div>
                <p className="auth-field__label" style={{ marginBottom: 10 }}>{t('permissions.title')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {PERMISSION_KEYS.map((key) => {
                    const grantable = actorIsAdmin || !!ownPermissions[key];
                    return (
                      <label
                        key={key}
                        title={grantable ? undefined : tAdd('permissionNotOwned')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: grantable ? 'pointer' : 'not-allowed',
                          fontSize: 13,
                          opacity: grantable ? 1 : 0.5,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!permissions[key]}
                          disabled={!grantable}
                          onChange={() => togglePermission(key)}
                          style={{ width: 16, height: 16, accentColor: 'var(--green-ink)', cursor: 'inherit' }}
                        />
                        {t(`permissions.${key}`)}
                      </label>
                    );
                  })}
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
            <button type="submit" className="btn btn--primary" disabled={isPending}>
              {isPending ? tCommon('saving') : submitLabel}
            </button>
          </div>
        </form>
      </ModalPanel>
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}

function TextField({ label, value, onChange, error, hint, type = 'text', placeholder, autoComplete }: TextFieldProps) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        className={error ? 'input--error' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <span role="alert" className="auth-field__error">{error}</span>}
      {!error && hint && <span className="auth-field__hint">{hint}</span>}
    </label>
  );
}
