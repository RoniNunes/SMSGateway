export const locales = ['en', 'es-ES', 'pt-BR'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  'es-ES': 'Español',
  'pt-BR': 'Português (BR)',
};

export function isValidLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}