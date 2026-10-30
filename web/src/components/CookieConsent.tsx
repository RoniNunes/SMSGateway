'use client';

import { useI18n } from '@/i18n/I18nProvider';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const CONSENT_COOKIE = 'smsgw_consent';

function readConsent(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeConsent(value: 'all' | 'necessary', version: string) {
  const payload = JSON.stringify({ v: version, level: value, at: Date.now() });
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(payload)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export default function CookieConsent() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [legalVersion, setLegalVersion] = useState('1.0');

  useEffect(() => {
    void fetch('/api/legal/settings')
      .then((r) => r.json())
      .then((data) => {
        const version = data?.data?.legal_version ?? '1.0';
        setLegalVersion(version);
        const raw = readConsent();
        if (!raw) {
          setVisible(true);
          return;
        }
        try {
          const parsed = JSON.parse(raw) as { v?: string };
          if (parsed.v !== version) setVisible(true);
        } catch {
          setVisible(true);
        }
      })
      .catch(() => setVisible(true));
  }, []);

  const accept = (level: 'all' | 'necessary') => {
    writeConsent(level, legalVersion);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label={t('legal.cookieBanner.title')}>
      <div className="cookie-banner-inner">
        <div>
          <strong>{t('legal.cookieBanner.title')}</strong>
          <p>{t('legal.cookieBanner.body')}</p>
        </div>
        <div className="cookie-banner-actions">
          <button type="button" className="btn btn-ghost" onClick={() => accept('necessary')}>
            {t('legal.cookieBanner.necessaryOnly')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => accept('all')}>
            {t('legal.cookieBanner.accept')}
          </button>
          <Link href="/cookies" className="cookie-banner-link">{t('legal.cookieBanner.learnMore')}</Link>
        </div>
      </div>
    </div>
  );
}