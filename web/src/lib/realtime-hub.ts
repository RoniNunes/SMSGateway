export type RealtimeChannel = 'stats' | 'sms' | 'queue' | 'devices' | 'system';

export interface RealtimeEvent {
  channel: RealtimeChannel;
  type: string;
  userId?: number;
  payload?: unknown;
  at: string;
}

type Listener = (event: RealtimeEvent) => void;

const globalHub = globalThis as unknown as {
  __smsgwListeners?: Set<Listener>;
};

function listeners(): Set<Listener> {
  if (!globalHub.__smsgwListeners) {
    globalHub.__smsgwListeners = new Set();
  }
  return globalHub.__smsgwListeners;
}

export function broadcast(event: Omit<RealtimeEvent, 'at'> & { at?: string }) {
  const full: RealtimeEvent = { ...event, at: event.at ?? new Date().toISOString() };
  for (const listener of listeners()) {
    try {
      listener(full);
    } catch {
      /* ignore broken SSE client */
    }
  }
}

export function subscribe(listener: Listener): () => void {
  listeners().add(listener);
  return () => listeners().delete(listener);
}

export function broadcastUser(userId: number, channel: RealtimeChannel, type: string, payload?: unknown) {
  broadcast({ channel, type, userId, payload });
}