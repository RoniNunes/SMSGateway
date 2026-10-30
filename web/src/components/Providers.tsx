'use client';

import CookieConsent from '@/components/CookieConsent';
import { I18nProvider } from '@/i18n/I18nProvider';
import type { Locale } from '@/i18n/config';

export default function Providers({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: Locale;
  messages: Record<string, unknown>;
}) {
  return (
    <I18nProvider locale={locale} messages={messages}>
      {children}
      <CookieConsent />
    </I18nProvider>
  );
}