import { useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { ApiException, type ApiErrorParams } from '@/types/api';

/**
 * Turns an error from the API into a sentence for the user.
 *
 * The API answers with `{ code, reason?, message, params? }`: `code` is the
 * general class (NOT_FOUND, VALIDATION_ERROR, …), `reason` the specific case
 * (SHIFT_NOT_FOUND, …), `message` a German text and `params` the values in
 * it. Translations live in `apiErrors.<CODE>`.
 *
 * Order:
 * 1. `apiErrors.<reason>`, then `apiErrors.<code>` if it is a specific code
 * 2. German UI: the German `message` from the API (validation: the field
 *    messages)
 * 3. the general text for the code (e.g. "Some entries are invalid")
 * 4. `fallback` from the caller, else a generic text
 */

/** Codes too general to replace a more precise message or fallback. */
const GENERAL_CODES = new Set([
  'INTERNAL_ERROR',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'CONFLICT',
  'UNKNOWN_ERROR',
]);

/** Not worth showing instead of the caller's fallback. */
const UNINFORMATIVE_CODES = new Set(['INTERNAL_ERROR', 'UNKNOWN_ERROR']);

type Translator = ReturnType<typeof useTranslations>;

function translate(t: Translator, key: string, params?: ApiErrorParams): string | null {
  if (!t.has(key)) return null;
  const raw = t.raw(key);
  if (typeof raw !== 'string') return null;
  // Older API versions send no params; a sentence with an empty
  // placeholder would be worse than the next fallback.
  const placeholders = Array.from(raw.matchAll(/\{(\w+)/g), (match) => match[1]);
  if (placeholders.some((name) => params?.[name] === undefined)) return null;
  const values: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(params ?? {})) {
    values[name] = typeof value === 'boolean' ? String(value) : value;
  }
  return t(key, values);
}

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && /fetch|network|load failed/i.test(error.message);
}

export function apiErrorMessage(
  error: unknown,
  t: Translator,
  locale: string,
  fallback?: string,
): string {
  if (error instanceof ApiException) {
    for (const key of [error.reason, error.code]) {
      if (key && !GENERAL_CODES.has(key)) {
        const text = translate(t, key, error.params);
        if (text) return text;
      }
    }

    if (locale === 'de') {
      if (error.code === 'VALIDATION_ERROR' && error.details?.length) {
        return error.details.map((detail) => detail.message).join(' · ');
      }
      if (error.message && error.code !== 'UNKNOWN_ERROR') return error.message;
    }

    if (!UNINFORMATIVE_CODES.has(error.code)) {
      const general = translate(t, error.code, error.params);
      if (general) return general;
    }
    return fallback ?? t('UNKNOWN_ERROR');
  }

  if (isNetworkError(error)) return t('NETWORK_ERROR');
  return fallback ?? t('UNKNOWN_ERROR');
}

/** `(error, fallback?) => string` for the current locale. */
export function useApiErrorMessage() {
  const t = useTranslations('apiErrors');
  const locale = useLocale();
  return useCallback(
    (error: unknown, fallback?: string) => apiErrorMessage(error, t, locale, fallback),
    [t, locale],
  );
}
