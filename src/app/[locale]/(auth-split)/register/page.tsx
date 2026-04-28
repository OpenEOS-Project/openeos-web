import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RegisterWizard } from './register-wizard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.register');
  return { title: t('title') };
}

export default async function RegisterPage() {
  return (
    <div className="auth__container">
      <RegisterWizard />
    </div>
  );
}
