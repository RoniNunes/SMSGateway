'use client';

import { useI18n } from '@/i18n/I18nProvider';
import Link from 'next/link';

export default function LegalFooter({ className = '' }: { className?: string }) {
  const { t } = useI18n();

  return (
    <footer className={`legal-footer ${className}`.trim()}>
      <div className={`legal-footer-inner ${className.includes('landing') ? 'landing-container' : ''}`.trim()}>
        <span>{t('landing.footerCopyright', { year: String(new Date().getFullYear()) })}</span>
        <nav className="legal-footer-links" aria-label="Legal">
          <Link href="/privacy">{t('legal.footer.privacy')}</Link>
          <Link href="/terms">{t('legal.footer.terms')}</Link>
          <Link href="/cookies">{t('legal.footer.cookies')}</Link>
          <Link href="/data-rights">{t('legal.footer.dataRights')}</Link>
          <Link href="/login">{t('landing.footerClientArea')}</Link>
        </nav>
      </div>
    </footer>
  );
}