'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Phone01,
  QrCode01,
  Calendar,
  BarChartSquare02,
} from '@untitledui/icons';

const ICONS = [Phone01, QrCode01, Calendar, BarChartSquare02];

const HIGHLIGHTS = [
  { titleKey: 'mobile', copyKey: 'mobileCopy' },
  { titleKey: 'qrOrder', copyKey: 'qrOrderCopy' },
  { titleKey: 'shifts', copyKey: 'shiftsCopy' },
  { titleKey: 'stats', copyKey: 'statsCopy' },
] as const;

export function LoginHighlights() {
  const t = useTranslations('auth.login.highlights');
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % HIGHLIGHTS.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="auth-loop">
      <div className="auth-loop__head">
        <span className="pill">
          <span className="pill__dot" />
          <span>{t('head')}</span>
        </span>
      </div>

      <div className="auth-loop__stage" aria-live="polite">
        {HIGHLIGHTS.map((item, i) => {
          const Icon = ICONS[i];
          return (
            <article
              key={item.titleKey}
              className={`auth-loop__card ${i === active ? 'is-active' : ''}`}
              aria-hidden={i !== active}
            >
              <span className="auth-loop__icon">
                <Icon />
              </span>
              <h3>{t(item.titleKey)}</h3>
              <p>{t(item.copyKey)}</p>
            </article>
          );
        })}
      </div>

      <div className="auth-loop__dots" role="tablist">
        {HIGHLIGHTS.map((item, i) => (
          <button
            key={item.titleKey}
            type="button"
            className={`auth-loop__dot ${i === active ? 'is-active' : ''}`}
            aria-label={t(item.titleKey)}
            onClick={() => setActive(i)}
          />
        ))}
      </div>
    </div>
  );
}
