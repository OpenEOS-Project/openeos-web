'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';

import { DeviceLinkFlow } from '../../devices/components/device-link-flow';

export const AGENT_RELEASES_URL = 'https://github.com/OpenEOS-Project/openeos-printer-agent/releases/latest';
/** Docs page per language — like the integration docs in src/config/integrations.ts. */
export const AGENT_DOCS_URL = {
  de: 'https://docs.openeos.de/drucker',
  en: 'https://docs.openeos.de/en/drucker',
} as const;

export function agentDocsUrl(locale: string): string {
  return locale === 'en' ? AGENT_DOCS_URL.en : AGENT_DOCS_URL.de;
}

const STEPS = ['download', 'install', 'code', 'enter'] as const;

/**
 * The four steps from "nothing" to a paired agent, plus the download and
 * docs links. Shown in the connect dialog and, larger, in the empty state.
 */
export function AgentSetupSteps({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('printers.agents.connect');
  const locale = useLocale();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 12 : 16 }}>
      <ol
        style={{
          margin: 0,
          paddingLeft: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          listStyle: 'decimal',
          textAlign: 'left',
        }}
      >
        {STEPS.map((step) => (
          <li key={step} style={{ fontSize: compact ? 13 : 14, color: 'color-mix(in oklab, var(--ink) 70%, transparent)' }}>
            {t(`steps.${step}`)}
          </li>
        ))}
      </ol>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: compact ? 'flex-start' : 'center' }}>
        <a className="btn btn--ghost btn--sm" href={AGENT_RELEASES_URL} target="_blank" rel="noreferrer">
          <Icon name="download" size={14} />
          {t('downloadWindows')}
        </a>
        <a className="btn btn--ghost btn--sm" href={AGENT_RELEASES_URL} target="_blank" rel="noreferrer">
          <Icon name="download" size={14} />
          {t('downloadLinux')}
        </a>
        <a className="btn btn--ghost btn--sm" href={agentDocsUrl(locale)} target="_blank" rel="noreferrer">
          <Icon name="info" size={14} />
          {t('docs')}
        </a>
      </div>
    </div>
  );
}

interface ConnectAgentDialogProps {
  onClose: () => void;
}

/**
 * "Drucker-Agent verbinden": short instructions and the 6-digit code field.
 * Pairing is the regular device link flow, locked to printer agents so a
 * POS code entered here can't turn a till into an agent.
 */
export function ConnectAgentDialog({ onClose }: ConnectAgentDialogProps) {
  const t = useTranslations('printers.agents.connect');

  return (
    <div className="modal__overlay" role="presentation" onClick={onClose}>
      <ModalPanel titleId="connect-agent-title" className="modal__panel--md">
        <div className="modal__head">
          <h2 id="connect-agent-title" className="modal__title">
            {t('title')}
          </h2>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              background: 'color-mix(in oklab, var(--ink) 4%, transparent)',
              borderRadius: 10,
              padding: '12px 16px',
            }}
          >
            <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px' }}>{t('stepsTitle')}</h4>
            <AgentSetupSteps compact />
          </div>

          <DeviceLinkFlow fixedType="printer_agent" onFertig={onClose} />
        </div>
      </ModalPanel>
    </div>
  );
}
