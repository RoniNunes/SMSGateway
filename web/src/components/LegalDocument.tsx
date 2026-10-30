'use client';

import { useI18n } from '@/i18n/I18nProvider';
import type { LegalSettings } from '@/lib/legal-settings';
import { legalVars } from '@/lib/legal-settings';
import Link from 'next/link';

type DocType = 'privacy' | 'terms' | 'cookies';

function interpolate(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

export default function LegalDocument({
  type,
  sections,
  settings,
}: {
  type: DocType;
  sections: readonly string[];
  settings: LegalSettings;
}) {
  const { t } = useI18n();
  const vars = legalVars(settings);

  return (
    <article className="legal-doc">
      <header className="legal-doc-header">
        <Link href="/" className="legal-back">← {t('common.back')}</Link>
        <h1>{t(`legal.${type}.title`)}</h1>
        <p className="legal-meta">
          {t('legal.versionLabel')}: {settings.legalVersion} · {t('legal.lastUpdated')}: {settings.legalLastUpdated}
        </p>
        <p className="legal-meta" style={{ marginTop: 4 }}>
          {settings.company} · {settings.dpoEmail}
        </p>
      </header>
      {sections.map((key) => (
        <section key={key} className="legal-section">
          <h2>{t(`legal.${type}.sections.${key}.title`)}</h2>
          <p>{interpolate(t(`legal.${type}.sections.${key}.body`), vars)}</p>
        </section>
      ))}
    </article>
  );
}