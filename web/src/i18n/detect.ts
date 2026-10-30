import { defaultLocale, isValidLocale, type Locale } from '@/i18n/locales';

/** Detect locale from cookie or Accept-Language (es → es-ES, pt → pt-BR, en → en). */
export function detectLocale(acceptLanguage: string | null, cookie: string | null | undefined): Locale {
  if (cookie && isValidLocale(cookie)) return cookie;

  if (!acceptLanguage) return defaultLocale;

  const candidates = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, qPart] = part.trim().split(';');
      const q = qPart?.startsWith('q=') ? parseFloat(qPart.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of candidates) {
    if (tag.startsWith('es')) return 'es-ES';
    if (tag.startsWith('pt')) return 'pt-BR';
    if (tag.startsWith('en')) return 'en';
  }

  return defaultLocale;
}