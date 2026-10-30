'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface DashboardStats {
  total_sms: number;
  today_sms: number;
  total_devices: number;
  unique_numbers: number;
  queue_pending: number;
  queue_sent: number;
  queue_failed: number;
  device_online: boolean;
  device_last_seen: string | null;
  seconds_since_poll: number | null;
  recent: Array<{
    id: number;
    phone_num: string;
    message: string;
    datestamp: string;
    record_stamp: string;
  }>;
  server_time: string;
}

export type DeviceRow = {
  id: number;
  device_hash: string;
  device_name: string;
  phone_number: string;
  last_seen: string | null;
  is_active: number;
  paired: number;
  account_status: 'pending' | 'active' | 'inactive';
  connection_status: 'online' | 'offline' | null;
  online: number;
  created_at: string;
};

export type DeviceRegisteredEvent = {
  device_id: number;
  device_hash?: string;
  device_name: string;
  phone_number: string;
  at?: string;
};

export function useRealtime(enabled: boolean) {
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [queuePending, setQueuePending] = useState(0);
  const [lastSmsAt, setLastSmsAt] = useState<string | null>(null);
  const [lastDeviceRegistered, setLastDeviceRegistered] = useState<DeviceRegisteredEvent | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;
    esRef.current?.close();

    const es = new EventSource('/api/realtime/stream?channels=stats,sms,queue,devices');
    esRef.current = es;

    es.addEventListener('connected', () => setConnected(true));
    es.addEventListener('stats', (e) => {
      try { setStats(JSON.parse(e.data)); } catch { /* ignore */ }
    });
    es.addEventListener('devices', (e) => {
      try { setDevices(JSON.parse(e.data)); } catch { /* ignore */ }
    });
    es.addEventListener('devices.snapshot', (e) => {
      try { setDevices(JSON.parse(e.data)); } catch { /* ignore */ }
    });
    es.addEventListener('devices.registered', (e) => {
      try {
        const d = JSON.parse(e.data) as DeviceRegisteredEvent;
        setLastDeviceRegistered(d);
      } catch { /* ignore */ }
    });
    es.addEventListener('queue', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (typeof d.pending === 'number') setQueuePending(d.pending);
      } catch { /* ignore */ }
    });
    es.addEventListener('sms.received', (e) => {
      try {
        const d = JSON.parse(e.data);
        setLastSmsAt(d.record_stamp ?? new Date().toISOString());
      } catch { /* ignore */ }
    });
    es.onerror = () => {
      setConnected(false);
      es.close();
      setTimeout(connect, 3000);
    };
  }, [enabled]);

  useEffect(() => {
    connect();
    return () => esRef.current?.close();
  }, [connect]);

  return { connected, stats, devices, queuePending, lastSmsAt, lastDeviceRegistered };
}