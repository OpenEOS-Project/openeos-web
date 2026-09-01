'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth-store';
import { organizationsApi } from '@/lib/api-client';
import { SettingToggle } from '@/components/shared/setting-toggle';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';

type PfandPolicy = { tableService: boolean; counterPickup: boolean };

const DEFAULTS: PfandPolicy = { tableService: false, counterPickup: true };

interface PfandSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Die Pfand-Regeln als Dialog.
 *
 * Zuvor stand die Karte dauerhaft ueber der Typenliste. Es sind zwei
 * Schalter, die man einmal setzt und danach kaum wieder anfasst — sie
 * schoben die eigentliche Arbeit, das Anlegen der Pfand-Typen, jedes Mal
 * nach unten aus dem Bild.
 */
export function PfandSettingsModal({ isOpen, onClose }: PfandSettingsModalProps) {
  const t = useTranslations('pfand.settings');
  const tCommon = useTranslations('common');
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const queryClient = useQueryClient();

  const policy = {
    ...DEFAULTS,
    ...(currentOrganization?.organization?.settings?.pfand ?? {}),
  };

  const updatePolicy = useMutation({
    mutationFn: async (next: Partial<PfandPolicy>) => {
      if (!currentOrganization) throw new Error('No organization');
      const response = await organizationsApi.update(currentOrganization.organizationId, {
        settings: {
          ...currentOrganization.organization?.settings,
          pfand: { ...policy, ...next },
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (currentOrganization?.organization) {
        setCurrentOrganization({ ...currentOrganization, organization: data });
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  if (!isOpen || !currentOrganization) return null;

  const rows: { key: keyof PfandPolicy }[] = [
    { key: 'tableService' },
    { key: 'counterPickup' },
  ];

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div className="modal__panel modal__panel--md" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h2>{t('title')}</h2>
            <p className="modal__sub">{t('description')}</p>
          </div>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body">
          {/* Die Trennlinien zieht die Liste, nicht die einzelne Zeile. */}
          <div className="oe-setting-list">
        {rows.map(({ key }) => {
          const isChecked = policy[key];
          return (
            <SettingToggle
              key={key}
              flush
              label={t(`${key}.label`)}
              hint={t(`${key}.description`)}
              checked={isChecked}
              disabled={updatePolicy.isPending}
              onChange={() => updatePolicy.mutate({ [key]: !isChecked })}
            />
          );
          })}
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {tCommon('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
