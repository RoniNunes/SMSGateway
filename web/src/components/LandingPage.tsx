'use client';

import { ConsentText } from '@/components/ConsentText';
import LegalFooter from '@/components/LegalFooter';
import LightSelect from '@/components/LightSelect';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { useI18n } from '@/i18n/I18nProvider';
import Link from 'next/link';
import { useMemo, useState } from 'react';

const USE_CASE_KEYS = [
  'landing.useCase1',
  'landing.useCase2',
  'landing.useCase3',
  'landing.useCase4',
  'landing.useCase5',
  'landing.useCase6',
] as const;

const FEATURE_KEYS = [
  { icon: '📤', title: 'landing.feature1Title', desc: 'landing.feature1Desc' },
  { icon: '📥', title: 'landing.feature2Title', desc: 'landing.feature2Desc' },
  { icon: '📱', title: 'landing.feature3Title', desc: 'landing.feature3Desc' },
  { icon: '🔐', title: 'landing.feature4Title', desc: 'landing.feature4Desc' },
  { icon: '⚡', title: 'landing.feature5Title', desc: 'landing.feature5Desc' },
  { icon: '🔗', title: 'landing.feature6Title', desc: 'landing.feature6Desc' },
] as const;

export default function LandingPage() {
  const { t } = useI18n();
  const useCases = useMemo(() => USE_CASE_KEYS.map((key) => t(key)), [t]);
  const [useCaseIdx, setUseCaseIdx] = useState(0);
  const [form, setForm] = useState({ name: '', email: '', company: '' });
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setError(t('legal.consent.waitlistRequired'));
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, use_case: useCases[useCaseIdx], consent: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? t('landing.waitlistError'));
      setSuccess(data.message ?? t('landing.waitlistSuccess'));
      if (!data.already_registered) {
        setForm({ name: '', email: '', company: '' });
        setUseCaseIdx(0);
        setConsent(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('landing.waitlistError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <span className="landing-logo">SMS</span>
            <span>{t('landing.brand')}</span>
          </div>
          <nav className="landing-nav-links">
            <a href="#funcionalidades">{t('nav.features')}</a>
            <a href="#como-funciona">{t('nav.howItWorks')}</a>
            <a href="#lista-espera">{t('nav.waitlistLink')}</a>
            <LocaleSwitcher compact />
            <Link href="/login" className="landing-nav-login">{t('nav.login')}</Link>
          </nav>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-glow" aria-hidden />
        <div className="landing-container landing-hero-grid">
          <div>
            <span className="landing-pill">{t('landing.pill')}</span>
            <h1>
              {t('landing.heroTitle')}{' '}
              <span className="landing-gradient-text">{t('landing.heroTitleHighlight')}</span>
            </h1>
            <p className="landing-lead">{t('landing.heroLead')}</p>
            <div className="landing-hero-cta">
              <a href="#lista-espera" className="btn btn-primary landing-btn-lg">
                {t('landing.heroCta')}
              </a>
              <span className="landing-hero-note">{t('landing.heroNote')}</span>
            </div>
          </div>
          <div className="landing-hero-card">
            <div className="landing-mock-header">
              <span className="live-dot" />
              <span>{t('landing.mockHeader')}</span>
            </div>
            <div className="landing-mock-stats">
              <div><strong>1.284</strong><span>{t('landing.mockSmsReceived')}</span></div>
              <div><strong>98%</strong><span>{t('landing.mockDelivery')}</span></div>
              <div><strong>API</strong><span>+ n8n</span></div>
            </div>
            <div className="landing-mock-flow">
              <div className="landing-flow-step">
                <span>📱</span>
                <div>
                  <strong>{t('landing.mockAndroidTitle')}</strong>
                  <p>{t('landing.mockAndroidDesc')}</p>
                </div>
              </div>
              <div className="landing-flow-arrow">↕</div>
              <div className="landing-flow-step">
                <span>☁️</span>
                <div>
                  <strong>{t('landing.mockPanelTitle')}</strong>
                  <p>{t('landing.mockPanelDesc')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="funcionalidades" className="landing-section">
        <div className="landing-container">
          <h2 className="landing-section-title">{t('landing.featuresTitle')}</h2>
          <p className="landing-section-sub">{t('landing.featuresSub')}</p>
          <div className="landing-features">
            {FEATURE_KEYS.map((f) => (
              <article key={f.title} className="landing-feature">
                <span className="landing-feature-icon">{f.icon}</span>
                <h3>{t(f.title)}</h3>
                <p>{t(f.desc)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="landing-section landing-section-alt">
        <div className="landing-container">
          <h2 className="landing-section-title">{t('landing.stepsTitle')}</h2>
          <div className="landing-steps">
            <div className="landing-step">
              <span className="landing-step-num">1</span>
              <h3>{t('landing.step1Title')}</h3>
              <p>{t('landing.step1Desc')}</p>
            </div>
            <div className="landing-step">
              <span className="landing-step-num">2</span>
              <h3>{t('landing.step2Title')}</h3>
              <p>{t('landing.step2Desc')}</p>
            </div>
            <div className="landing-step">
              <span className="landing-step-num">3</span>
              <h3>{t('landing.step3Title')}</h3>
              <p>{t('landing.step3Desc')}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="lista-espera" className="landing-section landing-waitlist-section">
        <div className="landing-container landing-waitlist-grid">
          <div>
            <h2 className="landing-section-title">{t('landing.waitlistTitle')}</h2>
            <p className="landing-section-sub" style={{ marginBottom: 20 }}>
              {t('landing.waitlistSub')}
            </p>
            <ul className="landing-waitlist-perks">
              <li>{t('landing.waitlistPerk1')}</li>
              <li>{t('landing.waitlistPerk2')}</li>
              <li>{t('landing.waitlistPerk3')}</li>
            </ul>
          </div>
          <form className="landing-waitlist-form" onSubmit={submit}>
            <h3>{t('landing.waitlistFormTitle')}</h3>
            {success && <div className="banner banner-ok">{success}</div>}
            {error && <div className="banner banner-error">{error}</div>}
            <label>{t('landing.waitlistName')}</label>
            <input
              required
              placeholder={t('landing.waitlistNamePlaceholder')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <label>{t('landing.waitlistEmail')}</label>
            <input
              required
              type="email"
              placeholder={t('landing.waitlistEmailPlaceholder')}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <div className="landing-waitlist-consent" role="group" aria-labelledby="waitlist-consent-heading">
              <p id="waitlist-consent-heading" className="landing-consent-detail">
                <ConsentText messageKey="legal.consent.waitlistDetail" />
              </p>
              <label className="landing-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                />
                <span>{t('legal.consent.waitlistCheckbox')}</span>
              </label>
            </div>
            <label>
              {t('landing.waitlistCompany')}{' '}
              <span className="landing-optional">{t('common.optional')}</span>
            </label>
            <input
              placeholder={t('landing.waitlistCompanyPlaceholder')}
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
            <label>{t('landing.waitlistUseCase')}</label>
            <LightSelect
              value={String(useCaseIdx)}
              onChange={(v) => setUseCaseIdx(Number(v))}
              options={useCases.map((c, i) => ({ value: String(i), label: c }))}
              aria-label={t('landing.waitlistUseCase')}
            />
            <button type="submit" className="btn btn-primary landing-btn-lg" disabled={loading || !consent} style={{ width: '100%', marginTop: 8 }}>
              {loading ? t('landing.waitlistSubmitting') : t('landing.waitlistSubmit')}
            </button>
            <p className="landing-form-note">{t('landing.waitlistNote')}</p>
          </form>
        </div>
      </section>

      <LegalFooter className="landing-footer" />
    </div>
  );
}