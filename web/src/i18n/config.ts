import legalEn from '@/i18n/legal/en.json';
import legalEsES from '@/i18n/legal/es-ES.json';
import legalPtBR from '@/i18n/legal/pt-BR.json';
import en from '@/i18n/messages/en.json';
import esES from '@/i18n/messages/es-ES.json';
import ptBR from '@/i18n/messages/pt-BR.json';

export const locales = ['en', 'es-ES', 'pt-BR'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  'es-ES': 'Español',
  'pt-BR': 'Português (BR)',
};

const legalCatalogs: Record<Locale, Record<string, unknown>> = {
  en: legalEn,
  'es-ES': legalEsES,
  'pt-BR': legalPtBR,
};

function withLegal(locale: Locale, base: Record<string, unknown>): Record<string, unknown> {
  return { ...base, legal: legalCatalogs[locale] ?? legalCatalogs.en };
}

const catalogs: Record<Locale, Record<string, unknown>> = {
  en: withLegal('en', en),
  'es-ES': withLegal('es-ES', esES),
  'pt-BR': withLegal('pt-BR', ptBR),
};

export function isValidLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export async function getMessages(locale: Locale): Promise<Record<string, unknown>> {
  return catalogs[locale] ?? catalogs.en;
}

export function getMessagesSync(locale: Locale): Record<string, unknown> {
  return catalogs[locale] ?? catalogs.en;
}