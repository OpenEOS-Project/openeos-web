/**
 * Resolves a stored asset URL.
 *
 * The API stores upload URLs as relative paths like `/uploads/<orgId>/<cat>/<file>`
 * because static files are served by the API itself, not the frontend. This helper
 * prepends the API origin (from NEXT_PUBLIC_API_URL) so <img> tags resolve correctly.
 *
 * Absolute URLs (http://, https://, data:) and empty values are returned unchanged.
 */
export function resolveUploadUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (!url.startsWith('/')) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return `${base.replace(/\/$/, '')}${url}`;
}
