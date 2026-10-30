'use client';

import { localeLabels, locales, type Locale } from '@/i18n/locales';
import { useI18n } from '@/i18n/I18nProvider';

export default function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();

  return (
    <div style={{ display: 'flex', gap: compact ? 4 : 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => void setLocale(loc)}
          className="btn-ghost"
          style={{
            padding: compact ? '4px 8px' : '6px 10px',
            fontSize: compact ? 11 : 12,
            fontWeight: locale === loc ? 700 : 500,
            borderColor: locale === loc ? 'var(--primary)' : undefined,
            color: locale === loc ? 'var(--primary)' : 'var(--text-muted)',
          }}
          aria-pressed={locale === loc}
        >
          {compact ? loc.split('-')[0].toUpperCase() : localeLabels[loc as Locale]}
        </button>
      ))}
    </div>
  );
}