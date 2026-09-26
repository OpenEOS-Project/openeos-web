import { getApiBaseUrl } from '@/lib/runtime-config';

/**
 * Resolves a stored asset URL.
 *
 * The API stores upload URLs as relative paths like `/uploads/<orgId>/<cat>/<file>`
 * because static files are served by the API itself, not the frontend. This helper
 * prepends the API origin (resolved at runtime) so <img> tags resolve correctly.
 *
 * Absolute URLs (http://, https://, data:) and empty values are returned unchanged.
 */
export function resolveUploadUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (!url.startsWith('/')) return url;
  return `${getApiBaseUrl()}${url}`;
}
