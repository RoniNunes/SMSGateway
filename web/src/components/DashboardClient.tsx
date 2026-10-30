'use client';

import { API_PATHS } from '@/lib/api-paths';
import {
  API_COUNTRY_CODES,
  API_SEND_EXAMPLE_TABS,
  type ApiSendExampleTab,
  buildFullDestPhone,
  buildSendExamples,
  isValidDestPhone,
  MIN_LOCAL_DIGITS,
  sanitizePhoneDigits,
} from '@/lib/api-send-examples';
import DataRightsPanel from '@/components/DataRightsPanel';
import LightSelect from '@/components/LightSelect';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { apiGet, apiGetAdminRecoveryStatus, apiPost } from '@/hooks/useDashboardApi';
import { useRealtime, type DashboardStats, type DeviceRow } from '@/hooks/useRealtime';
import { useI18n } from '@/i18n/I18nProvider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type Tab = 'dashboard' | 'sms' | 'sent' | 'devices' | 'webhook' | 'api' | 'account' | 'users' | 'waitlist' | 'system';

type WaitlistRow = {
  id: number;
  email: string;
  name: string;
  company: string;
  use_case: string;
  created_at: string;
};

type ServerSettings = {
  public_url: string;
  effective_url: string;
  source: 'database' | 'env' | 'default';
  env_fallback: string;
};

type LegalSettingsRow = {
  company_name: string;
  dpo_email: string;
  address: string;
  country: string;
  tax_id: string;
  legal_representative: string;
  jurisdiction: string;
  privacy_phone: string;
  legal_version: string;
  legal_last_updated: string;
  website: string;
  source: 'database' | 'env';
};

type ApkInfo = {
  available: boolean;
  filename: string;
  version_name: string;
  version_code: number;
  size_bytes: number;
  size_human: string | null;
  updated_at: string | null;
  built_at: string | null;
  download_url: string;
};

interface MeUser {
  id: number;
  name: string;
  email: string;
  api_key: string;
  is_admin: boolean;
  can_webhook: boolean;
}

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: number;
  webhook_enabled: number;
  devices: number;
  sms_count: number;
  created_at: string;
};

export default function DashboardClient({
  initialUser,
  dpoEmail,
}: {
  initialUser: MeUser;
  dpoEmail: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [user, setUser] = useState(initialUser);
  const [form, setForm] = useState({ phone: '', msg: '' });
  const [sending, setSending] = useState(false);
  const [smsData, setSmsData] = useState<{ data: Record<string, unknown>[]; total: number; page: number; pages: number }>({ data: [], total: 0, page: 1, pages: 1 });
  const [sentData, setSentData] = useState<{ data: Record<string, unknown>[]; total: number; page: number; pages: number }>({ data: [], total: 0, page: 1, pages: 1 });
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [deviceActionId, setDeviceActionId] = useState(0);
  const [pairForm, setPairForm] = useState({ name: 'Android' });
  const [pairing, setPairing] = useState<{ code: string; url: string; expires_in: number; device_id?: number } | null>(null);
  const [pairingCountdown, setPairingCountdown] = useState(0);
  const [pairingDeviceId, setPairingDeviceId] = useState<number | null>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [webhookForm, setWebhookForm] = useState({ url: '', api_key: '', api_key_masked: '', auto: false });
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [usersList, setUsersList] = useState<UserRow[]>([]);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: initialUser.name, email: initialUser.email });
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(0);
  const [forwardingId, setForwardingId] = useState(0);
  const [serverSettings, setServerSettings] = useState<ServerSettings | null>(null);
  const [serverUrlForm, setServerUrlForm] = useState('');
  const [savingServerUrl, setSavingServerUrl] = useState(false);
  const [legalSettings, setLegalSettings] = useState<LegalSettingsRow | null>(null);
  const [legalForm, setLegalForm] = useState({
    company_name: '',
    dpo_email: '',
    address: '',
    country: '',
    tax_id: '',
    legal_representative: '',
    jurisdiction: '',
    privacy_phone: '',
  });
  const [savingLegal, setSavingLegal] = useState(false);
  const [bumpLegalVersion, setBumpLegalVersion] = useState(true);
  const [apkInfo, setApkInfo] = useState<ApkInfo | null>(null);
  const [waitlist, setWaitlist] = useState<{ total: number; entries: WaitlistRow[] }>({ total: 0, entries: [] });
  const [apiCountryCode, setApiCountryCode] = useState('+34');
  const [apiDestLocal, setApiDestLocal] = useState('');
  const [apiTestMsg, setApiTestMsg] = useState('Mensagem de teste');
  const [apiSendExampleTab, setApiSendExampleTab] = useState<ApiSendExampleTab>('get');
  const [adminRecoveryEnabled, setAdminRecoveryEnabled] = useState<boolean | null>(null);

  const { connected, stats, devices: liveDevices, lastSmsAt, lastDeviceRegistered } = useRealtime(true);
  const displayStats = stats as DashboardStats | null;

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSms = useCallback(async (page = 1) => {
    const d = await apiGet<{ data: Record<string, unknown>[]; total: number; page: number; pages: number }>('sms', {
      page, limit: 20, q: search,
    });
    setSmsData(d);
  }, [search]);

  const fetchSent = useCallback(async (page = 1) => {
    const d = await apiGet<{ data: Record<string, unknown>[]; total: number; page: number; pages: number }>('sent', { page, limit: 20 });
    setSentData(d);
  }, []);

  const fetchDevices = useCallback(async () => {
    const d = await apiGet<{ data: DeviceRow[] }>('devices');
    setDevices(d.data ?? []);
  }, []);

  const loadWebhook = useCallback(async () => {
    const d = await apiGet<{ data: { webhook_url: string; webhook_api_key: string; webhook_auto: number } }>('webhook_settings');
    setWebhookForm({
      url: d.data.webhook_url,
      api_key: '',
      api_key_masked: d.data.webhook_api_key,
      auto: !!d.data.webhook_auto,
    });
  }, []);

  const fetchUsers = useCallback(async () => {
    const d = await apiGet<{ data: UserRow[] }>('users');
    setUsersList(d.data ?? []);
  }, []);

  const loadServerSettings = useCallback(async () => {
    const d = await apiGet<{ data: ServerSettings }>('server_settings');
    setServerSettings(d.data);
    setServerUrlForm(d.data.public_url || d.data.effective_url || '');
  }, []);

  const loadLegalSettings = useCallback(async () => {
    const d = await apiGet<{ data: LegalSettingsRow }>('legal_settings');
    setLegalSettings(d.data);
    setLegalForm({
      company_name: d.data.company_name ?? '',
      dpo_email: d.data.dpo_email ?? '',
      address: d.data.address ?? '',
      country: d.data.country ?? '',
      tax_id: d.data.tax_id ?? '',
      legal_representative: d.data.legal_representative ?? '',
      jurisdiction: d.data.jurisdiction ?? '',
      privacy_phone: d.data.privacy_phone ?? '',
    });
  }, []);

  const loadApkInfo = useCallback(async () => {
    const d = await apiGet<{ data: ApkInfo }>('apk_info');
    setApkInfo(d.data);
  }, []);

  const fetchWaitlist = useCallback(async () => {
    const d = await apiGet<{ total: number; entries: WaitlistRow[] }>('waitlist');
    setWaitlist({ total: d.total ?? 0, entries: d.entries ?? [] });
  }, []);

  useEffect(() => {
    void loadApkInfo();
  }, [loadApkInfo]);

  useEffect(() => {
    if (tab === 'sms') void fetchSms(1);
    if (tab === 'sent') void fetchSent(1);
    if (tab === 'devices') {
      void fetchDevices();
      void loadApkInfo();
    }
    if (tab === 'webhook') void loadWebhook();
    if (tab === 'users') void fetchUsers();
    if (tab === 'waitlist') void fetchWaitlist();
    if (tab === 'system' || tab === 'devices' || tab === 'api') {
      void loadServerSettings();
      if (user.is_admin) {
        void loadLegalSettings();
        void apiGetAdminRecoveryStatus()
          .then((s) => setAdminRecoveryEnabled(s.enabled))
          .catch(() => setAdminRecoveryEnabled(false));
      }
    }
  }, [tab, fetchSms, fetchSent, fetchDevices, loadWebhook, fetchUsers, fetchWaitlist, loadServerSettings, loadLegalSettings, loadApkInfo, user.is_admin]);

  useEffect(() => {
    if (lastSmsAt && tab === 'sms') void fetchSms(smsData.page);
  }, [lastSmsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (liveDevices.length) setDevices(liveDevices);
  }, [liveDevices]);

  const clearPairingUi = useCallback(() => {
    setPairing(null);
    setPairingCountdown(0);
    setPairingDeviceId(null);
  }, []);

  useEffect(() => {
    if (!lastDeviceRegistered) return;
    const matchesPending = !pairingDeviceId || lastDeviceRegistered.device_id === pairingDeviceId;
    if (matchesPending) {
      const label = lastDeviceRegistered.phone_number
        ? `${lastDeviceRegistered.device_name} · ${lastDeviceRegistered.phone_number}`
        : lastDeviceRegistered.device_name;
      notify(`Dispositivo registado: ${label}`);
      clearPairingUi();
      if (tab !== 'devices') setTab('devices');
      void fetchDevices();
    }
  }, [lastDeviceRegistered]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pairingDeviceId || !pairing) return;
    const d = liveDevices.find((x) => x.id === pairingDeviceId);
    if (d?.paired === 1 && d.account_status === 'active') {
      const label = d.phone_number ? `${d.device_name} · ${d.phone_number}` : d.device_name;
      notify(`Dispositivo ligado: ${label}`);
      clearPairingUi();
    }
  }, [liveDevices, pairingDeviceId, pairing, clearPairingUi]);

  useEffect(() => {
    if (!pairing?.url || !qrRef.current) return;
    void (async () => {
      try {
        const QR = await import('qrcode');
        await QR.toCanvas(qrRef.current!, pairing.url, { width: 180, margin: 1 });
      } catch { /* optional */ }
    })();
  }, [pairing?.url]);

  useEffect(() => {
    if (pairingCountdown <= 0) return;
    const t = setInterval(() => setPairingCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [pairingCountdown]);

  const sendSms = async () => {
    if (!form.phone || !form.msg) return;
    setSending(true);
    try {
      const d = await apiGet<{ message: string }>('send', { phone: form.phone, msg: form.msg });
      notify(d.message ?? 'SMS na fila');
      setForm({ phone: '', msg: '' });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSending(false);
    }
  };

  const showPairingQr = (data: { pairing_code: string; pairing_url: string; expires_in: number; id?: number }) => {
    setPairing({ code: data.pairing_code, url: data.pairing_url, expires_in: data.expires_in, device_id: data.id });
    setPairingCountdown(data.expires_in);
    if (data.id) setPairingDeviceId(data.id);
  };

  const createPairing = async () => {
    try {
      const d = await apiGet<{ pairing_code: string; pairing_url: string; expires_in: number; id: number }>('create_pairing', {
        device_name: pairForm.name,
      });
      showPairingQr(d);
      notify('QR gerado — leia com o telefone');
      void fetchDevices();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    }
  };

  const toggleDevice = async (id: number, active: boolean) => {
    setDeviceActionId(id);
    try {
      const d = await apiGet<{ message: string }>('toggle_device', { id, active: active ? '1' : '0' });
      notify(d.message ?? 'OK');
      void fetchDevices();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    } finally {
      setDeviceActionId(0);
    }
  };

  const renameDevice = async (id: number, currentName: string) => {
    const newName = prompt('Novo nome do dispositivo:', currentName)?.trim();
    if (!newName || newName === currentName) return;
    setDeviceActionId(id);
    try {
      const d = await apiGet<{ message: string; device_name: string }>('rename_device', {
        id,
        device_name: newName,
      });
      notify(d.message ?? `Renomeado para "${d.device_name}"`);
      void fetchDevices();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    } finally {
      setDeviceActionId(0);
    }
  };

  const updateDevicePhone = async (id: number, currentPhone: string) => {
    const newPhone = prompt('Novo número do dispositivo (com indicativo, ex: +34… ou +55…):', currentPhone || '')?.trim();
    if (!newPhone || newPhone === currentPhone) return;
    setDeviceActionId(id);
    try {
      const d = await apiGet<{ message: string; phone_number: string }>('update_device_phone', {
        id,
        phone_number: newPhone,
      });
      notify(d.message ?? `Número actualizado para "${d.phone_number}"`);
      void fetchDevices();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    } finally {
      setDeviceActionId(0);
    }
  };

  const reconnectDevice = async (id: number, name: string) => {
    if (!confirm(`Gerar novo QR para reconectar "${name}"? O token actual deixa de funcionar.`)) return;
    setDeviceActionId(id);
    try {
      const d = await apiGet<{ message: string; pairing_code: string; pairing_url: string; expires_in: number }>(
        'reconnect_device',
        { id },
      );
      showPairingQr({ ...d, id });
      notify(d.message ?? 'QR de reconexão gerado');
      void fetchDevices();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    } finally {
      setDeviceActionId(0);
    }
  };

  const removeDevice = async (id: number, name: string, paired: boolean) => {
    const msg = paired
      ? `Eliminar permanentemente "${name}"? O telefone deixará de ligar a esta conta.`
      : `Eliminar pareamento pendente "${name}"?`;
    if (!confirm(msg)) return;
    setDeviceActionId(id);
    try {
      const d = await apiGet<{ message: string }>('delete_device', { id });
      notify(d.message ?? 'Eliminado');
      void fetchDevices();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    } finally {
      setDeviceActionId(0);
    }
  };

  const deviceStatusLabel = (d: DeviceRow) => {
    if (d.account_status === 'pending') return 'pendente';
    if (d.account_status === 'inactive') return 'inactivo';
    return d.connection_status === 'online' ? 'online' : 'offline';
  };

  const deviceStatusBadge = (d: DeviceRow) => {
    if (d.account_status === 'pending') return 'badge-pending';
    if (d.account_status === 'inactive') return 'badge-failed';
    return d.connection_status === 'online' ? 'badge-sent' : 'badge-failed';
  };

  const saveWebhook = async () => {
    setSavingWebhook(true);
    try {
      const params: Record<string, string | number> = {
        webhook_url: webhookForm.url,
        webhook_auto: webhookForm.auto ? '1' : '0',
      };
      if (webhookForm.api_key) params.webhook_api_key = webhookForm.api_key;
      const d = await apiGet<{ message: string }>('save_webhook', params);
      notify(d.message ?? 'Webhook guardado');
      await loadWebhook();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSavingWebhook(false);
    }
  };

  const testWebhook = async () => {
    setTestingWebhook(true);
    try {
      const d = await apiGet<{ message: string }>('test_webhook');
      notify(d.message ?? 'Teste enviado');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    } finally {
      setTestingWebhook(false);
    }
  };

  const forwardWebhook = async (id: number) => {
    setForwardingId(id);
    try {
      const d = await apiGet<{ message: string }>('forward_webhook', { id });
      notify(d.message ?? 'Reenviado');
      void fetchSms(smsData.page);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    } finally {
      setForwardingId(0);
    }
  };

  const createUser = async () => {
    setCreatingUser(true);
    try {
      const d = await apiGet<{ message: string }>('create_user', {
        name: userForm.name,
        email: userForm.email,
        password: userForm.password,
        role: userForm.role,
      });
      notify(d.message ?? 'Utilizador criado');
      setUserForm({ name: '', email: '', password: '', role: 'user' });
      void fetchUsers();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    } finally {
      setCreatingUser(false);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const d = await apiGet<{ message: string; user: { name: string; email: string } }>('update_profile', {
        name: profileForm.name,
        email: profileForm.email,
      });
      setUser((u) => ({ ...u, name: d.user.name, email: d.user.email }));
      setProfileForm({ name: d.user.name, email: d.user.email });
      notify(d.message ?? 'Perfil actualizado');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      notify('A confirmação da palavra-passe não coincide');
      return;
    }
    setSavingPassword(true);
    try {
      const d = await apiGet<{ message: string }>('change_password', {
        current_password: passwordForm.current,
        new_password: passwordForm.new,
        confirm_password: passwordForm.confirm,
      });
      setPasswordForm({ current: '', new: '', confirm: '' });
      notify(d.message ?? 'Palavra-passe alterada');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSavingPassword(false);
    }
  };

  const deleteUserAccount = async (id: number, name: string) => {
    if (!confirm(`Eliminar permanentemente a conta "${name}"? Todos os dispositivos e dados associados serão removidos.`)) {
      return;
    }
    setDeletingUserId(id);
    try {
      const d = await apiGet<{ message: string }>('delete_user', { id });
      notify(d.message ?? 'Conta eliminada');
      void fetchUsers();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    } finally {
      setDeletingUserId(0);
    }
  };

  const toggleUser = async (id: number, active: boolean) => {
    try {
      const d = await apiGet<{ message: string }>('toggle_user', { id, active: active ? '1' : '0' });
      notify(d.message ?? 'OK');
      void fetchUsers();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    }
  };

  const toggleWebhookProfile = async (id: number, enabled: boolean) => {
    try {
      const d = await apiGet<{ message: string }>('toggle_webhook_profile', { id, enabled: enabled ? '1' : '0' });
      notify(d.message ?? 'OK');
      void fetchUsers();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    }
  };

  const saveServerUrl = async () => {
    setSavingServerUrl(true);
    try {
      const d = await apiGet<{ message: string; data: { effective_url: string } }>('save_server_url', {
        public_url: serverUrlForm,
      });
      notify(d.message ?? 'URL guardada');
      await loadServerSettings();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSavingServerUrl(false);
    }
  };

  const saveLegalSettingsForm = async () => {
    setSavingLegal(true);
    try {
      const d = await apiPost<{ message: string; data: LegalSettingsRow }>('save_legal_settings', {
        ...legalForm,
        bump_version: bumpLegalVersion,
      });
      notify(d.message ?? t('dashboard.legal.saved'));
      setLegalSettings(d.data);
      setBumpLegalVersion(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSavingLegal(false);
    }
  };

  const regenApiKey = async () => {
    if (!confirm('Regenerar API key? Integrações existentes deixarão de funcionar.')) return;
    try {
      const d = await apiGet<{ api_key: string }>('regenerate_api_key');
      setUser((u) => ({ ...u, api_key: d.api_key }));
      notify('Nova API key gerada');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
    router.refresh();
  };

  const fmtDate = (v: unknown) => {
    if (!v) return '—';
    try { return new Date(String(v)).toLocaleString('pt-PT'); } catch { return String(v); }
  };

  const fmtCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const nav: { id: Tab; label: string; show: boolean }[] = [
    { id: 'dashboard', label: `📊 ${t('nav.dashboard')}`, show: true },
    { id: 'sms', label: `📨 ${t('nav.sms')}`, show: true },
    { id: 'sent', label: `📤 ${t('nav.sent')}`, show: true },
    { id: 'devices', label: `📱 ${t('nav.devices')}`, show: true },
    { id: 'webhook', label: `🔗 ${t('nav.webhook')}`, show: user.can_webhook },
    { id: 'api', label: `🔑 ${t('nav.api')}`, show: true },
    { id: 'account', label: `👤 ${t('nav.account')}`, show: true },
    { id: 'users', label: `👥 ${t('nav.users')}`, show: user.is_admin },
    { id: 'waitlist', label: `📋 ${t('nav.waitlist')}`, show: user.is_admin },
    { id: 'system', label: `⚙️ ${t('nav.system')}`, show: user.is_admin },
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">SG</div>
          <div>
            <div style={{ fontWeight: 700 }}>SMS Gateway</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('dashboard.appSubtitle')}</div>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <LocaleSwitcher compact />
        </div>
        {nav.filter((n) => n.show).map((n) => (
          <button key={n.id} className={`nav-item ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
            {n.label}
          </button>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {connected ? <span className="live-dot" /> : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--rose)' }} />}
            {connected ? t('dashboard.realtimeActive') : t('dashboard.realtimeReconnecting')}
          </div>
          {apkInfo?.available && (
            <a href={API_PATHS.download} download={apkInfo.filename} className="btn-ghost" style={{ display: 'block', padding: '8px 10px', fontSize: 12, marginBottom: 8, textDecoration: 'none', textAlign: 'center' }}>
              ⬇ {apkInfo.filename}
            </a>
          )}
          {user.name} · <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={logout}>{t('common.logout')}</button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h1 style={{ fontSize: 22 }}>{t('dashboard.topbarTitle')}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('dashboard.topbarSub')}</p>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{displayStats?.server_time}</div>
        </div>

        <div className="content">
          {tab === 'dashboard' && (
            <>
              <div className="stats-grid">
                <StatCard label={t('dashboard.stats.totalSms')} value={displayStats?.total_sms ?? 0} accent="var(--primary)" />
                <StatCard label={t('dashboard.stats.todaySms')} value={displayStats?.today_sms ?? 0} accent="var(--amber)" />
                <StatCard label={t('dashboard.stats.uniqueNumbers')} value={displayStats?.unique_numbers ?? 0} accent="var(--accent)" />
                <StatCard label={t('dashboard.stats.devices')} value={displayStats?.total_devices ?? 0} accent="var(--green)" />
              </div>
              <div className="grid-2">
                <div className="panel">
                  <div className="panel-head"><span>✉️ {t('dashboard.compose.title')}</span></div>
                  <div className="panel-body">
                    <div className={`banner ${displayStats?.device_online ? 'banner-ok' : 'banner-error'}`}>
                      {displayStats?.device_online
                        ? t('dashboard.compose.phoneOnline', { count: String(displayStats.queue_pending) })
                        : t('dashboard.compose.phoneOffline')}
                    </div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('dashboard.compose.destination')}</label>
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={t('dashboard.compose.destinationPlaceholder')} style={{ marginBottom: 10 }} />
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('dashboard.compose.message')}</label>
                    <textarea value={form.msg} onChange={(e) => setForm({ ...form, msg: e.target.value })} rows={4} maxLength={160} />
                    <div style={{ marginTop: 12, textAlign: 'right' }}>
                      <button className="btn btn-primary" disabled={sending || !form.phone || !form.msg} onClick={sendSms}>
                        {sending ? t('dashboard.compose.sending') : t('dashboard.compose.send')}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-head"><span>🕐 {t('dashboard.recent.title')}</span></div>
                  <div className="panel-body" style={{ padding: 0 }}>
                    <table className="table">
                      <tbody>
                        {(displayStats?.recent ?? []).map((s) => (
                          <tr key={s.id}>
                            <td style={{ fontWeight: 600 }}>{s.phone_num}</td>
                            <td style={{ color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.message}</td>
                            <td style={{ fontSize: 11 }}>{fmtDate(s.record_stamp)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === 'sms' && (
            <div className="panel">
              <div className="panel-head">
                <span>📨 SMS Recebidos</span>
                <input style={{ maxWidth: 260 }} placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchSms(1)} />
              </div>
              <table className="table">
                <thead><tr><th>Telefone</th><th>Mensagem</th><th>Data</th>{user.can_webhook && <th></th>}</tr></thead>
                <tbody>
                  {smsData.data.map((r) => (
                    <tr key={String(r.id)}>
                      <td>{String(r.phone_num)}</td>
                      <td>{String(r.message)}</td>
                      <td>{fmtDate(r.record_stamp)}</td>
                      {user.can_webhook && (
                        <td>
                          <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} disabled={forwardingId === Number(r.id)} onClick={() => forwardWebhook(Number(r.id))}>
                            {forwardingId === Number(r.id) ? '...' : '↗ n8n'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'sent' && (
            <div className="panel">
              <div className="panel-head"><span>📤 Fila de envio</span></div>
              <table className="table">
                <thead><tr><th>Destino</th><th>Mensagem</th><th>Estado</th><th>Data</th></tr></thead>
                <tbody>
                  {sentData.data.map((r) => (
                    <tr key={String(r.id)}>
                      <td>{String(r.phone)}</td>
                      <td>{String(r.message)}</td>
                      <td><span className={`badge badge-${String(r.status)}`}>{String(r.status)}</span></td>
                      <td>{fmtDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'devices' && (
            <>
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-head"><span>📲 App Android (APK)</span></div>
              <div className="panel-body">
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                  Instale a app no telefone antes de ler o QR de pareamento.
                </p>
                {apkInfo?.available ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{apkInfo.filename}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        Versão {apkInfo.version_name} (build {apkInfo.version_code})
                        {apkInfo.size_human ? ` · ${apkInfo.size_human}` : ''}
                        {apkInfo.updated_at ? ` · ${fmtDate(apkInfo.updated_at)}` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                        O telefone guarda com este nome — pode apagar versões antigas (ex: SMSGateway-v3.0.apk).
                      </div>
                    </div>
                    <a href={apkInfo.download_url} className="btn btn-primary" style={{ textDecoration: 'none' }} download={apkInfo.filename}>
                      Descarregar {apkInfo.filename}
                    </a>
                  </div>
                ) : (
                  <div className="banner banner-error">APK não disponível no servidor.</div>
                )}
              </div>
            </div>
            <div className="panel">
              <div className="panel-head"><span>📱 Registar dispositivo</span></div>
              <div className="panel-body">
                {serverSettings && (
                  <div className={`banner ${serverSettings.effective_url.includes('localhost') ? 'banner-error' : 'banner-ok'}`} style={{ marginBottom: 14 }}>
                    URL de pareamento (QR): <strong>{serverSettings.effective_url}</strong>
                    {serverSettings.source !== 'database' && user.is_admin && (
                      <span style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                        Configure o domínio em ⚙️ Sistema para todos os utilizadores.
                      </span>
                    )}
                  </div>
                )}
                <div style={{ marginBottom: 12 }}>
                  <input placeholder="Nome do dispositivo" value={pairForm.name} onChange={(e) => setPairForm({ ...pairForm, name: e.target.value })} />
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
                    O nome e o número do dispositivo são detectados automaticamente pelo telefone ao emparelhar.
                  </p>
                </div>
                <button className="btn btn-primary" onClick={createPairing}>Gerar QR / link</button>
                {pairing && (
                  <div style={{ marginTop: 16 }}>
                    <div className="banner banner-ok" style={{ marginBottom: 12 }}>
                      Aguardando registo no telefone… O painel actualiza automaticamente quando o APK ligar.
                    </div>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div className="pairing-qr"><canvas ref={qrRef} /></div>
                      <div>
                        <div style={{ fontSize: 22, letterSpacing: '.15em', color: 'var(--primary)', fontWeight: 800 }}>{pairing.code}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                          {pairingCountdown > 0 ? `Expira em ${fmtCountdown(pairingCountdown)}` : 'Expirado'}
                        </div>
                        <input readOnly value={pairing.url} style={{ marginTop: 10, fontSize: 12 }} onFocus={(e) => e.target.select()} />
                      </div>
                    </div>
                  </div>
                )}
                <table className="table" style={{ marginTop: 20 }}>
                  <thead>
                    <tr><th>ID</th><th>Nome</th><th>Número</th><th>Conta</th><th>Ligação</th><th>Último contacto</th><th></th></tr>
                  </thead>
                  <tbody>
                    {devices.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Nenhum dispositivo registado</td></tr>
                    )}
                    {devices.map((d) => {
                      const busy = deviceActionId === d.id;
                      return (
                        <tr key={d.id}>
                          <td>
                            <code style={{ fontSize: 12, letterSpacing: '.08em', color: 'var(--primary)' }}>
                              {d.device_hash || '—'}
                            </code>
                          </td>
                          <td>{d.device_name}</td>
                          <td>{d.phone_number || '—'}</td>
                          <td>
                            <span className={`badge ${d.account_status === 'active' ? 'badge-sent' : d.account_status === 'pending' ? 'badge-pending' : 'badge-failed'}`}>
                              {d.account_status === 'active' ? 'activo' : d.account_status === 'pending' ? 'pendente' : 'inactivo'}
                            </span>
                          </td>
                          <td>
                            {d.paired ? (
                              <span className={`badge ${deviceStatusBadge(d)}`}>{deviceStatusLabel(d)}</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                            )}
                          </td>
                          <td>{fmtDate(d.last_seen)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {d.account_status === 'pending' && (
                                <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} disabled={busy} onClick={() => reconnectDevice(d.id, d.device_name)}>
                                  Renovar QR
                                </button>
                              )}
                              {d.paired === 1 && d.is_active === 1 && (
                                <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} disabled={busy} onClick={() => toggleDevice(d.id, false)}>
                                  Desactivar
                                </button>
                              )}
                              {d.paired === 1 && d.is_active === 0 && (
                                <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} disabled={busy} onClick={() => toggleDevice(d.id, true)}>
                                  Activar
                                </button>
                              )}
                              {d.paired === 1 && (
                                <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} disabled={busy} onClick={() => updateDevicePhone(d.id, d.phone_number)}>
                                  Número
                                </button>
                              )}
                              {d.paired === 1 && (
                                <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} disabled={busy} onClick={() => renameDevice(d.id, d.device_name)}>
                                  Renomear
                                </button>
                              )}
                              {d.paired === 1 && (
                                <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} disabled={busy} onClick={() => reconnectDevice(d.id, d.device_name)}>
                                  Reconectar
                                </button>
                              )}
                              <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11, color: 'var(--red)' }} disabled={busy} onClick={() => removeDevice(d.id, d.device_name, d.paired === 1)}>
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            </>
          )}

          {tab === 'webhook' && user.can_webhook && (
            <div className="panel">
              <div className="panel-head"><span>🔗 Webhook n8n</span></div>
              <div className="panel-body">
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Reencaminha SMS recebidos para o seu fluxo n8n (POST JSON).
                </p>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>URL do webhook</label>
                <input value={webhookForm.url} onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })} placeholder="https://n8n.exemplo.com/webhook/..." style={{ marginBottom: 12 }} />
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>API Key (opcional)</label>
                <input value={webhookForm.api_key} onChange={(e) => setWebhookForm({ ...webhookForm, api_key: e.target.value })} placeholder={webhookForm.api_key_masked || 'X-Api-Key'} style={{ marginBottom: 12 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16 }}>
                  <input type="checkbox" checked={webhookForm.auto} onChange={(e) => setWebhookForm({ ...webhookForm, auto: e.target.checked })} />
                  Reenvio automático ao receber SMS
                </label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" disabled={savingWebhook} onClick={saveWebhook}>
                    {savingWebhook ? 'A guardar...' : 'Guardar'}
                  </button>
                  <button className="btn btn-ghost" disabled={testingWebhook} onClick={testWebhook}>
                    {testingWebhook ? 'A testar...' : 'Testar webhook'}
                  </button>
                </div>
                <div style={{ marginTop: 20, padding: 14, background: 'rgba(0,0,0,.25)', borderRadius: 12, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
                  <div>Payload: {`{ "event": "sms_received", "phone": "...", "message": "..." }`}</div>
                  <div style={{ marginTop: 8 }}>Manual: botão ↗ na tabela SMS recebidos</div>
                </div>
              </div>
            </div>
          )}

          {tab === 'account' && (
            <>
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-head"><span>👤 Perfil</span></div>
                <div className="panel-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nome</label>
                      <input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Email</label>
                      <input type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
                    </div>
                  </div>
                  <button className="btn btn-primary" disabled={savingProfile} onClick={saveProfile}>
                    {savingProfile ? 'A guardar...' : 'Guardar perfil'}
                  </button>
                </div>
              </div>
              <div className="panel">
                <div className="panel-head"><span>🔒 Palavra-passe</span></div>
                <div className="panel-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Actual</label>
                      <input type="password" value={passwordForm.current} onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} autoComplete="current-password" />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nova</label>
                      <input type="password" value={passwordForm.new} onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })} autoComplete="new-password" />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Confirmar nova</label>
                      <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} autoComplete="new-password" />
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>Mínimo 6 caracteres.</p>
                  <button className="btn btn-primary" disabled={savingPassword} onClick={savePassword}>
                    {savingPassword ? 'A alterar...' : 'Alterar palavra-passe'}
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <DataRightsPanel mode="account" dpoEmail={dpoEmail} />
              </div>
            </>
          )}

          {tab === 'api' && (() => {
            const apiBase = (serverSettings?.effective_url || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
            const key = user.api_key || 'SUA_API_KEY';
            const fullDestPhone = buildFullDestPhone(apiCountryCode, apiDestLocal);
            const hasValidDestPhone = isValidDestPhone(apiDestLocal);
            const testMsg = apiTestMsg.trim() || 'Mensagem de teste';
            const sendExamples = buildSendExamples({
              apiBase,
              apiPath: API_PATHS.v1,
              apiKey: key,
              phone: fullDestPhone,
              msg: testMsg,
              hasValidPhone: hasValidDestPhone,
            });
            const copyExample = (text: string) => {
              void navigator.clipboard.writeText(text);
              notify('Exemplo copiado');
            };
            const codeBlock = (code: string) => (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    onClick={() => copyExample(code)}
                  >
                    Copiar
                  </button>
                </div>
                <pre style={{
                  margin: 0,
                  padding: 14,
                  background: 'rgba(0,0,0,.28)',
                  borderRadius: 12,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 11,
                  lineHeight: 1.65,
                  color: 'var(--text-muted)',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {code}
                </pre>
              </div>
            );
            const statusCodeBlock = (title: string, code: string) => (
              <div key={title} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{title}</span>
                  <button type="button" className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => copyExample(code)}>
                    Copiar
                  </button>
                </div>
                <pre style={{
                  margin: 0,
                  padding: 14,
                  background: 'rgba(0,0,0,.28)',
                  borderRadius: 12,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 11,
                  lineHeight: 1.65,
                  color: 'var(--text-muted)',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {code}
                </pre>
              </div>
            );
            const statusUrl = `${apiBase}${API_PATHS.v1}?action=status&api_key=${key}&id=123`;
            return (
              <>
                <div className="panel">
                  <div className="panel-head"><span>🔑 API Key</span></div>
                  <div className="panel-body">
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                      Autentique pedidos com a sua API key (query <code>api_key</code> ou header <code>X-Api-Key</code>).
                      O SMS é colocado na fila e enviado pelo dispositivo Android emparelhado.
                    </p>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>A sua API Key</label>
                    <div style={{ display: 'flex', gap: 10, marginTop: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                      <input readOnly value={user.api_key} style={{ flex: 1, minWidth: 200, fontFamily: 'monospace', fontSize: 12 }} />
                      <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(user.api_key); notify('API key copiada'); }}>Copiar</button>
                      <button className="btn btn-ghost" onClick={regenApiKey}>Regenerar</button>
                    </div>
                    {apiBase && (
                      <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                        Base URL: <strong style={{ color: 'var(--primary)' }}>{apiBase}</strong>
                      </p>
                    )}
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-head"><span>📤 Enviar SMS — <code>action=send</code></span></div>
                  <div className="panel-body">
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                      Parâmetros: <code>phone</code> (destino — quem recebe o SMS), <code>msg</code> (texto). Método GET ou POST.
                    </p>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Número de destino para testes</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) 2fr', gap: 10, marginTop: 6, marginBottom: 8 }}>
                      <LightSelect
                        value={apiCountryCode}
                        onChange={setApiCountryCode}
                        options={API_COUNTRY_CODES.map((c) => ({ value: c.code, label: c.label }))}
                        aria-label="Código do país"
                      />
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={apiDestLocal}
                        onChange={(e) => setApiDestLocal(sanitizePhoneDigits(e.target.value))}
                        placeholder={`Apenas dígitos (mín. ${MIN_LOCAL_DIGITS})`}
                        style={{ fontFamily: 'monospace' }}
                      />
                    </div>
                    {apiDestLocal.length > 0 && !hasValidDestPhone && (
                      <p style={{ fontSize: 11, color: 'var(--amber)', margin: '0 0 8px' }}>
                        Indique pelo menos {MIN_LOCAL_DIGITS} dígitos (sem letras nem espaços).
                      </p>
                    )}
                    {hasValidDestPhone && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
                        Número completo: <strong style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{fullDestPhone}</strong>
                      </p>
                    )}
                    {!hasValidDestPhone && (
                      <div className="banner banner-warn" style={{ marginBottom: 12, fontSize: 12 }}>
                        Selecione o país e indique o número de destino (de preferência um número seu) para gerar exemplos prontos a copiar.
                      </div>
                    )}
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Mensagem de teste (<code>msg</code>)</label>
                    <input
                      type="text"
                      value={apiTestMsg}
                      onChange={(e) => setApiTestMsg(e.target.value)}
                      placeholder="Texto que será enviado nos exemplos"
                      style={{ marginTop: 6, marginBottom: 16 }}
                    />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      {API_SEND_EXAMPLE_TABS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={`btn-ghost ${apiSendExampleTab === t.id ? 'active' : ''}`}
                          style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            borderRadius: 8,
                            border: apiSendExampleTab === t.id ? '1px solid var(--primary)' : '1px solid var(--stroke)',
                            color: apiSendExampleTab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                          }}
                          onClick={() => setApiSendExampleTab(t.id)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {codeBlock(sendExamples[apiSendExampleTab])}
                    <div style={{ padding: 12, background: 'rgba(0,201,177,.08)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
                      <strong style={{ color: 'var(--primary)' }}>Resposta sucesso:</strong>
                      <pre style={{ margin: '8px 0 0', fontFamily: 'monospace', fontSize: 11 }}>{`{
  "status": "queued",
  "id": 42,
  "message": "SMS adicionado à fila de envio."
}`}</pre>
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-head"><span>📋 Estado de entrega — <code>action=status</code></span></div>
                  <div className="panel-body">
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                      Consulte o estado de um SMS enviado via API. Use o <code>id</code> devolvido por <code>send</code>.
                    </p>
                    {statusCodeBlock('GET', statusUrl)}
                    {statusCodeBlock('cURL', `curl "${apiBase}${API_PATHS.v1}?action=status&api_key=${key}&id=123"`)}
                    <div style={{ padding: 12, background: 'rgba(0,0,0,.2)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                      <strong style={{ color: 'var(--text)' }}>Valores de <code>delivery</code>:</strong>
                      <span style={{ marginLeft: 8 }}><code>pending</code> · <code>sent</code> · <code>failed</code></span>
                      <pre style={{ margin: '10px 0 0', fontFamily: 'monospace', fontSize: 11 }}>{`{
  "status": "success",
  "id": 123,
  "phone": "${hasValidDestPhone ? fullDestPhone : '+SEU_NUMERO_DESTINO'}",
  "message": "${testMsg.replace(/"/g, '\\"')}",
  "delivery": "sent",
  "delivered": true,
  "created_at": "2026-06-30T12:00:00.000Z",
  "sent_at": "2026-06-30T12:00:05.000Z",
  "error": null
}`}</pre>
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-head"><span>ℹ️ {t('dashboard.api.notesTitle')}</span></div>
                  <div className="panel-body" style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>
                    <p style={{ margin: '0 0 8px' }}>{t('dashboard.api.note1')}</p>
                    <p style={{ margin: '0 0 8px' }}>{t('dashboard.api.note2')}</p>
                    <p style={{ margin: '0 0 8px' }}>{t('dashboard.api.note3')}</p>
                    <p style={{ margin: 0 }}>
                      {t('dashboard.api.note4')}{' '}
                      <code style={{ color: 'var(--primary)' }}>{apiBase}{API_PATHS.health}</code>
                    </p>
                  </div>
                </div>
              </>
            );
          })()}

          {tab === 'users' && user.is_admin && (
            <>
              <div className="panel">
                <div className="panel-head"><span>👤 Criar utilizador</span></div>
                <div className="panel-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
                    <input placeholder="Nome" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
                    <input placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
                    <input type="password" placeholder="Palavra-passe" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
                    <LightSelect
                      value={userForm.role}
                      onChange={(role) => setUserForm({ ...userForm, role })}
                      options={[
                        { value: 'user', label: 'Utilizador' },
                        { value: 'admin', label: 'Administrador' },
                      ]}
                      aria-label="Perfil do utilizador"
                    />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>Novos utilizadores ficam inactivos até activar na tabela.</p>
                  <button className="btn btn-primary" disabled={creatingUser} onClick={createUser}>
                    {creatingUser ? 'A criar...' : 'Criar utilizador'}
                  </button>
                </div>
              </div>
              <div className="panel">
                <div className="panel-head"><span>👥 Contas ({usersList.length})</span></div>
                <table className="table">
                  <thead>
                    <tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Estado</th><th>Webhook</th><th>Devices</th><th>SMS</th><th></th></tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>{u.role}</td>
                        <td><span className={`badge ${u.is_active ? 'badge-sent' : 'badge-failed'}`}>{u.is_active ? 'activo' : 'inactivo'}</span></td>
                        <td>
                          {u.role === 'user' ? (
                            <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => toggleWebhookProfile(u.id, !u.webhook_enabled)}>
                              {u.webhook_enabled ? 'on' : 'off'}
                            </button>
                          ) : '—'}
                        </td>
                        <td>{u.devices}</td>
                        <td>{u.sms_count}</td>
                        <td>
                          {u.id !== user.id ? (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => toggleUser(u.id, !u.is_active)}>
                                {u.is_active ? 'Desactivar' : 'Activar'}
                              </button>
                              <button
                                className="btn-ghost"
                                style={{ padding: '4px 8px', fontSize: 11, color: 'var(--rose)' }}
                                disabled={deletingUserId === u.id}
                                onClick={() => deleteUserAccount(u.id, u.name)}
                              >
                                {deletingUserId === u.id ? '...' : 'Eliminar'}
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>A sua conta</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'waitlist' && user.is_admin && (
            <div className="panel">
              <div className="panel-head">
                <span>📋 Lista de espera ({waitlist.total})</span>
                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => void fetchWaitlist()}>
                  Actualizar
                </button>
              </div>
              <div className="panel-body">
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Registos da landing page pública (<code>/</code>). Use para medir procura antes de escalar o MVP.
                </p>
                {waitlist.entries.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>Ainda sem registos na lista de espera.</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr><th>Data</th><th>Nome</th><th>Email</th><th>Empresa</th><th>Uso previsto</th><th></th></tr>
                    </thead>
                    <tbody>
                      {waitlist.entries.map((w) => (
                        <tr key={w.id}>
                          <td>{fmtDate(w.created_at)}</td>
                          <td>{w.name || '—'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{w.email}</td>
                          <td>{w.company || '—'}</td>
                          <td>{w.use_case || '—'}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{ padding: '4px 8px', fontSize: 11 }}
                              onClick={async () => {
                                if (!confirm(`Remover ${w.email} da lista? (pedido de eliminação LGPD/GDPR)`)) return;
                                const d = await apiGet<{ message: string }>('delete_waitlist_entry', { id: w.id });
                                notify(d.message);
                                void fetchWaitlist();
                              }}
                            >
                              {t('common.delete')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {tab === 'system' && user.is_admin && (
            <>
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-head"><span>⚖️ {t('dashboard.legal.title')}</span></div>
              <div className="panel-body">
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  {t('dashboard.legal.desc')}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('dashboard.legal.company')}</label>
                    <input value={legalForm.company_name} onChange={(e) => setLegalForm({ ...legalForm, company_name: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('dashboard.legal.dpoEmail')}</label>
                    <input type="email" value={legalForm.dpo_email} onChange={(e) => setLegalForm({ ...legalForm, dpo_email: e.target.value })} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('dashboard.legal.address')}</label>
                    <input value={legalForm.address} onChange={(e) => setLegalForm({ ...legalForm, address: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('dashboard.legal.country')}</label>
                    <input value={legalForm.country} onChange={(e) => setLegalForm({ ...legalForm, country: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('dashboard.legal.taxId')}</label>
                    <input value={legalForm.tax_id} onChange={(e) => setLegalForm({ ...legalForm, tax_id: e.target.value })} placeholder="NIF / CNPJ / VAT" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('dashboard.legal.representative')}</label>
                    <input value={legalForm.legal_representative} onChange={(e) => setLegalForm({ ...legalForm, legal_representative: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('dashboard.legal.jurisdiction')}</label>
                    <input value={legalForm.jurisdiction} onChange={(e) => setLegalForm({ ...legalForm, jurisdiction: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('dashboard.legal.phone')}</label>
                    <input value={legalForm.privacy_phone} onChange={(e) => setLegalForm({ ...legalForm, privacy_phone: e.target.value })} />
                  </div>
                </div>
                {legalSettings && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
                    <div>{t('dashboard.legal.version')}: <strong>{legalSettings.legal_version}</strong> · {t('dashboard.legal.updated')}: <strong>{legalSettings.legal_last_updated}</strong></div>
                    <div>{t('dashboard.legal.website')}: <strong>{legalSettings.website}</strong></div>
                    <div style={{ marginTop: 8 }}>
                      <Link href="/privacy" target="_blank" style={{ color: 'var(--primary)', marginRight: 12 }}>{t('legal.footer.privacy')}</Link>
                      <Link href="/terms" target="_blank" style={{ color: 'var(--primary)', marginRight: 12 }}>{t('legal.footer.terms')}</Link>
                      <Link href="/cookies" target="_blank" style={{ color: 'var(--primary)' }}>{t('legal.footer.cookies')}</Link>
                    </div>
                  </div>
                )}
                <label className="landing-consent" style={{ marginTop: 16 }}>
                  <input type="checkbox" checked={bumpLegalVersion} onChange={(e) => setBumpLegalVersion(e.target.checked)} />
                  <span>{t('dashboard.legal.bumpVersion')}</span>
                </label>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 12 }}
                  disabled={savingLegal || !legalForm.company_name.trim() || !legalForm.dpo_email.trim()}
                  onClick={saveLegalSettingsForm}
                >
                  {savingLegal ? t('dashboard.legal.saving') : t('dashboard.legal.save')}
                </button>
              </div>
            </div>
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-head"><span>🔐 {t('dashboard.system.recoveryTitle')}</span></div>
              <div className="panel-body">
                {adminRecoveryEnabled === null ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>…</p>
                ) : (
                  <>
                    <div className={`banner ${adminRecoveryEnabled ? 'banner-ok' : 'banner-warn'}`} style={{ marginBottom: 12, fontSize: 13 }}>
                      {adminRecoveryEnabled ? t('dashboard.system.recoveryEnabled') : t('dashboard.system.recoveryDisabled')}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.55 }}>
                      {t('dashboard.system.recoveryHow')}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                      {t('dashboard.system.recoveryNote')}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="panel">
              <div className="panel-head"><span>⚙️ URL pública do servidor</span></div>
              <div className="panel-body">
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Domínio usado em QR codes, links de pareamento e APK para <strong>todos os utilizadores</strong>.
                  Use o URL HTTPS público (ex: https://sms.empresa.com).
                </p>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>URL do servidor</label>
                <input
                  value={serverUrlForm}
                  onChange={(e) => setServerUrlForm(e.target.value)}
                  placeholder="https://sms.seudominio.com"
                  style={{ marginBottom: 12 }}
                />
                {serverSettings && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                    <div>URL activa: <strong>{serverSettings.effective_url}</strong></div>
                    <div>Origem: {serverSettings.source === 'database' ? 'painel admin' : serverSettings.source === 'env' ? 'variável APP_URL' : 'predefinição (.env / localhost)'}</div>
                    {serverSettings.env_fallback && serverSettings.source !== 'database' && (
                      <div>Fallback .env: {serverSettings.env_fallback}</div>
                    )}
                  </div>
                )}
                <button className="btn btn-primary" disabled={savingServerUrl || !serverUrlForm.trim()} onClick={saveServerUrl}>
                  {savingServerUrl ? 'A guardar...' : 'Guardar URL'}
                </button>
              </div>
            </div>
            </>
          )}
        </div>
      </main>

      {toast && <div className="toast-stack"><div className="toast">{toast}</div></div>}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="stat-card" style={{ ['--accent-color' as string]: accent }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}