'use client';

import { useI18n } from '@/i18n/I18nProvider';
import Link from 'next/link';

export function ConsentText({ messageKey }: { messageKey: string }) {
  const { t } = useI18n();
  const raw = t(messageKey);

  const segments: React.ReactNode[] = [];
  let remaining = raw;
  const tokens = [
    { key: '{privacyLink}', href: '/privacy', label: t('legal.footer.privacy') },
    { key: '{termsLink}', href: '/terms', label: t('legal.footer.terms') },
  ];

  while (remaining.length > 0) {
    let earliest = -1;
    let token = tokens[0];
    for (const tok of tokens) {
      const idx = remaining.indexOf(tok.key);
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx;
        token = tok;
      }
    }
    if (earliest === -1) {
      segments.push(remaining);
      break;
    }
    if (earliest > 0) segments.push(remaining.slice(0, earliest));
    segments.push(
      <Link key={`${token.href}-${earliest}`} href={token.href}>
        {token.label}
      </Link>,
    );
    remaining = remaining.slice(earliest + token.key.length);
  }

  return <>{segments}</>;
}