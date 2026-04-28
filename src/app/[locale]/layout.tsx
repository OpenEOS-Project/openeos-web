import { Geist, JetBrains_Mono, Archivo_Black } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import { Providers } from '@/components/providers/index';
import { routing } from '@/i18n/routing';

import '@/styles/globals.css';

const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--f-sans',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--f-mono',
  weight: ['400', '500', '600'],
});

const archivoBlack = Archivo_Black({
  subsets: ['latin'],
  display: 'swap',
  variable: '--f-display',
  weight: ['400'],
});

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
      className={`${geist.variable} ${jetbrainsMono.variable} ${archivoBlack.variable}`}
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
