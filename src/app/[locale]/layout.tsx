import { openEosFonts } from '@openeos/ui/fonts';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import { Providers } from '@/components/providers/index';
import { routing } from '@/i18n/routing';

import '@/styles/globals.css';

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  // Validate locale
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Get messages for the locale
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={openEosFonts.className}
      suppressHydrationWarning
    >
      <body
        className="min-h-screen bg-primary text-primary antialiased"
        style={{ fontFamily: 'var(--f-sans, system-ui, sans-serif)' }}
      >
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
