import { type AppLanguage, createTranslator } from './i18n.ts';

export function validateRulesQuery(
  rawQuery: unknown,
  lang: AppLanguage = 'pt-BR',
): {
  ok: boolean;
  query: string;
  error?: string;
} {
  const t = createTranslator(lang);
  if (typeof rawQuery !== 'string') {
    return { ok: false, query: '', error: t('sidebar.errQueryInvalid') };
  }
  const trimmed = rawQuery.trim();
  if (trimmed.length < 2) {
    return {
      ok: false,
      query: trimmed,
      error: t('sidebar.errQueryTooShort'),
    };
  }
  if (trimmed.length > 300) {
    return {
      ok: false,
      query: trimmed,
      error: t('sidebar.errQueryTooLong'),
    };
  }
  return { ok: true, query: trimmed };
}


