import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LoginComic } from './login-comic';
import { LoginForm } from './login-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.login');
  return { title: t('title') };
}

export default async function LoginPage() {
  return (
    <div className="auth__split">
      <div className="auth__left">
        <LoginComic />
      </div>
      <div className="auth__right">
        <LoginForm />
      </div>
    </div>
  );
}
