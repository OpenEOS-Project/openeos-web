import { Geist, JetBrains_Mono, Archivo_Black } from 'next/font/google';

import '@/styles/landing.css';

const geist = Geist({
  variable: '--f-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--f-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

const archivoBlack = Archivo_Black({
  variable: '--f-display',
  subsets: ['latin'],
  weight: ['400'],
});

export default function AuthSplitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`auth-shell ${geist.variable} ${jetbrainsMono.variable} ${archivoBlack.variable}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo_dark.png" alt="OpenEOS" className="auth-shell__logo" />
      <div className="landing">
        <main className="auth">{children}</main>
      </div>
    </div>
  );
}
