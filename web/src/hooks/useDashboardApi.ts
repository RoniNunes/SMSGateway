'use client';

const fetchOpts: RequestInit = { credentials: 'include' };

export async function apiGet<T>(action: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams({ action, ...Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ) });
  const res = await fetch(`/api/dashboard?${qs}`, fetchOpts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'Erro API');
  return data as T;
}

export async function apiPost<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`/api/dashboard?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'Erro API');
  return data as T;
}

export async function apiPostLogin(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'Login falhou');
  return data;
}

export async function apiGetAdminRecoveryStatus(): Promise<{ enabled: boolean }> {
  const res = await fetch('/api/auth/admin-recovery', { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'Erro');
  return data as { enabled: boolean };
}

export async function apiPostAdminRecovery(body: {
  email: string;
  recovery_secret: string;
  new_password: string;
  confirm_password: string;
}) {
  const res = await fetch('/api/auth/admin-recovery', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'Recuperação falhou');
  return data;
}