import { redirect } from '@/i18n/routing';

/**
 * /settings/webhooks führt zum Reiter „Webhooks“ der Einstellungen — die
 * E-Mail bei automatischer Abschaltung verlinkt hierher.
 */
export default async function WebhooksRedirectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: { pathname: '/settings', query: { tab: 'org-webhooks' } }, locale });
}
