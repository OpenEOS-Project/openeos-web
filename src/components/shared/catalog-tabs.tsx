'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import { cx } from '@/utils/cx';

type CatalogTab = 'products' | 'categories';

const TABS: { id: CatalogTab; href: string }[] = [
  { id: 'products', href: '/products' },
  { id: 'categories', href: '/categories' },
];

/**
 * Reiter „Produkte | Kategorien“ über beiden Seiten.
 *
 * In der Seitenleiste gibt es nur noch den Eintrag „Produkte“; Kategorien
 * bleiben unter /categories erreichbar und sind hier der zweite Reiter.
 * Links statt Knöpfe: jede Seite behält ihre Adresse (Lesezeichen, neuer Tab).
 */
export function CatalogTabs({ active }: { active: CatalogTab }) {
  const t = useTranslations('navigation');

  return (
    <nav className="oe-tabs" aria-label={t('catalogTabs')} data-testid="catalog-tabs">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href as never}
          className={cx('oe-tab', tab.id === active && 'is-active')}
          aria-current={tab.id === active ? 'page' : undefined}
          style={{ textDecoration: 'none' }}
        >
          {t(tab.id)}
        </Link>
      ))}
    </nav>
  );
}
