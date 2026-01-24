import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'OpenEOS',
    template: '%s | OpenEOS',
  },
  description: 'Modernes Kassensystem für Vereine, Veranstaltungen und Festbewirtungen',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'OpenEOS',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0f0f' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
