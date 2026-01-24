import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RegisterForm } from './register-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.register');

  return {
    title: t('title'),
  };
}

export default async function RegisterPage() {
  const t = await getTranslations('auth.register');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-semibold text-primary">{t('title')}</h1>
        <p className="mt-1 text-sm text-tertiary">{t('subtitle')}</p>
      </div>

      {/* Register Form */}
      <RegisterForm />
    </div>
  );
}
