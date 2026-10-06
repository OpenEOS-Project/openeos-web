import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { DEFAULT_TIME_ZONE } from '@/utils/format';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Validate that the incoming `locale` parameter is valid
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    // Explizit, damit Server und Browser Zeitpunkte gleich deuten: ohne
    // Angabe nimmt next-intl die Zone der jeweiligen Umgebung (Server UTC,
    // Browser lokal) und meldet einen moeglichen Hydration-Unterschied.
    timeZone: DEFAULT_TIME_ZONE,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
