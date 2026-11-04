'use client';

import { useTranslations } from 'next-intl';

import { formatCurrency } from '@/utils/format';
import { Icon } from '@openeos/ui';

import type { EventTseTerms } from '@/types/billing';

interface CheckoutTseSectionProps {
  tse: EventTseTerms;
  /** Antwort im Bestand (`optional`): `null` = noch keine Wahl. */
  answer: boolean | null;
  onAnswer: (value: boolean) => void;
  locale: string;
  disabled?: boolean;
}

/**
 * Cloud-TSE im Bezahldialog (Deutschland). „Alle Funktionen“: eine Zeile,
 * dass die TSE dazugehört und automatisch eingerichtet wird. Bestand
 * (Bargeld ohne TSE): die Frage „Mit Cloud-TSE?“ — „Ja“ stellt beim
 * Freischalten auf „Alle Funktionen“ um. Ein Zuschlag erscheint nur, wenn
 * der Betreiber einen eingestellt hat (derzeit inklusive). Fehlende
 * Steuerangaben fragt der Dialog im Schritt „Angaben zu deiner
 * Organisation“ ab (PurchaseMasterDataStep).
 */
export function CheckoutTseSection({
  tse,
  answer,
  onAnswer,
  locale,
  disabled,
}: CheckoutTseSectionProps) {
  const t = useTranslations('events.checkout.tse');
  if (!tse.offer) return null;

  const surcharge = tse.surcharge > 0 ? formatCurrency(tse.surcharge, locale) : null;
  const muted = {
    fontSize: 12,
    color: 'color-mix(in oklab, var(--ink) 55%, transparent)',
  } as const;

  return (
    <div
      data-testid="checkout-tse"
      data-offer={tse.offer}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
      }}
    >
      {tse.offer === 'included' ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            fontSize: 13,
            color: 'var(--ink)',
          }}
        >
          <span style={{ color: 'var(--green-ink)', display: 'inline-flex', marginTop: 1 }}>
            <Icon name="shield" size={16} />
          </span>
          <span>
            {t('included')}
            {surcharge && <span style={muted}> · {t('surchargeLine', { amount: surcharge })}</span>}
          </span>
        </div>
      ) : (
        <fieldset
          style={{
            border: 0,
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <legend
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink)',
              marginBottom: 4,
              padding: 0,
            }}
          >
            {t('question')}
          </legend>
          {[true, false].map((value) => (
            <label
              key={String(value)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--ink)',
              }}
            >
              <input
                type="radio"
                name="checkout-with-tse"
                checked={answer === value}
                disabled={disabled}
                onChange={() => onAnswer(value)}
                data-testid={value ? 'checkout-tse-yes' : 'checkout-tse-no'}
                style={{
                  marginTop: 3,
                  width: 16,
                  height: 16,
                  accentColor: 'var(--green-ink)',
                  flexShrink: 0,
                }}
              />
              <span>
                {value ? t('yes') : t('no')}
                {value && surcharge && (
                  <span style={muted}> · {t('surchargeLine', { amount: surcharge })}</span>
                )}
                <span style={{ ...muted, display: 'block' }}>
                  {value ? t('yesHint') : t('noHint')}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
