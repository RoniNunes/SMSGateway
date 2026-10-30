'use client';

import { ConsentText } from '@/components/ConsentText';
import LegalFooter from '@/components/LegalFooter';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { apiGetAdminRecoveryStatus, apiPostAdminRecovery, apiPostLogin } from '@/hooks/useDashboardApi';
import { useI18n } from '@/i18n/I18nProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState('admin@smsgateway.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [recoveryEnabled, setRecoveryEnabled] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('admin@smsgateway.local');
  const [recoverySecret, setRecoverySecret] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryConfirm, setRecoveryConfirm] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  useEffect(() => {
    apiGetAdminRecoveryStatus()
      .then((s) => setRecoveryEnabled(s.enabled))
      .catch(() => setRecoveryEnabled(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiPostLogin(email, password);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  const submitRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setRecoveryError('');
    setRecoverySuccess('');
    try {
      const data = await apiPostAdminRecovery({
        email: recoveryEmail,
        recovery_secret: recoverySecret,
        new_password: recoveryPassword,
        confirm_password: recoveryConfirm,
      });
      setRecoverySuccess(String(data.message ?? t('login.recovery.success')));
      setRecoverySecret('');
      setRecoveryPassword('');
      setRecoveryConfirm('');
      setEmail(recoveryEmail);
      setPassword('');
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : t('login.recovery.error'));
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <form onSubmit={submit}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <LocaleSwitcher compact />
          </div>
          <h1 style={{ marginBottom: 8 }}>{t('login.title')}</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14 }}>
            {t('login.subtitle')}
          </p>
          {error && <div className="banner banner-error" style={{ marginBottom: 12 }}>{error}</div>}
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('login.email')}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 12 }} />
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('login.password')}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 16 }} />
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? t('login.submitting') : t('login.submit')}
          </button>
        </form>

        {recoveryEnabled && (
          <div className="login-recovery">
            <button
              type="button"
              className="login-recovery-toggle"
              onClick={() => {
                setRecoveryOpen((v) => !v);
                setRecoveryError('');
                setRecoverySuccess('');
              }}
              aria-expanded={recoveryOpen}
            >
              {t('login.recovery.toggle')}
            </button>
            {recoveryOpen && (
              <form className="login-recovery-form" onSubmit={submitRecovery}>
                <p className="login-recovery-desc">{t('login.recovery.desc')}</p>
                {recoveryError && <div className="banner banner-error" style={{ marginBottom: 10 }}>{recoveryError}</div>}
                {recoverySuccess && <div className="banner banner-ok" style={{ marginBottom: 10 }}>{recoverySuccess}</div>}
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('login.recovery.adminEmail')}</label>
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  style={{ marginBottom: 10 }}
                />
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('login.recovery.secret')}</label>
                <input
                  type="password"
                  value={recoverySecret}
                  onChange={(e) => setRecoverySecret(e.target.value)}
                  autoComplete="off"
                  style={{ marginBottom: 10 }}
                />
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('login.recovery.newPassword')}</label>
                <input
                  type="password"
                  value={recoveryPassword}
                  onChange={(e) => setRecoveryPassword(e.target.value)}
                  style={{ marginBottom: 10 }}
                />
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('login.recovery.confirmPassword')}</label>
                <input
                  type="password"
                  value={recoveryConfirm}
                  onChange={(e) => setRecoveryConfirm(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                <button className="btn btn-ghost" type="submit" disabled={recoveryLoading} style={{ width: '100%' }}>
                  {recoveryLoading ? t('login.recovery.submitting') : t('login.recovery.submit')}
                </button>
              </form>
            )}
          </div>
        )}

        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}>
          <ConsentText messageKey="legal.consent.loginNotice" />
        </p>
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
          <a href="/" style={{ color: 'var(--primary)' }}>{t('login.back')}</a>
        </p>
      </div>
      <LegalFooter />
    </div>
  );
}