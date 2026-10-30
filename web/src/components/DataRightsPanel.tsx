'use client';

import { useI18n } from '@/i18n/I18nProvider';
import Link from 'next/link';
import { useState } from 'react';

function interpolate(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

export default function DataRightsPanel({
  mode,
  dpoEmail,
}: {
  mode: 'public' | 'account';
  dpoEmail: string;
}) {
  const { t } = useI18n();
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const notify = (type: 'ok' | 'err', text: string) => setMessage({ type, text });

  const exportData = async () => {
    setLoading('export');
    setMessage(null);
    try {
      const res = await fetch('/api/dashboard?action=export_my_data');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Export failed');
      const blob = new Blob([JSON.stringify(data.export, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smsgateway-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify('ok', t('legal.dataRights.exportBtn'));
    } catch (err) {
      notify('err', err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(null);
    }
  };

  const deleteAccount = async () => {
    setLoading('delete');
    setMessage(null);
    try {
      const res = await fetch('/api/dashboard?action=delete_my_account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword, confirm: deleteConfirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Delete failed');
      window.location.href = '/login';
    } catch (err) {
      notify('err', err instanceof Error ? err.message : t('common.error'));
      setLoading(null);
    }
  };

  const optOutWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading('waitlist');
    setMessage(null);
    try {
      const res = await fetch('/api/privacy/waitlist-opt-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Request failed');
      notify('ok', data.message ?? t('common.success'));
      setWaitlistEmail('');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="data-rights">
      <header className="legal-doc-header">
        <Link href="/" className="legal-back">← {t('common.back')}</Link>
        <h1>{t('legal.dataRights.title')}</h1>
        <p className="legal-meta">{t('legal.dataRights.subtitle')}</p>
      </header>

      {message && (
        <div className={`banner ${message.type === 'ok' ? 'banner-ok' : 'banner-error'}`}>{message.text}</div>
      )}

      <section className="legal-section">
        <h2>{t('legal.dataRights.rightsListTitle')}</h2>
        <ul className="data-rights-list">
          <li>{t('legal.dataRights.rightAccess')}</li>
          <li>{t('legal.dataRights.rightRectification')}</li>
          <li>{t('legal.dataRights.rightErasure')}</li>
          <li>{t('legal.dataRights.rightRestrict')}</li>
          <li>{t('legal.dataRights.rightWithdraw')}</li>
          <li>{t('legal.dataRights.rightComplaint')}</li>
        </ul>
        <p style={{ marginTop: 12, fontSize: 14, color: 'var(--text-muted)' }}>
          {interpolate(t('legal.dataRights.contactDpo'), { email: dpoEmail })}
        </p>
      </section>

      {mode === 'account' && (
        <>
          <section className="legal-section data-rights-card">
            <h2>{t('legal.dataRights.exportTitle')}</h2>
            <p>{t('legal.dataRights.exportDesc')}</p>
            <button type="button" className="btn btn-primary" disabled={loading === 'export'} onClick={exportData}>
              {loading === 'export' ? t('legal.dataRights.exporting') : t('legal.dataRights.exportBtn')}
            </button>
          </section>

          <section className="legal-section data-rights-card data-rights-danger">
            <h2>{t('legal.dataRights.deleteTitle')}</h2>
            <p>{t('legal.dataRights.deleteDesc')}</p>
            <label>{t('legal.dataRights.deletePassword')}</label>
            <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} autoComplete="current-password" />
            <label>{t('legal.dataRights.deleteConfirm')}</label>
            <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
            <button type="button" className="btn btn-danger" disabled={loading === 'delete'} onClick={deleteAccount} style={{ marginTop: 12 }}>
              {loading === 'delete' ? t('legal.dataRights.deleting') : t('legal.dataRights.deleteBtn')}
            </button>
          </section>
        </>
      )}

      <section className="legal-section data-rights-card">
        <h2>{t('legal.dataRights.waitlistTitle')}</h2>
        <p>{t('legal.dataRights.waitlistDesc')}</p>
        <form onSubmit={optOutWaitlist}>
          <label>{t('legal.dataRights.waitlistEmail')}</label>
          <input type="email" required value={waitlistEmail} onChange={(e) => setWaitlistEmail(e.target.value)} />
          <button type="submit" className="btn btn-ghost" disabled={loading === 'waitlist'} style={{ marginTop: 12 }}>
            {t('legal.dataRights.waitlistBtn')}
          </button>
        </form>
      </section>

      <section className="legal-section">
        <h2>{t('legal.dataRights.retentionTitle')}</h2>
        <p>{t('legal.dataRights.retentionDesc')}</p>
        <p style={{ marginTop: 12 }}>
          <Link href="/privacy">{t('legal.footer.privacy')}</Link>
          {' · '}
          <Link href="/terms">{t('legal.footer.terms')}</Link>
        </p>
      </section>
    </div>
  );
}