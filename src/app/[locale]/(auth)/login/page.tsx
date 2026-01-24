import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LoginForm } from './login-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.login');

  return {
    title: t('title'),
  };
}

export default async function LoginPage() {
  const t = await getTranslations('auth.login');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-semibold text-primary">{t('title')}</h1>
        <p className="mt-1 text-sm text-tertiary">{t('subtitle')}</p>
      </div>

      {/* Login Form */}
      <LoginForm />
    </div>
  );
}
